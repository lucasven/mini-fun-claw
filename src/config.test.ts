import { loadConfig, isGroupAllowed, isGroupMessage, shouldRespond } from './config.js';

describe('loadConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('throws when OPENROUTER_API_KEY is missing', () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.GROUP_WHITELIST = '123@g.us';
    expect(() => loadConfig()).toThrow('OPENROUTER_API_KEY is required');
  });

  it('returns empty whitelist with warning when GROUP_WHITELIST is empty', () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    process.env.GROUP_WHITELIST = '';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const config = loadConfig();
    expect(config.groupWhitelist).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('GROUP_WHITELIST is empty'));
    warnSpy.mockRestore();
  });

  it('returns empty whitelist with warning when GROUP_WHITELIST is missing', () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    delete process.env.GROUP_WHITELIST;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const config = loadConfig();
    expect(config.groupWhitelist).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('GROUP_WHITELIST is empty'));
    warnSpy.mockRestore();
  });

  it('loads valid config', () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-key';
    process.env.GROUP_WHITELIST = '123@g.us, 456@g.us';
    process.env.BOT_PREFIX = '!bot';
    process.env.LOG_LEVEL = 'debug';

    const config = loadConfig();
    expect(config.openrouterApiKey).toBe('sk-test-key');
    expect(config.groupWhitelist).toEqual(['123@g.us', '456@g.us']);
    expect(config.botPrefix).toBe('!bot');
    expect(config.logLevel).toBe('debug');
  });

  it('uses defaults for optional fields', () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    process.env.GROUP_WHITELIST = '123@g.us';
    delete process.env.BOT_PREFIX;
    delete process.env.LOG_LEVEL;

    const config = loadConfig();
    expect(config.botPrefix).toBe('');
    expect(config.logLevel).toBe('info');
  });

  it('trims and filters whitelist entries', () => {
    process.env.OPENROUTER_API_KEY = 'sk-test';
    process.env.GROUP_WHITELIST = ' 123@g.us ,  , 456@g.us ';

    const config = loadConfig();
    expect(config.groupWhitelist).toEqual(['123@g.us', '456@g.us']);
  });
});

describe('isGroupAllowed', () => {
  const whitelist = ['120363000000000000@g.us', '120363111111111111@g.us'];

  it('returns true for whitelisted JID', () => {
    expect(isGroupAllowed('120363000000000000@g.us', whitelist)).toBe(true);
  });

  it('returns false for non-whitelisted JID', () => {
    expect(isGroupAllowed('120363999999999999@g.us', whitelist)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isGroupAllowed('', whitelist)).toBe(false);
  });
});

describe('isGroupMessage', () => {
  it('returns true for group JID', () => {
    expect(isGroupMessage('120363000000000000@g.us')).toBe(true);
  });

  it('returns false for DM JID', () => {
    expect(isGroupMessage('5511999999999@s.whatsapp.net')).toBe(false);
  });

  it('returns false for broadcast', () => {
    expect(isGroupMessage('status@broadcast')).toBe(false);
  });
});

describe('shouldRespond', () => {
  it('responds to all messages when prefix is empty', () => {
    const result = shouldRespond('hello world', '');
    expect(result).toEqual({ respond: true, cleanText: 'hello world' });
  });

  it('responds when message starts with prefix', () => {
    const result = shouldRespond('!claw what is AI?', '!claw');
    expect(result).toEqual({ respond: true, cleanText: 'what is AI?' });
  });

  it('prefix is case-insensitive', () => {
    const result = shouldRespond('!CLAW tell me a joke', '!claw');
    expect(result).toEqual({ respond: true, cleanText: 'tell me a joke' });
  });

  it('does not respond when prefix does not match', () => {
    const result = shouldRespond('hello world', '!claw');
    expect(result).toEqual({ respond: false, cleanText: '' });
  });

  it('does not respond when prefix is partial match of another word', () => {
    const result = shouldRespond('!clawback money', '!claw');
    expect(result).toEqual({ respond: false, cleanText: '' });
  });

  it('handles leading whitespace before prefix', () => {
    const result = shouldRespond('  !claw what time is it', '!claw');
    expect(result).toEqual({ respond: true, cleanText: 'what time is it' });
  });

  it('returns empty cleanText when prefix-only message', () => {
    const result = shouldRespond('!claw', '!claw');
    expect(result).toEqual({ respond: true, cleanText: '' });
  });
});
