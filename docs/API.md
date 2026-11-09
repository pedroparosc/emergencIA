# Referência da API

Base: `https://SEU-PROJETO.vercel.app` (ou `http://localhost:3000`). Todas as respostas são JSON,
salvo onde indicado. Os tipos citados estão em
[`src/lib/domain/types.ts`](../src/lib/domain/types.ts).

| Método | Rota | Autenticação | Uso |
|--------|------|--------------|-----|
| GET | `/api/whatsapp/webhook` | `hub.verify_token` | Verificação do webhook pela Meta |
| POST | `/api/whatsapp/webhook` | Assinatura `X-Hub-Signature-256` | Mensagens do WhatsApp |
| POST | `/api/simulator` | — (desligável) | Envia mensagem no simulador |
| GET | `/api/simulator?sessionId=` | — (desligável) | Busca mensagens assíncronas do simulador |
| GET | `/api/alerts` | Token do painel | Lista chamados |
| GET | `/api/alerts/:id` | Token do painel | Detalhe de um chamado |
| PATCH | `/api/alerts/:id` | Token do painel | Muda o status de um chamado |
| GET | `/api/hospitals/nearest` | — | Hospitais com PS mais próximos |
| GET | `/api/health` | — | Diagnóstico da configuração |

**Token do painel:** `Authorization: Bearer <DASHBOARD_TOKEN>` ou cabeçalho
`x-dashboard-token: <DASHBOARD_TOKEN>`. Se `DASHBOARD_TOKEN` não estiver definido, o acesso é
livre (somente desenvolvimento).

---

## Webhook do WhatsApp

### `GET /api/whatsapp/webhook`

Handshake da Meta. Query: `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`.

- `200 text/plain`: devolve o `hub.challenge` quando o token confere.
- `403`: token inválido.

### `POST /api/whatsapp/webhook`

Recebe o payload padrão da WhatsApp Cloud API (`object: "whatsapp_business_account"`). Tipos de
mensagem tratados: `text`, `interactive` (`button_reply`/`list_reply`), `button` e `location`.
Outros tipos (áudio, imagem) são tratados como texto não reconhecido.

Fluxo: valida a assinatura → deduplica por `message.id` → responde `200` → processa depois da
resposta (`after()`) e envia as respostas pela Graph API.

- `200 { "received": 1, "processed": 1 }` (`processed: 0` = mensagem repetida)
- `401` assinatura inválida · `400` JSON inválido

---

## Simulador

### `POST /api/simulator`

```json
{
  "sessionId": "7f1c9d1e-3c1a-4c55-9a8e-0d6f2b0d6a11",
  "input": { "kind": "text", "text": "meu pai caiu da escada e não acorda" }
}
```

`sessionId`: 8 a 64 caracteres `[a-zA-Z0-9-]`, gerado no navegador. `input` (`IncomingMessage`):

| `kind` | Campos |
|--------|--------|
| `text` | `text` (1 a 1000 caracteres) |
| `choice` | `id` (id do botão ou da linha da lista), `title?` |
| `location` | `lat`, `lng`, `name?`, `address?` |

Resposta `200`:

```json
{
  "messages": [ { "kind": "text", "text": "🚨 *CASO GRAVE…" }, { "kind": "location_request", "text": "📍 …" } ],
  "step": "AGUARDANDO_LOCALIZACAO",
  "severity": "CRITICA",
  "alertId": null
}
```

`messages` é uma lista de `OutgoingMessage`:

| `kind` | Campos | No WhatsApp vira |
|--------|--------|------------------|
| `text` | `text` | mensagem de texto |
| `buttons` | `text`, `buttons[{id,title}]` (até 3) | botões de resposta rápida |
| `list` | `text`, `buttonLabel`, `rows[{id,title,description?}]` (até 10) | lista interativa |
| `location_request` | `text` | botão nativo "Enviar localização" |

Erros: `400` corpo inválido (com `issues` do Zod) · `404` simulador desativado.

### `GET /api/simulator?sessionId=...`

Retorna e esvazia a fila de mensagens assíncronas (ex.: mudança de status feita pelo hospital):
`{ "messages": OutgoingMessage[] }`. O simulador consulta a cada 4 s enquanto há chamado aberto.

---

## Chamados

### `GET /api/alerts?limit=50`

`limit` entre 1 e 200 (padrão 50). Resposta: `{ "alerts": EmergencyAlert[] }`, com os mais
recentes primeiro.

```json
{
  "id": "EMG-4F7K2",
  "createdAt": 1762693473721,
  "updatedAt": 1762693473721,
  "status": "NOVO",
  "severity": "CRITICA",
  "context": "DOMESTICO",
  "incidentType": "QUEDA",
  "reasons": ["Relato de vítima inconsciente"],
  "location": { "lat": -23.5614, "lng": -46.6559, "source": "gps" },
  "hospital": { "id": "hc-fmusp", "name": "Hospital das Clínicas (FMUSP)", "distanceKm": 1.44, "...": "..." },
  "channel": "whatsapp",
  "contact": "5511999990000",
  "sessionId": "whatsapp:5511999990000",
  "notes": [{ "at": 1762693500000, "text": "Usuário relatou PIORA da vítima." }]
}
```

### `GET /api/alerts/:id`

`200 { "alert": EmergencyAlert }` · `404` não encontrado.

### `PATCH /api/alerts/:id`

```json
{ "status": "A_CAMINHO" }
```

`status` ∈ `NOVO`, `VISUALIZADO`, `A_CAMINHO`, `FINALIZADO`, `CANCELADO`. A cada mudança o
usuário recebe uma mensagem (WhatsApp ou fila do simulador).
`200 { "alert": … }` · `400` status inválido · `404` não encontrado.

---

## Hospitais

### `GET /api/hospitals/nearest?lat=-23.56&lng=-46.65&limit=3`

`limit` entre 1 e 10. Resposta: `{ "hospitals": HospitalWithDistance[] }`, do mais próximo para o
mais distante, só hospitais com pronto-socorro. Distância em linha reta (Haversine), em km.

---

## Health

### `GET /api/health`

```json
{ "status": "ok", "store": "redis", "whatsapp": true, "webhookVerifyToken": true,
  "webhookSignature": true, "dashboardProtected": true, "simulator": true, "time": "…" }
```

Mostra só se cada configuração existe, nunca os valores.

---

## Integração para hospitais (`HOSPITAL_WEBHOOK_URL`)

Se definido, cada chamado gera um `POST` com timeout de 5 s:

```json
{ "event": "alert.created", "alert": { "...EmergencyAlert" } }
```

Notas de piora geram `{ "event": "alert.updated", "update": "Usuário relatou PIORA da vítima.", "alert": { … } }`.
