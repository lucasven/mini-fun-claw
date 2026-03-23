# 🤖 Mini Fun Claw

> A free, customizable AI friend for your WhatsApp group.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

Minimal WhatsApp bot powered by **20+ free AI models** via [OpenRouter](https://openrouter.ai). Runs locally, connects via QR code, responds with whatever personality you give it. Zero cost, zero hosting, zero database.

## ⚡ Quick Start

```bash
git clone https://github.com/lucasven/mini-fun-claw.git
cd mini-fun-claw && npm install
cp .env.example .env  # add your free OpenRouter key
npm start             # scan QR code → done
```

Get your free API key at [openrouter.ai/keys](https://openrouter.ai/keys).

## ✨ Features

- 🆓 **100% free** — OpenRouter free-tier models, no credit card
- 🔄 **Auto-fallback** — 21 models in chain, tries next on failure (429/503/timeout)
- 🎭 **Custom personas** — drop-in `SOUL.md` + `AGENTS.md` files define who the bot *is*
- 🔐 **Group whitelist** — only responds in authorized groups, ignores DMs
- 💬 **Smart response rate** — configurable probability (default 10%) so it doesn't spam the group
- 🗣️ **Conversation memory** — keeps last 15 messages per group for multi-turn context
- 🔑 **Multi-provider** — OpenRouter, OpenAI, Anthropic, Codex CLI (free via OAuth!)
- ⏱️ **30s cooldown** — models that return 429 are skipped temporarily
- 🚫 **[SKIP] protocol** — persona can choose *not to respond* to irrelevant messages

## 🎭 Personas

The bot reads `SOUL.md` (who it is) and `AGENTS.md` (how it behaves) from the project root. Three examples included:

### 🎉 Party Bot (`personas/fun/`)
> *"BOM DIAAAA! 🌅🔥 Hoje vai ser épico, pode confiar!"*

Energetic, emoji-heavy, turns boring questions into fun answers. Always upbeat.

### 📚 Professor (`personas/serious/`)
> Clear, structured explanations with analogies. Asks for clarification when needed.

Calm, professional, fact-first. Uses lists for multi-point answers. Max 1 emoji.

### 🔧 Dev Helper (`personas/tech/`)
> Pragmatic senior dev. Shows code, mentions edge cases, says "it depends" when it does.

Technical, concise, opinionated. TDD evangelist. Warns about insecure code.

**To use a persona:**

```bash
cp personas/tech/SOUL.md SOUL.md
cp personas/tech/AGENTS.md AGENTS.md
npm start
```

Or write your own — just edit `SOUL.md` and `AGENTS.md`.

## 🔑 Providers

| Tier | Provider | Setup | Cost |
|------|----------|-------|------|
| **Free** | OpenRouter | `OPENROUTER_API_KEY` in `.env` | $0 |
| **Premium** | Anthropic | `ANTHROPIC_API_KEY` in `.env` | API pricing |
| **Premium** | OpenAI | `OPENAI_API_KEY` in `.env` | API pricing |
| **Subscription** | Claude (OAuth) | `npx @mariozechner/pi-ai login anthropic` | $0 (uses your sub) |
| **Subscription** | ChatGPT (OAuth) | `npx @mariozechner/pi-ai login openai-codex` | $0 (uses your sub) |
| **CLI** | Codex CLI | `~/.codex/auth.json` auto-detected | Depends on plan |

**Priority order:** env API key → OAuth subscription → Codex CLI → OpenRouter free tier.

### Using Claude Subscription (OAuth — Free!)

If you have a Claude Pro, Max, or Team subscription:

```bash
npx @mariozechner/pi-ai login anthropic
# Browser opens → log in → credentials saved to auth.json
npm start  # auto-detected
```

### Using ChatGPT Subscription (OAuth — Free!)

If you have a ChatGPT Plus or Pro subscription:

```bash
npx @mariozechner/pi-ai login openai-codex
# Browser opens → log in → credentials saved to auth.json
npm start  # auto-detected
```

> **Tip:** You can have both configured. The bot tries the first available and falls back to the next.

Tokens are auto-refreshed on expiry. Set `PREFERRED_PROVIDER=anthropic` to force a specific provider.

## 🤖 Models

21 free models via OpenRouter, organized in 3 tiers:

### Tier 1 — Large (best quality)
| Model | Context |
|-------|---------|
| Hermes 3 405B | 128K |
| Nemotron Super 120B | 256K |
| GPT-OSS 120B | 128K |
| Llama 3.3 70B | 64K |
| Qwen 3 Next 80B | 256K |

### Tier 2 — Medium (good quality, faster)
| Model | Context |
|-------|---------|
| Mistral Small 3.1 | 128K |
| Nemotron Nano 30B | 256K |
| Gemma 3 27B | 128K |
| MiniMax M2.5 | 192K |
| Dolphin Mistral 24B | 32K |
| Step 3.5 Flash | 256K |
| GLM 4.5 Air | 128K |
| Qwen 3 Coder | 256K |
| GPT-OSS 20B | 128K |

### Tier 3 — Small (fast fallback)
| Model | Context |
|-------|---------|
| Gemma 3 12B | 32K |
| Nemotron Nano 9B | 128K |
| Trinity Large | 128K |
| Trinity Mini | 128K |
| Qwen 3 4B | 40K |
| Gemma 3 4B | 32K |
| Llama 3.2 3B | 128K |

If a model is unavailable, the bot automatically tries the next one. If **all** fail, it stays quiet.

## 📁 Structure

```
mini-fun-claw/
├── src/
│   ├── index.ts          # Entry point
│   ├── config.ts         # Loads .env + validation
│   ├── whatsapp.ts       # Baileys connection + message handling
│   ├── llm.ts            # Multi-provider chat + OpenRouter fallback chain
│   ├── provider.ts       # Provider detection (env, OAuth, CLI)
│   ├── persona.ts        # Loads SOUL.md + AGENTS.md
│   └── types.ts          # TypeScript interfaces
├── personas/             # Example personalities
│   ├── fun/              # 🎉 Party Bot
│   ├── serious/          # 📚 Professor
│   └── tech/             # 🔧 Dev Helper
├── SOUL.md               # Active personality (your choice)
├── AGENTS.md             # Active behavior rules
├── .env.example          # Configuration template
└── package.json
```

## 🧪 Tests

```bash
npm test
```

## ❓ FAQ

**Is it really free?**
Yes. OpenRouter offers free-tier models with generous rate limits. OAuth uses your existing subscription. Zero extra cost.

**Do I need a dedicated phone number?**
No. Uses your personal WhatsApp. But a separate number is recommended to keep things clean.

**What happens when a free model goes down?**
The bot tries the next model in the chain. 21 models means high availability. If all fail simultaneously, it stays silent (no error messages in the group).

**Can I use it in multiple groups?**
Yes. Add multiple JIDs comma-separated in `GROUP_WHITELIST`. Each group has independent conversation history.

**How do I find my group's JID?**
Start the bot without `GROUP_WHITELIST`, send a message in the group, check the logs for the JID (`120363xxxxx@g.us`), add it to `.env`.

## 📄 License

[MIT](LICENSE) — use, modify, distribute freely.

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

Built with 🔨 by [OpenClaw](https://github.com/openclaw/openclaw).
