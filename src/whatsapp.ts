import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
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

export async function startBot(config: Config): Promise<void> {
  const logger = pino({ level: config.logLevel });

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
      browser: ['Mini Fun Claw', 'Chrome', '1.0.0'],
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

  // Ignore non-whitelisted groups
  if (!isGroupAllowed(jid, config.groupWhitelist)) return;

  // Extract text
  const text = extractText(msg);
  if (!text) return;

  // Check prefix
  const { respond, cleanText } = shouldRespond(text, config.botPrefix);
  if (!respond || !cleanText) return;

  console.log(`📩 [${jid}] ${msg.key.participant ?? 'unknown'}: ${cleanText.slice(0, 100)}`);

  // Get LLM response
  const response = await chat({
    apiKey: config.openrouterApiKey,
    systemPrompt,
    userMessage: cleanText,
  });

  console.log(`🤖 [${response.model}] ${response.content.slice(0, 100)}`);

  // Send response
  await sock.sendMessage(jid, { text: response.content }, { quoted: msg as never });
}
