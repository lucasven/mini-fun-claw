import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Persona } from './types.js';

const DEFAULT_SOUL = `You are a friendly AI assistant in a WhatsApp group.
Be helpful, concise, and fun. Match the group's energy.
Respond in the same language as the message you receive.`;

const DEFAULT_AGENTS = `## Regras
- Respostas curtas e diretas (WhatsApp, não email)
- Máximo 3 parágrafos
- Use emojis com moderação
- Se não sabe, diz "não sei" — não inventa`;

export function loadPersona(basePath: string = process.cwd()): Persona {
  const soulPath = resolve(basePath, 'SOUL.md');
  const agentsPath = resolve(basePath, 'AGENTS.md');

  const soul = existsSync(soulPath)
    ? readFileSync(soulPath, 'utf-8').trim()
    : DEFAULT_SOUL;

  const agents = existsSync(agentsPath)
    ? readFileSync(agentsPath, 'utf-8').trim()
    : DEFAULT_AGENTS;

  return { soul, agents };
}

export function buildSystemPrompt(persona: Persona): string {
  return `${persona.soul}\n\n---\n\n${persona.agents}`;
}
