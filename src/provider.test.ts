import { detectProvider, resolveProviderChain, readPiAiAuth } from './provider.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs.existsSync for credential detection
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

beforeEach(() => {
  mockExistsSync.mockReset();
  mockReadFileSync.mockReset();
});

describe('detectProvider', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns anthropic when ANTHROPIC_API_KEY is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    mockExistsSync.mockReturnValue(false);

    const provider = detectProvider()!;
    expect(provider.provider).toBe('anthropic');
    expect(provider.apiKey).toBe('sk-ant-test');
    expect(provider.source).toBe('env');
  });

  it('returns openai when OPENAI_API_KEY is set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    delete process.env.OPENROUTER_API_KEY;
    mockExistsSync.mockReturnValue(false);

    const provider = detectProvider()!;
    expect(provider.provider).toBe('openai');
    expect(provider.apiKey).toBe('sk-openai-test');
    expect(provider.source).toBe('env');
  });

  it('returns openrouter when OPENROUTER_API_KEY is set and no other provider', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    mockExistsSync.mockReturnValue(false);

    const provider = detectProvider()!;
    expect(provider.provider).toBe('openrouter');
    expect(provider.apiKey).toBe('sk-or-test');
    expect(provider.source).toBe('env');
  });

  it('respects PREFERRED_PROVIDER=openai even when anthropic key exists', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    process.env.PREFERRED_PROVIDER = 'openai';
    mockExistsSync.mockReturnValue(false);

    const provider = detectProvider()!;
    expect(provider.provider).toBe('openai');
  });

  it('respects PREFERRED_PROVIDER=anthropic', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    process.env.PREFERRED_PROVIDER = 'anthropic';
    mockExistsSync.mockReturnValue(false);

    const provider = detectProvider()!;
    expect(provider.provider).toBe('anthropic');
  });

  it('respects PREFERRED_PROVIDER=openrouter', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    process.env.PREFERRED_PROVIDER = 'openrouter';
    mockExistsSync.mockReturnValue(false);

    const provider = detectProvider()!;
    expect(provider.provider).toBe('openrouter');
  });

  it('returns null when no credentials found', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;
    mockExistsSync.mockReturnValue(false);

    const provider = detectProvider();
    expect(provider).toBeNull();
  });

  it('detects Codex CLI credentials with auth_mode=apikey', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;

    const credPath = path.join(os.homedir(), '.codex', 'auth.json');
    mockExistsSync.mockImplementation((p) => p === credPath);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      auth_mode: 'apikey',
      OPENAI_API_KEY: 'sk-proj-codex-key-123',
    }));

    const provider = detectProvider();
    expect(provider).not.toBeNull();
    expect(provider!.provider).toBe('openai');
    expect(provider!.apiKey).toBe('sk-proj-codex-key-123');
    expect(provider!.source).toBe('codex-cli');
  });

  it('detects Codex CLI legacy OAuth credentials', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;

    const credPath = path.join(os.homedir(), '.codex', 'auth.json');
    mockExistsSync.mockImplementation((p) => p === credPath);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      access_token: 'codex-token-123',
      expires_at: Date.now() + 3600000,
    }));

    const provider = detectProvider();
    expect(provider).not.toBeNull();
    expect(provider!.provider).toBe('openai');
    expect(provider!.source).toBe('codex-cli');
  });

  it('prefers env API key over CLI credentials', () => {
    process.env.OPENAI_API_KEY = 'sk-openai-from-env';
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;

    const credPath = path.join(os.homedir(), '.codex', 'auth.json');
    mockExistsSync.mockImplementation((p) => p === credPath);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      auth_mode: 'apikey',
      OPENAI_API_KEY: 'sk-proj-from-codex',
    }));

    const provider = detectProvider()!;
    expect(provider.source).toBe('env');
    expect(provider.apiKey).toBe('sk-openai-from-env');
  });
});

describe('resolveProviderChain', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns chain with single provider when only one is configured', () => {
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;
    mockExistsSync.mockReturnValue(false);

    const chain = resolveProviderChain();
    expect(chain.length).toBe(1);
    expect(chain[0].provider).toBe('openai');
  });

  it('returns chain ordered by priority: preferred > env keys > openrouter', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    process.env.PREFERRED_PROVIDER = 'openai';
    mockExistsSync.mockReturnValue(false);

    const chain = resolveProviderChain();
    expect(chain[0].provider).toBe('openai');
    expect(chain.some(c => c.provider === 'anthropic')).toBe(true);
  });

  it('returns empty chain when no credentials', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;
    mockExistsSync.mockReturnValue(false);

    const chain = resolveProviderChain();
    expect(chain.length).toBe(0);
  });

  it('deduplicates providers in chain', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.PREFERRED_PROVIDER = 'anthropic';
    mockExistsSync.mockReturnValue(false);

    const chain = resolveProviderChain();
    const anthropicCount = chain.filter(c => c.provider === 'anthropic').length;
    expect(anthropicCount).toBe(1);
  });

  it('includes pi-ai OAuth anthropic in provider chain', () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    delete process.env.OPENAI_API_KEY;
    delete process.env.PREFERRED_PROVIDER;

    const authPath = path.join(process.cwd(), 'auth.json');
    mockExistsSync.mockImplementation((p) => p === authPath);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      anthropic: { type: 'oauth', accessToken: 'test-token' },
    }));

    const chain = resolveProviderChain();
    expect(chain[0].provider).toBe('anthropic');
    expect(chain[0].source).toBe('pi-ai-oauth');
    expect(chain[1].provider).toBe('openrouter');
  });
});

describe('pi-ai OAuth detection', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('detects pi-ai OAuth credentials for anthropic', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;

    const authPath = path.join(process.cwd(), 'auth.json');
    mockExistsSync.mockImplementation((p) => p === authPath);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      anthropic: {
        type: 'oauth',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000,
      },
    }));

    const provider = detectProvider();
    expect(provider).not.toBeNull();
    expect(provider!.provider).toBe('anthropic');
    expect(provider!.source).toBe('pi-ai-oauth');
    expect(provider!.apiKey).toBe('__pi_ai_oauth__');
  });

  it('prefers env API key over pi-ai OAuth', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-from-env';
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;

    const authPath = path.join(process.cwd(), 'auth.json');
    mockExistsSync.mockImplementation((p) => p === authPath);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      anthropic: { type: 'oauth', accessToken: 'test-token' },
    }));

    const provider = detectProvider()!;
    expect(provider.source).toBe('env');
    expect(provider.apiKey).toBe('sk-ant-from-env');
  });

  it('uses PI_AI_AUTH_PATH env var for custom auth location', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;
    process.env.PI_AI_AUTH_PATH = '/custom/auth.json';

    mockExistsSync.mockImplementation((p) => p === '/custom/auth.json');
    mockReadFileSync.mockReturnValue(JSON.stringify({
      anthropic: { type: 'oauth', accessToken: 'custom-token' },
    }));

    const provider = detectProvider();
    expect(provider).not.toBeNull();
    expect(provider!.provider).toBe('anthropic');
    expect(provider!.source).toBe('pi-ai-oauth');

    delete process.env.PI_AI_AUTH_PATH;
  });

  it('returns null for readPiAiAuth when no auth.json exists', () => {
    delete process.env.PI_AI_AUTH_PATH;
    mockExistsSync.mockReturnValue(false);

    const auth = readPiAiAuth();
    expect(auth).toBeNull();
  });

  it('returns null for readPiAiAuth when auth.json is invalid JSON', () => {
    const authPath = path.join(process.cwd(), 'auth.json');
    mockExistsSync.mockImplementation((p) => p === authPath);
    mockReadFileSync.mockReturnValue('not-valid-json{{{');

    const auth = readPiAiAuth();
    expect(auth).toBeNull();
  });

  it('reads auth from PI_AI_AUTH_PATH when set', () => {
    process.env.PI_AI_AUTH_PATH = '/my/custom/auth.json';
    mockExistsSync.mockImplementation((p) => p === '/my/custom/auth.json');
    mockReadFileSync.mockReturnValue(JSON.stringify({
      anthropic: { type: 'oauth', accessToken: 'from-custom-path' },
    }));

    const auth = readPiAiAuth();
    expect(auth).not.toBeNull();
    expect(auth!.anthropic?.accessToken).toBe('from-custom-path');

    delete process.env.PI_AI_AUTH_PATH;
  });

  it('does not add pi-ai OAuth when anthropic already found via env', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env';
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;

    const authPath = path.join(process.cwd(), 'auth.json');
    mockExistsSync.mockImplementation((p) => p === authPath);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      anthropic: { type: 'oauth', accessToken: 'test-token' },
    }));

    const chain = resolveProviderChain();
    const anthropicProviders = chain.filter(c => c.provider === 'anthropic');
    expect(anthropicProviders).toHaveLength(1);
    expect(anthropicProviders[0].source).toBe('env');
  });

  it('detects pi-ai OAuth credentials for openai-codex', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;

    const authPath = path.join(process.cwd(), 'auth.json');
    mockExistsSync.mockImplementation((p) => p === authPath);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      'openai-codex': {
        type: 'oauth',
        accessToken: 'codex-oauth-token',
        refreshToken: 'codex-refresh',
        expiresAt: Date.now() + 3600000,
      },
    }));

    const provider = detectProvider();
    expect(provider).not.toBeNull();
    expect(provider!.provider).toBe('openai');
    expect(provider!.source).toBe('pi-ai-oauth');
    expect(provider!.apiKey).toBe('__pi_ai_oauth__');
  });

  it('prefers env OPENAI_API_KEY over pi-ai OAuth codex', () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-openai-from-env';
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;

    const authPath = path.join(process.cwd(), 'auth.json');
    mockExistsSync.mockImplementation((p) => p === authPath);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      'openai-codex': { type: 'oauth', accessToken: 'codex-token' },
    }));

    const provider = detectProvider()!;
    expect(provider.source).toBe('env');
    expect(provider.apiKey).toBe('sk-openai-from-env');
  });

  it('detects both anthropic and codex OAuth from same auth.json', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;

    const authPath = path.join(process.cwd(), 'auth.json');
    mockExistsSync.mockImplementation((p) => p === authPath);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      anthropic: { type: 'oauth', accessToken: 'ant-token' },
      'openai-codex': { type: 'oauth', accessToken: 'codex-token' },
    }));

    const chain = resolveProviderChain();
    expect(chain).toHaveLength(2);
    expect(chain[0].provider).toBe('anthropic');
    expect(chain[0].source).toBe('pi-ai-oauth');
    expect(chain[1].provider).toBe('openai');
    expect(chain[1].source).toBe('pi-ai-oauth');
  });

  it('codex OAuth has lower priority than codex CLI', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.PREFERRED_PROVIDER;

    const codexPath = path.join(os.homedir(), '.codex', 'auth.json');
    const piAiPath = path.join(process.cwd(), 'auth.json');
    mockExistsSync.mockImplementation((p) => p === codexPath || p === piAiPath);
    mockReadFileSync.mockImplementation((p) => {
      if (p === codexPath) return JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: 'sk-from-codex-cli' });
      if (p === piAiPath) return JSON.stringify({ 'openai-codex': { type: 'oauth', accessToken: 'codex-oauth' } });
      throw new Error('unexpected path');
    });

    const provider = detectProvider()!;
    // pi-ai-oauth has HIGHER priority than codex-cli
    expect(provider.source).toBe('pi-ai-oauth');
    expect(provider.provider).toBe('openai');
  });
});
