import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  type WASocket,
  type BaileysEventMap,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import type { Config } from './types.js';
import { isGroupAllowed, isGroupMessage, shouldRespond } from './config.js';
import { buildSystemPrompt, loadPersona } from './persona.js';
import { chat } from './llm.js';

const AUTH_DIR = 'auth_state';
const MAX_HISTORY = 15;

/** In-memory conversation history per group */
const groupHistory = new Map<string, Array<{ role: 'user' | 'assistant'; name?: string; content: string }>>();

/** In-memory participant map per group: displayName → JID */
const groupParticipants = new Map<string, Map<string, string>>();

/** Normalize JID to phone number (strip device suffix + domain) */
function jidToNumber(jid: string): string {
  return jid.split('@')[0].split(':')[0];
}

/** Track a participant from an incoming message */
function trackParticipant(groupJid: string, participantJid: string, pushName?: string): void {
  if (!groupParticipants.has(groupJid)) {
    groupParticipants.set(groupJid, new Map());
  }
  const map = groupParticipants.get(groupJid)!;
  const number = jidToNumber(participantJid);
  // Use pushName if available, otherwise use number
  const name = pushName?.trim() || number;
  map.set(name, `${number}@s.whatsapp.net`);
}

/** Load group participants via groupMetadata (called once on first message per group) */
async function loadGroupParticipants(sock: WASocket, groupJid: string): Promise<void> {
  if (groupParticipants.has(groupJid)) return;
  try {
    const metadata = await sock.groupMetadata(groupJid);
    groupParticipants.set(groupJid, new Map());
    const map = groupParticipants.get(groupJid)!;
    for (const p of metadata.participants) {
      const number = jidToNumber(p.id);
      map.set(number, p.id); // initial: number → JID (pushName not available here)
    }
  } catch {
    // Non-fatal — participants will be learned from messages
  }
}

/** Build participant context string for the LLM system prompt */
function getParticipantContext(groupJid: string, botJid?: string): string {
  const map = groupParticipants.get(groupJid);
  if (!map || map.size === 0) return '';

  const botNumber = botJid ? jidToNumber(botJid) : '';
  const entries: string[] = [];
  for (const [name, jid] of map) {
    const number = jidToNumber(jid);
    if (number === botNumber) continue; // exclude self
    entries.push(`- ${name}: @${number}`);
  }
  if (entries.length === 0) return '';
  return `\n\nParticipantes do grupo:\n${entries.join('\n')}\n\nPara mencionar alguém, use @número no seu texto (ex: @${jidToNumber(entries[0]?.split('@')[1] || '5511999999999')}).`;
}

/** Parse @mentions from LLM response text and return mentions array */
function extractMentions(text: string): string[] {
  const mentionRegex = /@(\d{10,15})/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(`${match[1]}@s.whatsapp.net`);
  }
  return mentions;
}

function pushHistory(groupJid: string, role: 'user' | 'assistant', content: string, name?: string): void {
  if (!groupHistory.has(groupJid)) {
    groupHistory.set(groupJid, []);
  }
  const history = groupHistory.get(groupJid)!;
  history.push({ role, content, ...(name ? { name } : {}) });
  // Keep only the last MAX_HISTORY messages
  while (history.length > MAX_HISTORY) {
    history.shift();
  }
}

function getHistory(groupJid: string): Array<{ role: 'user' | 'assistant'; name?: string; content: string }> {
  return groupHistory.get(groupJid) ?? [];
}

export async function startBot(config: Config): Promise<void> {
  // Silent Baileys logger — its default output is extremely verbose (history sync, pre-keys, etc)
  // App-level logging is done via console.log with clear formatting
  const logger = pino({ level: 'silent' });

  const persona = loadPersona();
  const systemPrompt = buildSystemPrompt(persona);

  console.log('🤖 Mini Fun Claw starting...');
  console.log(`📋 Whitelisted groups: ${config.groupWhitelist.length}`);
  console.log(`🔤 Bot prefix: ${config.botPrefix || '(none — responds to all)'}`);
  console.log(`🎲 Response rate: ${Math.round(config.responseRate * 100)}% (mention "${config.botPrefix || 'bot'}" to always get a response)`);

  const connect = async (): Promise<void> => {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const sock: WASocket = makeWASocket({
      auth: state,
      logger,
      browser: Browsers.macOS('Desktop'),
      version: [2, 3000, 1033893291] as [number, number, number],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on(
      'connection.update',
      (update: BaileysEventMap['connection.update']) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('📱 Scan this QR code with WhatsApp:');
          qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
          const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = reason !== DisconnectReason.loggedOut;

          console.log(
            `❌ Connection closed. Reason: ${reason ?? 'unknown'}. ${shouldReconnect ? 'Reconnecting...' : 'Logged out.'}`,
          );

          if (shouldReconnect) {
            setTimeout(() => connect(), 3000);
          }
        } else if (connection === 'open') {
          console.log('✅ Connected to WhatsApp!');
        }
      },
    );

    sock.ev.on(
      'messages.upsert',
      async (upsert: BaileysEventMap['messages.upsert']) => {
        if (upsert.type !== 'notify') return;

        for (const msg of upsert.messages) {
          try {
            const botJid = sock.user?.id;
            await handleMessage(sock, msg, config, systemPrompt, botJid);
          } catch (err) {
            console.error('Error handling message:', err);
          }
        }
      },
    );
  };

  await connect();
}

interface WAMessage {
  key: {
    remoteJid?: string | null;
    fromMe?: boolean | null;
    participant?: string | null;
    id?: string | null;
  };
  message?: {
    conversation?: string | null;
    extendedTextMessage?: {
      text?: string | null;
      contextInfo?: {
        /** JID of the participant whose message is being quoted */
        participant?: string | null;
        /** The quoted message */
        quotedMessage?: unknown;
      } | null;
    } | null;
  } | null;
}

/** Check if this message is a reply to the bot */
function isReplyToBot(msg: WAMessage, botJid: string | undefined): boolean {
  const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (!quotedParticipant || !botJid) return false;
  // Compare without device suffix (e.g. 5511xxx:77@s.whatsapp.net → 5511xxx)
  const normalize = (jid: string) => jid.split('@')[0].split(':')[0];
  return normalize(quotedParticipant) === normalize(botJid);
}

/** Check if the bot's number is mentioned in the text */
function isBotMentionedInText(text: string, botJid: string | undefined, prefix: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  // Check prefix mention
  if (prefix && lower.includes(prefix.toLowerCase())) return true;
  // Check @mention of bot's number
  if (botJid) {
    const botNumber = botJid.split('@')[0].split(':')[0];
    if (lower.includes(`@${botNumber}`)) return true;
  }
  return false;
}

function extractText(msg: WAMessage): string | null {
  return (
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    null
  );
}

async function handleMessage(
  sock: WASocket,
  msg: WAMessage,
  config: Config,
  systemPrompt: string,
  botJid?: string,
): Promise<void> {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  // Ignore own messages
  if (msg.key.fromMe) return;

  // Ignore DMs — only groups
  if (!isGroupMessage(jid)) return;

  // Discovery mode: log group JIDs clearly when whitelist is empty
  if (config.groupWhitelist.length === 0) {
    const sender = msg.key.participant || msg.key.remoteJid || 'unknown';
    console.log(`\n📍 GROUP MESSAGE DETECTED`);
    console.log(`   JID: ${jid}`);
    console.log(`   From: ${sender}`);
    console.log(`   ➡️  Add this to .env: GROUP_WHITELIST=${jid}\n`);
    return;
  }

  // Ignore non-whitelisted groups
  if (!isGroupAllowed(jid, config.groupWhitelist)) return;

  // Load group participants on first message (non-blocking)
  await loadGroupParticipants(sock, jid);

  // Track sender from every message (learns pushNames over time)
  const senderJid = msg.key.participant || msg.key.remoteJid || '';
  const pushName = (msg as any).pushName as string | undefined;
  if (senderJid) {
    trackParticipant(jid, senderJid, pushName);
  }

  // Extract text
  const text = extractText(msg);
  if (!text) return;

  // Check prefix
  const { respond, cleanText } = shouldRespond(text, config.botPrefix);
  if (!respond || !cleanText) return;

  const senderName = pushName || jidToNumber(senderJid);
  console.log(`📩 [${jid}] ${senderName}: ${cleanText.slice(0, 100)}`);

  // Save user message to conversation history (always, even if we skip)
  pushHistory(jid, 'user', cleanText, senderName);

  // Bypass random gate if message is directed at the bot (reply or mention)
  const repliedToBot = isReplyToBot(msg, botJid);
  const mentionedBot = isBotMentionedInText(cleanText, botJid, config.botPrefix);
  const directedAtBot = repliedToBot || mentionedBot;

  // Random response gate — skip most messages to avoid dominating the group
  // Always respond if message is directed at the bot (reply, @mention, or prefix)
  if (!directedAtBot && Math.random() > config.responseRate) {
    console.log(`🎲 [${jid}] Skipped (random gate, rate=${config.responseRate})`);
    return;
  }

  if (directedAtBot) {
    console.log(`📌 [${jid}] Directed at bot (${repliedToBot ? 'reply' : 'mention'}) — always responding`);
  }

  // Get conversation history for context
  const history = getHistory(jid);

  // Inject participant context into system prompt
  const participantContext = getParticipantContext(jid, botJid);
  const enrichedPrompt = participantContext ? systemPrompt + participantContext : systemPrompt;

  // Get LLM response with conversation history
  const response = await chat({
    apiKey: config.openrouterApiKey,
    systemPrompt: enrichedPrompt,
    userMessage: cleanText,
    history,
  });

  // All models failed — silently skip
  if (!response) {
    console.log(`💤 [${jid}] All models unavailable, skipping`);
    return;
  }

  // Check if LLM decided to skip this message
  const trimmedResponse = response.content.trim();
  if (!trimmedResponse || trimmedResponse === '[SKIP]' || trimmedResponse.toLowerCase() === '[skip]') {
    console.log(`⏭️  [${jid}] Skipped (LLM chose not to respond)`);
    return;
  }

  // Save bot response to conversation history
  pushHistory(jid, 'assistant', response.content);

  console.log(`🤖 [${response.model}] ${response.content.slice(0, 100)}`);

  // Extract @mentions from the response
  const mentions = extractMentions(response.content);
  const messagePayload: { text: string; mentions?: string[] } = { text: response.content };
  if (mentions.length > 0) {
    messagePayload.mentions = mentions;
  }

  // Send response — only quote the original message if it was directed at the bot
  // This prevents the bot from always replying with quote, which makes it look less spammy
  if (directedAtBot) {
    await sock.sendMessage(jid, messagePayload, { quoted: msg as never });
  } else {
    await sock.sendMessage(jid, messagePayload);
  }
}
