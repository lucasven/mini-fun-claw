import type { FreeModel, LlmResponse } from './types.js';

/**
 * Curated list of OpenRouter free models, ordered by capability.
 * These are models with `:free` suffix on OpenRouter.
 * Updated: 2026-03-21. Check https://openrouter.ai/models for latest.
 * IDs change frequently — verify with: curl https://openrouter.ai/api/v1/models | jq '.data[].id' | grep free
 */
const FREE_MODELS: FreeModel[] = [
  // Tier 1: Large models (best quality)
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B', contextLength: 131072 },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron Super 120B', contextLength: 262144 },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B', contextLength: 131072 },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', contextLength: 65536 },
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free', name: 'Qwen 3 Next 80B', contextLength: 262144 },
  // Tier 2: Medium models (good quality, faster)
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', contextLength: 128000 },
  { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'Nemotron Nano 30B', contextLength: 256000 },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', contextLength: 131072 },
  { id: 'minimax/minimax-m2.5:free', name: 'MiniMax M2.5', contextLength: 196608 },
  { id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', name: 'Dolphin Mistral 24B', contextLength: 32768 },
  { id: 'stepfun/step-3.5-flash:free', name: 'Step 3.5 Flash', contextLength: 256000 },
  { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air', contextLength: 131072 },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen 3 Coder', contextLength: 262000 },
  { id: 'openai/gpt-oss-20b:free', name: 'GPT-OSS 20B', contextLength: 131072 },
  // Tier 3: Small models (fast fallback)
  { id: 'google/gemma-3-12b-it:free', name: 'Gemma 3 12B', contextLength: 32768 },
  { id: 'nvidia/nemotron-nano-9b-v2:free', name: 'Nemotron Nano 9B', contextLength: 128000 },
  { id: 'arcee-ai/trinity-large-preview:free', name: 'Trinity Large', contextLength: 131000 },
  { id: 'arcee-ai/trinity-mini:free', name: 'Trinity Mini', contextLength: 131072 },
  { id: 'qwen/qwen3-4b:free', name: 'Qwen 3 4B', contextLength: 40960 },
  { id: 'google/gemma-3-4b-it:free', name: 'Gemma 3 4B', contextLength: 32768 },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', contextLength: 131072 },
];

const RETRYABLE_STATUS_CODES = [429, 503, 502, 500];
const REQUEST_TIMEOUT_MS = 30_000;
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes cooldown after 429

/** Track models that returned 429 recently — skip them to save time */
const cooldownMap = new Map<string, number>();

function isOnCooldown(modelId: string): boolean {
  const until = cooldownMap.get(modelId);
  if (!until) return false;
  if (Date.now() > until) {
    cooldownMap.delete(modelId);
    return false;
  }
  return true;
}

function setCooldown(modelId: string): void {
  cooldownMap.set(modelId, Date.now() + COOLDOWN_MS);
}

export function getFreeModels(): FreeModel[] {
  return [...FREE_MODELS];
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface HistoryMessage {
  role: 'user' | 'assistant';
  name?: string;
  content: string;
}

interface ChatOptions {
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  models?: FreeModel[];
  /** Conversation history (last N messages) for multi-turn context */
  history?: HistoryMessage[];
}

export async function chat(options: ChatOptions): Promise<LlmResponse | null> {
  const { apiKey, systemPrompt, userMessage, models = FREE_MODELS, history = [] } = options;

  // Build messages: system prompt + conversation history + current message
  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (all except the last user message which we add separately)
  // History already includes the current message, so we use all of it
  for (const msg of history.slice(0, -1)) {
    messages.push({ role: msg.role, content: msg.name ? `[${msg.name}]: ${msg.content}` : msg.content });
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  for (const model of models) {
    // Skip models on cooldown (recently returned 429)
    if (isOnCooldown(model.id)) {
      continue;
    }

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
            max_tokens: 50,
            temperature: 0.7,
          }),
        },
        REQUEST_TIMEOUT_MS,
      );

      if (response.status === 429) {
        setCooldown(model.id);
        console.warn(`⚠️  ${model.name} → 429, cooldown 2min`);
        continue;
      }

      if (RETRYABLE_STATUS_CODES.includes(response.status)) {
        console.warn(`⚠️  ${model.name} → ${response.status}`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown error');
        console.warn(`⚠️  ${model.name} → ${response.status}: ${errorText.slice(0, 100)}`);
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
        console.warn(`⚠️  ${model.name} empty response`);
        continue;
      }

      return { content, model: model.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️  ${model.name}: ${msg}`);
      continue;
    }
  }

  // All models failed — return null to signal "don't respond"
  return null;
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
