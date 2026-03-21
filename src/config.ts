import type { Config } from './types.js';

export function loadConfig(): Config {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required');

  const whitelist = (process.env.GROUP_WHITELIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (whitelist.length === 0) {
    throw new Error('GROUP_WHITELIST must contain at least one group JID');
  }

  return {
    openrouterApiKey: apiKey,
    groupWhitelist: whitelist,
    botPrefix: process.env.BOT_PREFIX ?? '',
    logLevel: process.env.LOG_LEVEL ?? 'info',
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
    const cleanText = text.trimStart().slice(prefix.length).trim();
    return { respond: true, cleanText };
  }

  return { respond: false, cleanText: '' };
}
