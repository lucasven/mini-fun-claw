# 🤖 Mini Fun Claw

> Drop an AI friend into any WhatsApp group. Free, customizable, open source.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js&logoColor=white)](https://nodejs.org/)

Mini Fun Claw is a minimalist WhatsApp bot that uses **free AI models** via [OpenRouter](https://openrouter.ai). Runs on your machine, connects via QR code, responds in groups with any personality you want.

**Zero cost. No hosting. No database.**

## ⚡ Quick Start

```bash
git clone https://github.com/lucasven/mini-fun-claw.git
cd mini-fun-claw
npm install
cp .env.example .env   # add your free OpenRouter key
npm start              # scan QR code → done!
```

Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys).

## ✨ Features

- 🆓 **100% free** — 20+ free models via OpenRouter, zero API costs
- 🔄 **Auto-fallback** — if a model is down, tries the next one automatically
- 🎭 **Custom personas** — define personality via `SOUL.md` + `AGENTS.md`
- 🔐 **Group whitelist** — only responds in authorized groups
- 💬 **Smart response rate** — responds to ~10% of messages so it doesn't spam
- 📩 **Reply/mention bypass** — always responds when directly addressed
- 🔑 **Multi-provider** — OpenRouter, OpenAI, Anthropic (free via OAuth subscription!)
- 🧊 **Cooldown** — auto-skips models that return 429, retries after 30s
- 🤫 **Silent on failure** — if all models fail, stays quiet instead of sending cringe

## 🎭 Personas

The bot reads `SOUL.md` (who it is) and `AGENTS.md` (how it behaves) from the project root. Three examples included:

| Persona | Vibe | Use with |
|---------|------|----------|
| 🎉 `personas/fun/` | Party Bot — animated, emojis, jokes | Casual friend groups |
| 📚 `personas/serious/` | Professor — calm, informative, structured | Study/work groups |
| 🔧 `personas/tech/` | Dev Helper — pragmatic, code-focused, TDD | Developer groups |

```bash
cp personas/tech/SOUL.md SOUL.md
cp personas/tech/AGENTS.md AGENTS.md
npm start
```

Or create your own — just edit `SOUL.md` and `AGENTS.md`.

## 🔑 Providers

| Provider | Cost | Setup |
|----------|------|-------|
| **OpenRouter** | Free | `OPENROUTER_API_KEY=sk-or-...` in `.env` |
| **Anthropic** (API key) | Paid | `ANTHROPIC_API_KEY=sk-ant-...` in `.env` |
| **OpenAI** (API key) | Paid | `OPENAI_API_KEY=sk-...` in `.env` |
| **Claude subscription** | $0* | `npx @mariozechner/pi-ai login anthropic` |
| **ChatGPT subscription** | $0* | `npx @mariozechner/pi-ai login openai-codex` |

\*Uses your existing Claude Pro/Max/Team or ChatGPT Plus/Pro subscription. No extra API costs.

**Priority:** env API key → OAuth subscription → Codex CLI → OpenRouter free

### OAuth Setup (use your subscription for free)

```bash
# Claude Pro/Max/Team
npx @mariozechner/pi-ai login anthropic

# ChatGPT Plus/Pro
npx @mariozechner/pi-ai login openai-codex
```

Opens a browser window to authenticate. Credentials saved to `auth.json`. Bot auto-detects on startup and refreshes expired tokens automatically.

## 🤖 Free Models

20+ free models in 3 tiers, tried in order:

| Tier | Models | Quality |
|------|--------|---------|
| **Large** | Hermes 3 405B, Nemotron 120B, GPT-OSS 120B, Llama 3.3 70B | Best |
| **Medium** | Mistral Small 3.1, Gemma 3 27B, MiniMax M2.5, Dolphin 24B | Good |
| **Small** | Gemma 3 12B, Nemotron 9B, Trinity Mini, Qwen 3 4B | Fast fallback |

If a model returns 429, it's automatically cooled down for 30s and the next one is tried.

## 📁 Structure

```
mini-fun-claw/
├── src/
│   ├── index.ts        # Entry point
│   ├── config.ts       # Loads .env + validation
│   ├── whatsapp.ts     # Baileys connection + message handling
│   ├── llm.ts          # Multi-provider LLM with fallback
│   ├── provider.ts     # Provider detection (env, OAuth, CLI)
│   ├── persona.ts      # Loads SOUL.md + AGENTS.md
│   └── types.ts        # TypeScript interfaces
├── personas/           # Example personalities
├── SOUL.md             # Active personality
├── AGENTS.md           # Active behavior rules
├── .env.example        # Config template
└── auth.json           # OAuth credentials (auto-generated, gitignored)
```

## 🧪 Tests

```bash
npm test     # 66 tests
```

## 🔒 Security

- **Whitelist only** — ignores messages from non-whitelisted groups
- **No DMs** — never responds to private messages
- **Read-only** — doesn't send unprompted messages
- **Stateless** — no message storage, no database

## ❓ FAQ

**Is it really free?**
Yes. OpenRouter free-tier models have generous rate limits. Zero cost.

**Do I need a separate phone number?**
No, but recommended. Uses your personal WhatsApp via QR code.

**What if OpenRouter changes free models?**
Edit the list in `src/llm.ts`. The fallback chain keeps working.

**Can I use it in multiple groups?**
Yes. Add multiple JIDs to `GROUP_WHITELIST` (comma-separated).

**How do I find my group JID?**
Start the bot without `GROUP_WHITELIST`, send a message in the group, check the logs.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

[MIT](LICENSE) — use, modify, distribute freely.

---

Built with 🔨 by [Turing](https://github.com/openclaw/openclaw) for [Lucas Venturella](https://github.com/lucasven).
