import { getFreeModels, chat } from './llm.js';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as never;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('getFreeModels', () => {
  it('returns a non-empty list', () => {
    const models = getFreeModels();
    expect(models.length).toBeGreaterThan(0);
  });

  it('all models have :free suffix', () => {
    const models = getFreeModels();
    for (const m of models) {
      expect(m.id).toContain(':free');
    }
  });

  it('returns a copy (not the original array)', () => {
    const a = getFreeModels();
    const b = getFreeModels();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('chat', () => {
  const baseOptions = {
    apiKey: 'sk-test',
    systemPrompt: 'Be nice',
    userMessage: 'Hello',
  };

  it('returns content from first successful model', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Hi there!' } }],
      }),
    });

    const result = await chat(baseOptions);
    expect(result!.content).toBe('Hi there!');
    expect(result!.model).toContain(':free');
  });

  it('falls back to next model on 429', async () => {
    // First model: 429
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    });

    // Second model: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'From model 2!' } }],
      }),
    });

    const result = await chat(baseOptions);
    expect(result!.content).toBe('From model 2!');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('falls back on 503', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'service unavailable',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'OK' } }],
      }),
    });

    const result = await chat(baseOptions);
    expect(result!.content).toBe('OK');
  });

  it('falls back on 500', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Got it' } }],
      }),
    });

    const result = await chat(baseOptions);
    expect(result!.content).toBe('Got it');
  });

  it('falls back on API error in response body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        error: { message: 'Model overloaded' },
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Fallback response' } }],
      }),
    });

    const result = await chat(baseOptions);
    expect(result!.content).toBe('Fallback response');
  });

  it('falls back on empty content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '' } }],
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Not empty!' } }],
      }),
    });

    const result = await chat(baseOptions);
    expect(result!.content).toBe('Not empty!');
  });

  it('falls back on fetch error (network)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'After network error' } }],
      }),
    });

    const result = await chat(baseOptions);
    expect(result!.content).toBe('After network error');
  });

  it('returns graceful degradation when all models fail', async () => {
    const tinyModels = [
      { id: 'test/model-a:free', name: 'A', contextLength: 1000 },
      { id: 'test/model-b:free', name: 'B', contextLength: 1000 },
    ];

    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    });

    const result = await chat({ ...baseOptions, models: tinyModels });
    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('sends correct request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    });

    await chat({
      ...baseOptions,
      models: [{ id: 'test/model:free', name: 'Test', contextLength: 1000 }],
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('test/model:free');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('Be nice');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toBe('Hello');

    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-test');
    expect(headers['X-Title']).toBe('Mini Fun Claw');
  });

  it('falls back on non-retryable error status (e.g., 401)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'After 401' } }],
      }),
    });

    const result = await chat(baseOptions);
    expect(result!.content).toBe('After 401');
  });
});
