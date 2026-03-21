# 🤖 Mini Fun Claw

> Um amigo IA no seu grupo de WhatsApp. Grátis, customizável, open source.

Mini Fun Claw é um bot WhatsApp minimalista que usa modelos de IA **100% grátis** via [OpenRouter](https://openrouter.ai). Roda no seu computador, conecta via QR code, e responde no grupo com a personalidade que você escolher.

**Zero custo.** Sem API keys pagas, sem hosting, sem banco de dados.

## ⚡ Setup em 5 minutos

### 1. Clone e instale

```bash
git clone https://github.com/lucasven/mini-fun-claw.git
cd mini-fun-claw
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edite `.env`:

```env
# Pegue sua key grátis em https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# JIDs dos grupos autorizados (veja seção "Como encontrar o JID")
GROUP_WHITELIST=120363000000000000@g.us

# Opcional: prefixo pra ativar o bot (vazio = responde tudo)
BOT_PREFIX=!claw

# Taxa de resposta aleatória (0.0 a 1.0). Default: 0.1 = 10%
# O bot só responde a ~10% das mensagens pra não dominar o grupo.
# Menções diretas e replies ao bot sempre respondem (bypass).
RESPONSE_RATE=0.1
```

### 3. Inicie

```bash
npm start
```

Escaneie o QR code com seu WhatsApp. Pronto! 🎉

## 🔑 Como encontrar o JID do grupo

1. Inicie o bot sem `GROUP_WHITELIST` (vai logar mas não responder nada)
2. Mande uma mensagem no grupo
3. Olhe os logs — o JID aparece como `120363xxxxx@g.us`
4. Adicione no `.env` e reinicie

## 🎭 Personalidade customizável

O bot lê dois arquivos na raiz do projeto:

| Arquivo | O que faz |
|---------|-----------|
| `SOUL.md` | Define quem o bot **é** — personalidade, tom, valores |
| `AGENTS.md` | Define como o bot **age** — regras, formato, limites |

### Personas incluídas

O repo inclui 3 exemplos na pasta `personas/`:

| Persona | Descrição |
|---------|-----------|
| `personas/fun/` | 🎉 Party Bot — animado, emojis, piadas |
| `personas/serious/` | 📚 Professor — informativo, calmo, estruturado |
| `personas/tech/` | 🔧 Dev Helper — pragmático, código, TDD |

Para usar uma persona, copie os arquivos:

```bash
cp personas/tech/SOUL.md SOUL.md
cp personas/tech/AGENTS.md AGENTS.md
npm start
```

Ou crie a sua! Só editar `SOUL.md` e `AGENTS.md`.

## 🔒 Segurança

- **Whitelist obrigatória** — só responde em grupos autorizados
- **Ignora DMs** — não responde em conversas privadas
- **Não envia nada sozinho** — só responde quando recebe mensagem
- **Stateless** — não armazena mensagens ou dados

## 🤖 Modelos grátis

O bot usa modelos gratuitos do OpenRouter, em ordem de capacidade:

1. Gemini 2.0 Flash
2. Gemma 3 27B
3. Llama 3.3 70B
4. Qwen 2.5 72B
5. DeepSeek V3
6. Mistral Small 3.1
7. ...e mais

Se um modelo estiver indisponível (429/503), o bot automaticamente tenta o próximo. Se **todos** falharem, avisa no grupo educadamente.

## 📁 Estrutura

```
mini-fun-claw/
├── src/
│   ├── index.ts        # Entry point
│   ├── config.ts       # Carrega .env + validação
│   ├── whatsapp.ts     # Conexão Baileys + message handling
│   ├── llm.ts          # OpenRouter com fallback automático
│   ├── persona.ts      # Carrega SOUL.md + AGENTS.md
│   └── types.ts        # TypeScript interfaces
├── personas/           # Exemplos de personalidade
│   ├── fun/
│   ├── serious/
│   └── tech/
├── SOUL.md             # Personalidade ativa
├── AGENTS.md           # Regras operacionais ativas
├── .env.example        # Template de configuração
└── package.json
```

## 🧪 Testes

```bash
npm test
```

## ❓ FAQ

**P: É grátis mesmo?**
R: Sim. OpenRouter oferece modelos grátis com rate limits generosos. Zero custo.

**P: Precisa de número dedicado?**
R: Não. Usa seu WhatsApp pessoal. Mas recomendamos um número separado pra não misturar.

**P: Funciona no WhatsApp Business?**
R: Sim, Baileys funciona com ambos.

**P: Os modelos grátis são bons?**
R: Surpreendentemente sim. Gemini Flash e Llama 3.3 70B são muito capazes.

**P: E se o OpenRouter mudar os modelos grátis?**
R: Edite a lista em `src/llm.ts`. A estrutura de fallback continua funcionando.

## 📄 License

MIT — use, modifique, distribua livremente.

---

Feito com 🔨 por [OpenClaw](https://github.com/openclaw/openclaw).
