/**
 * Provider detection and resolution for multi-provider LLM support.
 *
 * Priority:
 * 1. PREFERRED_PROVIDER env var (if set + matching credentials exist)
 * 2. Env API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY)
 * 3. pi-ai OAuth (auth.json from `npx @mariozechner/pi-ai login`)
 * 4. CLI credentials (~/.codex/auth.json for OpenAI)
 * 5. OpenRouter free tier (OPENROUTER_API_KEY)
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type ProviderName = 'anthropic' | 'openai' | 'openrouter';
export type CredentialSource = 'env' | 'codex-cli' | 'pi-ai-oauth';

export interface ProviderConfig {
  provider: ProviderName;
  apiKey: string;
  source: CredentialSource;
  /** Default model for this provider */
  model: string;
}

// ─── Default models per provider ────────────────────────────

const DEFAULT_MODELS: Record<ProviderName, string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o-mini',
  openrouter: 'nousresearch/hermes-3-llama-3.1-405b:free',
};

// ─── pi-ai OAuth credentials ────────────────────────────────

export interface PiAiAuthJson {
  anthropic?: { type: string; [key: string]: unknown };
  'openai-codex'?: { type: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** Placeholder API key for OAuth providers — real key resolved at call time */
export const PI_AI_OAUTH_PLACEHOLDER = '__pi_ai_oauth__';

function getPiAiAuthPaths(): string[] {
  return [
    process.env.PI_AI_AUTH_PATH,
    join(process.cwd(), 'auth.json'),
  ].filter(Boolean) as string[];
}

export function readPiAiAuth(): PiAiAuthJson | null {
  for (const authPath of getPiAiAuthPaths()) {
    if (!existsSync(authPath)) continue;
    try {
      const raw = readFileSync(authPath, 'utf-8');
      const auth = JSON.parse(raw);
      if (auth && typeof auth === 'object') return auth;
    } catch { /* skip invalid */ }
  }
  return null;
}

// ─── CLI credential paths ───────────────────────────────────

function getCodexCredPath(): string {
  return join(homedir(), '.codex', 'auth.json');
}

// ─── CLI credential reading ─────────────────────────────────

interface CodexCredentials {
  /** Codex stores API key directly when auth_mode is "apikey" */
  auth_mode?: string;
  OPENAI_API_KEY?: string;
  /** Legacy format: OAuth token */
  access_token?: string;
  expires_at?: number;
}

function readCodexCliCreds(): string | null {
  const credPath = getCodexCredPath();
  if (!existsSync(credPath)) return null;

  try {
    const raw = readFileSync(credPath, 'utf-8');
    const creds = JSON.parse(raw) as CodexCredentials;

    // Primary: auth_mode=apikey with OPENAI_API_KEY
    if (creds.auth_mode === 'apikey' && creds.OPENAI_API_KEY) {
      return creds.OPENAI_API_KEY;
    }

    // Legacy: OAuth access_token
    const token = creds.access_token;
    const expiresAt = creds.expires_at;

    if (!token) return null;

    // Check if expired (with 5min buffer)
    if (expiresAt && expiresAt < Date.now() + 300_000) {
      console.warn('⚠️  Codex CLI token expired, skipping');
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

// ─── Collect Available Providers ────────────────────────────

function collectAvailableProviders(): ProviderConfig[] {
  const available: ProviderConfig[] = [];

  // 1. Env API keys (highest priority)
  if (process.env.ANTHROPIC_API_KEY) {
    available.push({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      source: 'env',
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODELS.anthropic,
    });
  }

  if (process.env.OPENAI_API_KEY) {
    available.push({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      source: 'env',
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODELS.openai,
    });
  }

  // 2. pi-ai OAuth credentials (from `npx @mariozechner/pi-ai login`)
  const piAiAuth = readPiAiAuth();

  if (piAiAuth?.anthropic && !available.some(a => a.provider === 'anthropic')) {
    available.push({
      provider: 'anthropic',
      apiKey: PI_AI_OAUTH_PLACEHOLDER,
      source: 'pi-ai-oauth',
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODELS.anthropic,
    });
  }

  if (piAiAuth?.['openai-codex'] && !available.some(a => a.provider === 'openai')) {
    available.push({
      provider: 'openai',
      apiKey: PI_AI_OAUTH_PLACEHOLDER,
      source: 'pi-ai-oauth',
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODELS.openai,
    });
  }

  // 3. Codex CLI credentials (~/.codex/auth.json)
  const codexToken = readCodexCliCreds();
  if (codexToken && !available.some(a => a.provider === 'openai')) {
    available.push({
      provider: 'openai',
      apiKey: codexToken,
      source: 'codex-cli',
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODELS.openai,
    });
  }

  // 4. OpenRouter (lowest priority)
  if (process.env.OPENROUTER_API_KEY) {
    available.push({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      source: 'env',
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODELS.openrouter,
    });
  }

  return available;
}

// ─── Detection ──────────────────────────────────────────────

/**
 * Detect the best available provider based on env vars, OAuth, and CLI credentials.
 * Returns null if no provider is available.
 */
export function detectProvider(): ProviderConfig | null {
  const preferred = process.env.PREFERRED_PROVIDER as ProviderName | undefined;
  const available = collectAvailableProviders();

  if (available.length === 0) return null;

  if (preferred) {
    const match = available.find(a => a.provider === preferred);
    if (match) return match;
  }

  return available[0];
}

// ─── Provider Chain ─────────────────────────────────────────

/**
 * Resolve a chain of providers for fallback.
 * Primary provider first, then alternatives.
 */
export function resolveProviderChain(): ProviderConfig[] {
  const preferred = process.env.PREFERRED_PROVIDER as ProviderName | undefined;
  const available = collectAvailableProviders();
  const chain: ProviderConfig[] = [];
  const seen = new Set<ProviderName>();

  const add = (config: ProviderConfig) => {
    if (seen.has(config.provider)) return;
    seen.add(config.provider);
    chain.push(config);
  };

  if (preferred) {
    const match = available.find(a => a.provider === preferred);
    if (match) add(match);
  }

  for (const config of available) {
    add(config);
  }

  return chain;
}

/**
 * Format provider info for logging.
 */
export function formatProviderInfo(config: ProviderConfig): string {
  const sourceLabels: Record<CredentialSource, string> = {
    'env': 'API key',
    'codex-cli': 'Codex CLI',
    'pi-ai-oauth': 'OAuth subscription',
  };
  return `${config.provider} (${sourceLabels[config.source]}) → ${config.model}`;
}
