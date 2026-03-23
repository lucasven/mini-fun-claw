/**
 * Provider detection and resolution for multi-provider LLM support.
 *
 * Priority:
 * 1. PREFERRED_PROVIDER env var (if set + matching credentials exist)
 * 2. Env API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY)
 * 3. CLI credentials (~/.codex/auth.json for OpenAI)
 * 4. OpenRouter free tier (OPENROUTER_API_KEY)
 *
 * Note: Claude CLI OAuth tokens (~/.claude/.credentials.json) are NOT supported
 * because Anthropic's REST API returns 401 for OAuth tokens. Use ANTHROPIC_API_KEY instead.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type ProviderName = 'anthropic' | 'openai' | 'openrouter';
export type CredentialSource = 'env' | 'codex-cli';

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

// ─── Detection ──────────────────────────────────────────────

/**
 * Detect the best available provider based on env vars and CLI credentials.
 * Returns null if no provider is available.
 */
export function detectProvider(): ProviderConfig | null {
  const preferred = process.env.PREFERRED_PROVIDER as ProviderName | undefined;

  // Collect all available providers
  const available: ProviderConfig[] = [];

  // 1. Env API keys
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

  // 2. Codex CLI credentials (lower priority than env keys)
  const codexToken = readCodexCliCreds();
  if (codexToken && !available.some(a => a.provider === 'openai')) {
    available.push({
      provider: 'openai',
      apiKey: codexToken,
      source: 'codex-cli',
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODELS.openai,
    });
  }

  // 3. OpenRouter (lowest priority)
  if (process.env.OPENROUTER_API_KEY) {
    available.push({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      source: 'env',
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODELS.openrouter,
    });
  }

  if (available.length === 0) return null;

  // If preferred provider is set and available, use it
  if (preferred) {
    const match = available.find(a => a.provider === preferred);
    if (match) return match;
  }

  // Default: first available (priority order: anthropic > openai > openrouter)
  return available[0];
}

// ─── Provider Chain ─────────────────────────────────────────

/**
 * Resolve a chain of providers for fallback.
 * Primary provider first, then alternatives.
 */
export function resolveProviderChain(): ProviderConfig[] {
  const preferred = process.env.PREFERRED_PROVIDER as ProviderName | undefined;
  const all: ProviderConfig[] = [];
  const seen = new Set<ProviderName>();

  const add = (config: ProviderConfig) => {
    if (seen.has(config.provider)) return;
    seen.add(config.provider);
    all.push(config);
  };

  // Collect all available
  const available: ProviderConfig[] = [];

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

  const codexToken = readCodexCliCreds();
  if (codexToken && !available.some(a => a.provider === 'openai')) {
    available.push({
      provider: 'openai',
      apiKey: codexToken,
      source: 'codex-cli',
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODELS.openai,
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    available.push({
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      source: 'env',
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODELS.openrouter,
    });
  }

  // Preferred first
  if (preferred) {
    const match = available.find(a => a.provider === preferred);
    if (match) add(match);
  }

  // Then rest in priority order
  for (const config of available) {
    add(config);
  }

  return all;
}

/**
 * Format provider info for logging.
 */
export function formatProviderInfo(config: ProviderConfig): string {
  const sourceLabel = config.source === 'env'
    ? 'API key'
    : 'Codex CLI';
  return `${config.provider} (${sourceLabel}) → ${config.model}`;
}
