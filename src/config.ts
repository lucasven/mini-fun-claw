import type { Config } from './types.js';
import { detectProvider } from './provider.js';

export function loadConfig(): Config {
  const apiKey = process.env.OPENROUTER_API_KEY ?? '';

  // At least one provider must be available
  const provider = detectProvider();
  if (!provider && !apiKey) {
    throw new Error(
      'No LLM provider configured. Set at least one of: OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY',
    );
  }

  const whitelist = (process.env.GROUP_WHITELIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (whitelist.length === 0) {
    console.warn('⚠️  GROUP_WHITELIST is empty — bot will log group JIDs but NOT respond to any messages.');
    console.warn('   Send a message in a group and check the logs for the JID, then add it to .env');
  }

  return {
    openrouterApiKey: apiKey,
    groupWhitelist: whitelist,
    botPrefix: process.env.BOT_PREFIX ?? '',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    responseRate: Math.min(1, Math.max(0, parseFloat(process.env.RESPONSE_RATE || '0.1'))),
  };
}

export function isGroupAllowed(jid: string, whitelist: string[]): boolean {
  return whitelist.includes(jid);
}

export function isGroupMessage(jid: string): boolean {
  return jid.endsWith('@g.us');
}

export function shouldRespond(
  text: string,
  prefix: string,
): { respond: boolean; cleanText: string } {
  if (!prefix) return { respond: true, cleanText: text.trim() };

  const lower = text.trimStart().toLowerCase();
  if (lower.startsWith(prefix.toLowerCase())) {
    const afterPrefix = text.trimStart().slice(prefix.length);
    // Only match if prefix is followed by space, EOL, or nothing (word boundary)
    if (afterPrefix === '' || afterPrefix.startsWith(' ')) {
      return { respond: true, cleanText: afterPrefix.trim() };
    }
  }

  return { respond: false, cleanText: '' };
}
