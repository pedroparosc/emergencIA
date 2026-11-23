# emergencIA 🚑

**Chatbot de WhatsApp para primeiros socorros** em acidentes de trânsito e domésticos. Ele orienta
passo a passo, avalia a gravidade com poucas perguntas e, nos casos graves, **aciona
automaticamente o hospital mais próximo, compartilhando a localização da vítima**.

Inclui uma aplicação **web mobile (PWA)** com página inicial, **simulador do chat** (para testar
sem WhatsApp) e **painel do hospital** com os chamados em tempo real.

> Projeto acadêmico — FMU Tech Inovação 2026.2.
> ⚠️ As orientações não substituem atendimento médico. Em emergência, ligue **192** (SAMU) ou
> **193** (Bombeiros).

## Como funciona

```
Usuário no WhatsApp ──► "meu pai caiu da escada e não acorda"
                         │
                         ▼
             emergencIA identifica: QUEDA + vítima inconsciente → gravidade 🔴 CRÍTICA
                         │
        ┌────────────────┴───────────────────┐
        ▼                                    ▼
 Instruções imediatas               Pede a 📍 localização
 (verificar respiração, RCP…)               │
                                            ▼
                         Hospital mais próximo recebe o chamado EMG-XXXXX
                         (painel web + WhatsApp/webhook opcionais)
                                            │
                                            ▼
                    Hospital marca "Equipe a caminho" → usuário é avisado
```

| Gravidade | O que o bot faz |
|-----------|-----------------|
| 🔴 Crítica | Instruções que salvam vidas (RCP, Heimlich, sangramento…) e **chamado automático** |
| 🟠 Alta | **Chamado automático** e passo a passo |
| 🟡 Moderada | Orientação e indicação dos pronto-socorros mais próximos com rota |
| 🟢 Baixa | Cuidados em casa e sinais de alerta ("Piorou" aciona o hospital) |

Situações cobertas: batida de carro, moto/bicicleta, atropelamento, queda, queimadura, corte,
engasgo, choque elétrico, intoxicação, afogamento e outros.

## Começando

Requisitos: Node.js 20+.

```bash
npm install
```

```bash
npm run dev
```

Abra http://localhost:3000. Sem configuração nenhuma, o app roda com o simulador e armazenamento
em memória.

| Página | Para quê |
|--------|----------|
| `/` | Página inicial |
| `/simulador` | Conversa idêntica à do WhatsApp, no navegador |
| `/hospital` | Painel de chamados do hospital |
| `/api/health` | Diagnóstico da configuração |

### Scripts

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes automatizados (Vitest) |
| `npm run lint` | Checagem de tipos (TypeScript) |
| `npm run build` | Build de produção |

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [development_plan.md](development_plan.md) | Plano de desenvolvimento: arquitetura, stack, fases com checklist, estimativas, testes e deploy |
| [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md) | **Passo a passo de deploy na Vercel e configuração do WhatsApp** |
| [docs/API.md](docs/API.md) | Referência de todas as rotas de API |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Guia do código, decisões técnicas e como estender |
| [docs/APRESENTACAO.md](docs/APRESENTACAO.md) | Roteiro da apresentação, demo e perguntas da banca |
| [.env.example](.env.example) | Todas as variáveis de ambiente, comentadas |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · WhatsApp Cloud API (Meta) · Upstash Redis ·
Zod · Vitest · Vercel.

## Estrutura

```
src/
├── app/            # Páginas (web mobile) e rotas de API
├── components/     # Componentes React compartilhados
├── data/           # Base de hospitais (demonstração)
└── lib/
    ├── triage/         # NLU, protocolos de primeiros socorros, motor de gravidade
    ├── conversation/   # Máquina de estados e orquestrador
    ├── alerts/         # Chamados e notificações
    ├── geo/            # Distâncias e hospitais próximos
    ├── store/          # Persistência (memória | Redis)
    └── whatsapp/       # Integração com a WhatsApp Cloud API
tests/              # Testes automatizados
```

## Aviso importante

- O conteúdo de primeiros socorros segue materiais públicos (Ministério da Saúde/SAMU, Cruz
  Vermelha, diretrizes de RCP da AHA) e **precisa ser revisado por profissional de saúde antes de
  qualquer uso real**.
- A base de hospitais é de **demonstração** (São Paulo, coordenadas aproximadas).
- O "chamado ao hospital" é feito para hospitais parceiros pelo painel. Não há integração
  oficial com o SAMU 192, que depende de convênio com o poder público (ver roadmap no plano).
