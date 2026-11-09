# Arquitetura e guia do código

Visão técnica para quem vai manter o código. Diagramas gerais em
[development_plan.md §1](../development_plan.md#1-arquitetura-proposta).

## Princípios

1. **Núcleo puro, bordas finas.** Triagem e conversa (`src/lib/triage`, `src/lib/conversation/machine.ts`)
   são TypeScript puro, sem rede, banco nem relógio. Toda entrada e saída fica no orquestrador,
   nas rotas e nos adaptadores. Resultado: a lógica crítica é 100% testável com testes unitários.
2. **Independente de canal.** O núcleo fala `IncomingMessage`/`OutgoingMessage`. O WhatsApp e o
   simulador são apenas adaptadores, e um novo canal (Telegram, SMS) não muda o núcleo.
3. **Segurança do paciente acima de tudo.** Na dúvida, a gravidade sobe. Qualquer falha ao abrir
   o chamado responde "LIGUE 192 AGORA". Os textos sempre reforçam o 192/193.
4. **Serverless-friendly.** Nenhum estado em memória entre requisições (Redis via REST), webhook
   responde rápido e processa com `after()`.

## Mapa de pastas

```
src/
├── app/                         # Next.js App Router
│   ├── page.tsx                 # Página inicial (web mobile)
│   ├── simulador/               # Simulador do chat (client component)
│   ├── hospital/                # Painel do hospital (client component)
│   ├── manifest.ts              # PWA
│   └── api/
│       ├── whatsapp/webhook/    # GET verificação · POST mensagens
│       ├── simulator/           # POST mensagem · GET fila assíncrona
│       ├── alerts/              # GET lista · [id] GET/PATCH
│       ├── hospitals/nearest/   # GET hospitais próximos
│       └── health/              # GET diagnóstico
├── components/WhatsAppText.tsx  # Renderiza *negrito*/_itálico_ com segurança
├── data/hospitals.ts            # Base de hospitais (demonstração)
└── lib/
    ├── domain/types.ts          # C1  Tipos compartilhados
    ├── triage/nlu.ts            # C2  Palavras-chave → intenção
    ├── triage/protocols.ts      # C3  Conteúdo de primeiros socorros
    ├── triage/engine.ts         # C4  Cálculo de gravidade
    ├── conversation/machine.ts  # C5  Máquina de estados (pura)
    ├── conversation/orchestrator.ts # C6 Executa efeitos + persistência
    ├── geo/                     # C7  Haversine, hospitais próximos
    ├── store/                   # C8  Store (memória | Upstash Redis)
    ├── alerts/                  # C9  Chamados e notificações
    ├── whatsapp/                # C10 Parser, payloads, assinatura, cliente
    ├── server.ts                #     Dependências e autenticação das rotas
    └── config.ts                # C13 Variáveis de ambiente
tests/                           # Vitest (um arquivo por componente)
```

## Ciclo de uma mensagem

```
WhatsApp ──► POST /api/whatsapp/webhook
               │ isValidSignature()          (whatsapp/signature.ts)
               │ parseWebhook()              (whatsapp/parse.ts)  → IncomingMessage
               │ store.markMessageProcessed()                     → deduplicação
               │ 200 OK  ──► after():
               ▼
          handleIncoming()                   (conversation/orchestrator.ts)
               │ store.getSession()
               │ step(session, input, now)   (conversation/machine.ts) → replies + effects
               │   ├─ detectCommand / detectCriticalSign / detectIncidentType (triage/nlu.ts)
               │   └─ evaluate / nextQuestion (triage/engine.ts + protocols.ts)
               │ effects:
               │   DISPATCH_ALERT   → dispatchAlert()   (alerts/service.ts)
               │                         nearestHospitals() (geo/hospitals.ts)
               │                         store.saveAlert() + notifier.notifyHospital()
               │   SUGGEST_HOSPITALS → suggestHospitalsMessage()
               │   ADD_ALERT_NOTE    → addAlertNote()
               │ store.saveSession()
               ▼
          sendWhatsAppMessages()             (whatsapp/client.ts → toGraphPayload)
```

O simulador segue o mesmo caminho a partir de `handleIncoming()`, com `channel: "simulator"`.

## Como fazer mudanças comuns

### Adicionar um tipo de acidente

1. Adicione o valor em `IncidentType` (`domain/types.ts`).
2. Crie a entrada em `PROTOCOLS` (`triage/protocols.ts`): rótulo de até 24 caracteres, descrição
   de até 72, `contexts`, `minSeverity`, `questions`, `steps` e `warningSigns`.
3. Adicione palavras-chave em `TYPE_KEYWORDS` (`triage/nlu.ts`). A ordem importa: os tipos
   mais específicos vêm primeiro.
4. Adicione o rótulo em `TYPE_TEXT` (`app/hospital/Dashboard.tsx`).
5. Rode `npm test`: os testes de integridade conferem os limites do WhatsApp automaticamente.

> Cada menu tem no máximo 10 itens (limite de lista do WhatsApp).

### Adicionar uma pergunta de triagem

1. Adicione o id em `QuestionId` e a definição em `QUESTIONS`: `dangerAnswer`,
   `severityIfDanger`, `reason` e `criticalKind` se for crítica.
2. Inclua o id na lista `questions` dos protocolos desejados, em ordem de prioridade.

### Adicionar um sinal crítico (texto livre)

Inclua frases normalizadas (minúsculas, sem acento) em `CRITICAL_SIGNS` (`triage/nlu.ts`) e um
caso em `tests/nlu.test.ts`, inclusive um teste contra **falso alarme**.

### Trocar a base de hospitais

Substitua `HOSPITALS` em `src/data/hospitals.ts`, mantendo o formato `Hospital`. Para muitos
registros, considere gerar o arquivo a partir do CNES/DataSUS (tarefa F7.3).

### Adicionar um canal (ex.: Telegram)

Crie `src/lib/telegram/` com parser (payload → `IncomingMessage`) e envio (`OutgoingMessage` →
API do canal), mais uma rota em `src/app/api/telegram/`. Use `channel: "telegram"` (adicione em
`Channel`) e trate o envio em `DefaultNotifier.notifyUser`.

## Decisões e trade-offs

| Decisão | Alternativa | Por quê |
|---------|-------------|---------|
| Regras + palavras-chave | LLM para toda a conversa | Previsível, auditável, sem custo/latência; LLM fica como evolução para texto livre (F7.1) |
| Polling no painel (5 s) | WebSocket/SSE | Funções serverless não mantêm conexões longas; 5 s é suficiente para o MVP |
| Haversine (linha reta) | API de rotas (Google/OSRM) | Grátis, sem chave, determinístico; a ordenação dentro da cidade é boa o bastante |
| Upstash Redis | Postgres | Sessões com TTL nativo, REST para serverless, integração de 1 clique na Vercel |
| `after()` no webhook | Processar antes de responder | A Meta reenvia se a resposta demora; com `after()` o 200 sai na hora |

## Limitações conhecidas

- **Concorrência por usuário:** duas mensagens do mesmo usuário no mesmo instante podem disputar
  a sessão (a última gravação vence). É raro na prática. A solução seria um lock por sessão no
  Redis.
- **Base de hospitais estática** e com coordenadas aproximadas.
- **Sem geocodificação**: endereço digitado vai como texto para o hospital de referência.
- **Painel único**: todos os hospitais veem todos os chamados (F7.4: login por hospital).
