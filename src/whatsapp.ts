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
            await handleMessage(sock, msg, config, systemPrompt);
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
  };
  message?: {
    conversation?: string | null;
    extendedTextMessage?: { text?: string | null } | null;
  } | null;
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

  // Extract text
  const text = extractText(msg);
  if (!text) return;

  // Check prefix
  const { respond, cleanText } = shouldRespond(text, config.botPrefix);
  if (!respond || !cleanText) return;

  const senderName = (msg.key.participant ?? 'unknown').replace(/@.*/, '');
  console.log(`📩 [${jid}] ${senderName}: ${cleanText.slice(0, 100)}`);

  // Save user message to conversation history
  pushHistory(jid, 'user', cleanText, senderName);

  // Get conversation history for context
  const history = getHistory(jid);

  // Get LLM response with conversation history
  const response = await chat({
    apiKey: config.openrouterApiKey,
    systemPrompt,
    userMessage: cleanText,
    history,
  });

  // Check if LLM decided to skip this message
  const trimmedResponse = response.content.trim();
  if (trimmedResponse === '[SKIP]' || trimmedResponse.toLowerCase() === '[skip]') {
    console.log(`⏭️  [${jid}] Skipped (LLM chose not to respond)`);
    return;
  }

  // Save bot response to conversation history
  pushHistory(jid, 'assistant', response.content);

  console.log(`🤖 [${response.model}] ${response.content.slice(0, 100)}`);

  // Send response
  await sock.sendMessage(jid, { text: response.content }, { quoted: msg as never });
}
