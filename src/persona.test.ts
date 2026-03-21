import { loadPersona, buildSystemPrompt } from './persona.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('loadPersona', () => {
  const testDir = join(tmpdir(), `mini-fun-claw-test-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  });

  it('returns defaults when no files exist', () => {
    const emptyDir = join(testDir, 'empty');
    mkdirSync(emptyDir, { recursive: true });
    const persona = loadPersona(emptyDir);
    expect(persona.soul).toContain('casual member');
    expect(persona.agents).toContain('1-2 frases');
  });

  it('reads SOUL.md when present', () => {
    const dir = join(testDir, 'with-soul');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SOUL.md'), 'You are a pirate. Arr!');
    const persona = loadPersona(dir);
    expect(persona.soul).toBe('You are a pirate. Arr!');
  });

  it('reads AGENTS.md when present', () => {
    const dir = join(testDir, 'with-agents');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'AGENTS.md'), '## Rules\n- Be cool');
    const persona = loadPersona(dir);
    expect(persona.agents).toBe('## Rules\n- Be cool');
  });

  it('reads both files', () => {
    const dir = join(testDir, 'with-both');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SOUL.md'), 'Soul content');
    writeFileSync(join(dir, 'AGENTS.md'), 'Agents content');
    const persona = loadPersona(dir);
    expect(persona.soul).toBe('Soul content');
    expect(persona.agents).toBe('Agents content');
  });

  it('trims whitespace', () => {
    const dir = join(testDir, 'trim');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SOUL.md'), '  \n  Hello  \n  ');
    const persona = loadPersona(dir);
    expect(persona.soul).toBe('Hello');
  });
});

describe('buildSystemPrompt', () => {
  it('combines soul and agents with separator', () => {
    const prompt = buildSystemPrompt({ soul: 'Be nice', agents: 'Keep short' });
    expect(prompt).toBe('Be nice\n\n---\n\nKeep short');
  });

  it('includes both sections', () => {
    const prompt = buildSystemPrompt({ soul: 'SOUL', agents: 'AGENTS' });
    expect(prompt).toContain('SOUL');
    expect(prompt).toContain('AGENTS');
  });
});
