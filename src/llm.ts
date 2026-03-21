import type { FreeModel, LlmResponse } from './types.js';

/**
 * Curated list of OpenRouter free models, ordered by capability.
 * These are models with `:free` suffix on OpenRouter.
 * Updated: 2026-03-21. Check https://openrouter.ai/models for latest.
 * IDs change frequently — verify with: curl https://openrouter.ai/api/v1/models | jq '.data[].id' | grep free
 */
const FREE_MODELS: FreeModel[] = [
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B', contextLength: 131072 },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron Super 120B', contextLength: 262144 },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B', contextLength: 131072 },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', contextLength: 65536 },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', contextLength: 128000 },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', contextLength: 131072 },
  { id: 'minimax/minimax-m2.5:free', name: 'MiniMax M2.5', contextLength: 196608 },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen 3 Coder', contextLength: 262000 },
  { id: 'google/gemma-3-12b-it:free', name: 'Gemma 3 12B', contextLength: 32768 },
  { id: 'google/gemma-3-4b-it:free', name: 'Gemma 3 4B', contextLength: 32768 },
];

const RETRYABLE_STATUS_CODES = [429, 503, 502, 500];
const REQUEST_TIMEOUT_MS = 30_000;

export function getFreeModels(): FreeModel[] {
  return [...FREE_MODELS];
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  models?: FreeModel[];
}

export async function chat(options: ChatOptions): Promise<LlmResponse> {
  const { apiKey, systemPrompt, userMessage, models = FREE_MODELS } = options;

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  for (const model of models) {
    try {
      const response = await fetchWithTimeout(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'X-Title': 'Mini Fun Claw',
          },
          body: JSON.stringify({
            model: model.id,
            messages,
            max_tokens: 1024,
            temperature: 0.7,
          }),
        },
        REQUEST_TIMEOUT_MS,
      );

      if (RETRYABLE_STATUS_CODES.includes(response.status)) {
        console.warn(`⚠️  ${model.name} returned ${response.status}, trying next model...`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown error');
        console.warn(`⚠️  ${model.name} returned ${response.status}: ${errorText.slice(0, 200)}`);
        continue;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };

      if (data.error) {
        console.warn(`⚠️  ${model.name} error: ${data.error.message}`);
        continue;
      }

      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        console.warn(`⚠️  ${model.name} returned empty content, trying next...`);
        continue;
      }

      return { content, model: model.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️  ${model.name} failed: ${msg}, trying next...`);
      continue;
    }
  }

  return {
    content: '😅 Estou sem acesso a modelos no momento. Tenta de novo em alguns minutos!',
    model: 'none',
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
