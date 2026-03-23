# Contributing to Mini Fun Claw

Thanks for considering contributing! Here's how to get started.

## Prerequisites

- Node.js 18+
- npm
- A WhatsApp account (for testing)

## Setup

```bash
git clone https://github.com/lucasven/mini-fun-claw.git
cd mini-fun-claw
npm install
cp .env.example .env
# Edit .env with your OpenRouter key (free at https://openrouter.ai/keys)
npm start
```

## Development

```bash
npm test          # Run tests
npx tsc --noEmit  # Type check
```

### Coding Standards

- **TypeScript** — strict mode, no `any` unless necessary
- **Tests required** — new features need tests, bug fixes need regression tests
- **Short responses** — the bot should talk like a person, not an AI
- **Keep it simple** — if it's getting complex, refactor

### File Structure

| File | Purpose |
|------|---------|
| `src/whatsapp.ts` | Baileys connection + message handling |
| `src/llm.ts` | Multi-provider LLM with fallback |
| `src/provider.ts` | Provider detection (env, OAuth, CLI) |
| `src/persona.ts` | Loads SOUL.md + AGENTS.md |
| `src/config.ts` | Environment config + validation |

## Pull Request Process

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Write tests first (TDD encouraged)
4. Make your changes
5. Run `npm test` and `npx tsc --noEmit`
6. Commit with conventional commits (`feat:`, `fix:`, `docs:`)
7. Open a PR

## Issues

Found a bug? Have an idea? [Open an issue](https://github.com/lucasven/mini-fun-claw/issues).

Look for issues labeled `good first issue` if you're new here.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind.
