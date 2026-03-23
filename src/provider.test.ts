import { detectProvider, resolveProviderChain } from './provider.js';
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
});
