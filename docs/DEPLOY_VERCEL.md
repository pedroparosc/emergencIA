# Deploy na Vercel + configuração do WhatsApp

Guia passo a passo para colocar o emergencIA no ar em **https://vercel.com** e ligar o chatbot a
um número de WhatsApp. Tempo estimado: **40 a 60 minutos** na primeira vez.

> 💡 **Ordem recomendada:** (1) rodar localmente → (2) deploy na Vercel com o simulador →
> (3) Redis → (4) WhatsApp. Cada etapa funciona sozinha, então a equipe pode apresentar o projeto
> pelo simulador mesmo se a etapa do WhatsApp atrasar.

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Rodar localmente](#2-rodar-localmente)
3. [Deploy na Vercel](#3-deploy-na-vercel)
4. [Banco de dados: Upstash Redis](#4-banco-de-dados-upstash-redis)
5. [Variáveis de ambiente](#5-variáveis-de-ambiente)
6. [WhatsApp Cloud API (Meta)](#6-whatsapp-cloud-api-meta)
7. [Checklist de verificação](#7-checklist-de-verificação)
8. [Operação: logs, rollback e domínio](#8-operação-logs-rollback-e-domínio)
9. [Alternativa: Vercel CLI](#9-alternativa-vercel-cli)
10. [Problemas comuns](#10-problemas-comuns)

---

## 1. Pré-requisitos

| Item | Para quê | Custo |
|------|----------|-------|
| Conta no **GitHub** com acesso ao repositório | A Vercel faz deploy a partir do GitHub | Grátis |
| Conta na **Vercel** (plano *Hobby*), entrando com o GitHub | Hospedagem | Grátis |
| Conta no **Meta for Developers** (developers.facebook.com) | WhatsApp Cloud API | Grátis no número de teste |
| **Node.js 20+** e **npm** (só para rodar localmente) | Desenvolvimento | Grátis |
| Celular com WhatsApp | Testes | — |

## 2. Rodar localmente

```bash
git clone https://github.com/pedroparosc/emergencIA.git
```

```bash
cd emergencIA
```

```bash
npm install
```

```bash
npm run dev
```

Abra http://localhost:3000. Sem nenhuma variável de ambiente o app já funciona com:
- **simulador** em `/simulador`;
- **painel** em `/hospital` (sem senha em desenvolvimento);
- armazenamento **em memória** (apaga ao reiniciar).

Para conferir que está tudo certo:

```bash
npm test
```

```bash
npm run build
```

## 3. Deploy na Vercel

1. Entre em https://vercel.com e faça login com o GitHub.
2. Clique em **Add New… → Project**.
3. Em *Import Git Repository*, escolha **emergencIA** (se não aparecer, clique em *Adjust GitHub
   App Permissions* e libere o repositório).
4. A Vercel detecta **Next.js** sozinha. Não altere *Build Command* nem *Output Directory*.
5. Em **Environment Variables**, por enquanto adicione só:
   - `DASHBOARD_TOKEN` = uma senha forte (gere com `openssl rand -hex 16` ou um gerador de senhas).
6. Clique em **Deploy** e aguarde cerca de 1 minuto.
7. Abra a URL gerada (ex.: `https://emergencia-xxxx.vercel.app`) e teste:
   - `/api/health` deve responder `"status":"ok"`;
   - `/simulador`: faça uma conversa de teste.

> ⚠️ Sem o Redis (próximo passo), cada função serverless tem a própria memória e as conversas
> podem "esquecer" o estado. **Configure o Redis antes de apresentar.**

O arquivo `vercel.json` já define a região **`gru1` (São Paulo)** para as funções, o que dá menor
latência no Brasil.

## 4. Banco de dados: Upstash Redis

1. No projeto da Vercel, abra a aba **Storage**.
2. Clique em **Create Database** (ou *Browse Marketplace*) e escolha **Upstash → Redis**.
3. Escolha a região mais próxima (ex.: *São Paulo* / `sa-east-1`, se disponível) e o plano **Free**.
4. Em **Connect Project**, selecione o projeto emergencIA e os ambientes *Production*, *Preview*
   e *Development*.
5. A Vercel cria as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` (ou
   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`). **O código aceita os dois pares.**
6. Vá em **Deployments → ⋯ → Redeploy** para aplicar.
7. Confira em `/api/health`: `"store":"redis"`.

## 5. Variáveis de ambiente

Cadastre em **Project → Settings → Environment Variables**. Toda alteração só vale **depois de
um novo deploy** (*Deployments → ⋯ → Redeploy*).

| Variável | Obrigatória? | Exemplo / onde obter |
|----------|--------------|----------------------|
| `DASHBOARD_TOKEN` | **Sim em produção** | Senha do painel `/hospital` e das APIs de chamados |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | **Sim em produção** | Criadas automaticamente pelo passo 4 |
| `WHATSAPP_ACCESS_TOKEN` | Para o WhatsApp | Meta → WhatsApp → *API Setup* (passo 6) |
| `WHATSAPP_PHONE_NUMBER_ID` | Para o WhatsApp | Meta → WhatsApp → *API Setup* → *Phone number ID* |
| `WHATSAPP_VERIFY_TOKEN` | Para o WhatsApp | Texto que **você inventa**; o mesmo vai na tela do webhook da Meta |
| `WHATSAPP_APP_SECRET` | **Recomendada** | Meta → *App settings → Basic → App secret* |
| `WHATSAPP_API_VERSION` | Não | Padrão `v23.0` (use a versão mostrada no painel da Meta) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Não | Número do bot com DDI, só dígitos (ex.: `15551234567`), usado no botão "Falar no WhatsApp" |
| `HOSPITAL_NOTIFY_WHATSAPP` | Não | Celular que faz o papel do hospital na demonstração (ex.: `5511987654321`) |
| `HOSPITAL_WEBHOOK_URL` | Não | URL que recebe um POST JSON a cada chamado |
| `ENABLE_SIMULATOR` | Não | `false` desliga o simulador |

Todas estão documentadas também em [`.env.example`](../.env.example). **Nunca** faça commit de
valores reais.

## 6. WhatsApp Cloud API (Meta)

### 6.1 Criar o app

1. Acesse https://developers.facebook.com → **My Apps → Create App**.
2. Escolha o caso de uso de **WhatsApp / "Connect with customers through WhatsApp"** (o tipo
   do app é *Business*). Dê o nome `emergencIA` e conclua.
3. No app, abra **WhatsApp → API Setup** (ou *Getting started*). A Meta cria um **número de
   teste** gratuito.

### 6.2 Copiar as credenciais

Na tela **API Setup**:

- **Temporary access token** → `WHATSAPP_ACCESS_TOKEN` (vale **24 h**; veja 6.5 para um token
  permanente).
- **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID` (não é o número de telefone).
- Em **To**, clique em *Manage phone number list* e **adicione os celulares** que vão testar
  (até 5 no número de teste). Cada um recebe um código de confirmação.

Em **App settings → Basic**, copie o **App secret** → `WHATSAPP_APP_SECRET`.

Cadastre tudo na Vercel (passo 5) e faça **Redeploy**.

### 6.3 Registrar o webhook

1. No app da Meta: **WhatsApp → Configuration → Webhook → Edit**.
2. **Callback URL:** `https://SEU-PROJETO.vercel.app/api/whatsapp/webhook`
3. **Verify token:** o mesmo valor de `WHATSAPP_VERIFY_TOKEN`.
4. Clique em **Verify and save**. A Meta chama a URL com `GET`, e o app responde o `challenge`.
5. Em **Webhook fields**, clique em **Manage** e **assine o campo `messages`**.

Para testar a verificação manualmente:

```bash
curl "https://SEU-PROJETO.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=123"
```

Deve responder `123`.

### 6.4 Primeiro teste

1. De um celular cadastrado, mande **"oi"** para o número de teste.
2. O bot responde com os botões *Trânsito / Em casa*.
3. Teste um caso grave: *"meu pai caiu da escada e não acorda"* → toque em **Enviar
   localização** → o chamado aparece em `/hospital`.

### 6.5 Token permanente (recomendado antes da apresentação)

O token temporário expira em 24 h, e a demo pode quebrar no dia. Para gerar um permanente:

1. https://business.facebook.com → **Configurações do negócio → Usuários → Usuários do sistema**
   → **Adicionar** (função *Admin*).
2. **Atribuir ativos**: selecione o app emergencIA (controle total).
3. **Gerar novo token** → escolha o app → permissões `whatsapp_business_messaging` e
   `whatsapp_business_management` → validade **Nunca**.
4. Substitua `WHATSAPP_ACCESS_TOKEN` na Vercel e faça Redeploy.

### 6.6 Regra das 24 horas (importante na demo)

A Meta só permite mensagens livres para quem **falou com o bot nas últimas 24 h**. Fora dessa
janela, só com *templates* aprovados. Na prática:

- respostas ao usuário funcionam sempre, porque ele acabou de escrever;
- o celular configurado em `HOSPITAL_NOTIFY_WHATSAPP` **precisa mandar um "oi" para o bot antes
  da apresentação**, senão não recebe os chamados. O painel `/hospital` funciona de qualquer forma.

## 7. Checklist de verificação

Abra `https://SEU-PROJETO.vercel.app/api/health` e confira:

```json
{
  "status": "ok",
  "store": "redis",
  "whatsapp": true,
  "webhookVerifyToken": true,
  "webhookSignature": true,
  "dashboardProtected": true,
  "simulator": true
}
```

- [ ] `store` = `redis`
- [ ] `whatsapp`, `webhookVerifyToken` e `webhookSignature` = `true`
- [ ] `dashboardProtected` = `true`
- [ ] Webhook "Verificado" na Meta e campo `messages` assinado
- [ ] Conversa completa no WhatsApp com chamado aparecendo no painel
- [ ] Botão "Equipe a caminho" no painel → mensagem chega no WhatsApp do usuário
- [ ] Token permanente configurado (6.5)
- [ ] Celular do "hospital" mandou "oi" para o bot nas últimas 24 h (6.6)

## 8. Operação: logs, rollback e domínio

- **Logs:** Project → **Logs** (filtre por `/api/whatsapp/webhook`). Mensagens do app começam com
  `[whatsapp]`, `[webhook]`, `[notifier]` ou `[orchestrator]`.
- **Previews:** cada push em uma branch gera uma URL própria. **Não** aponte o webhook da Meta para
  previews.
- **Rollback:** Deployments → escolha um deploy anterior → **⋯ → Promote to Production**.
- **Domínio próprio (opcional):** Settings → Domains → Add. Depois, atualize a Callback URL na Meta.

## 9. Alternativa: Vercel CLI

```bash
npm i -g vercel
```

```bash
vercel login
```

```bash
vercel link
```

```bash
vercel env add DASHBOARD_TOKEN production
```

```bash
vercel --prod
```

Para baixar as variáveis da Vercel e rodar localmente com elas:

```bash
vercel env pull .env.local
```

## 10. Problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Meta diz "The callback URL or verify token couldn't be validated" | `WHATSAPP_VERIFY_TOKEN` diferente ou sem redeploy | Confira o valor, faça Redeploy e teste com o `curl` do item 6.3 |
| Bot não responde, log mostra `Assinatura inválida` | `WHATSAPP_APP_SECRET` errado | Copie de novo em *App settings → Basic* |
| Log mostra `Falha ao enviar (401)` | Token expirado | Gere novo token (6.5) |
| Log mostra `(131030) Recipient phone number not in allowed list` | Número não cadastrado no número de teste | Adicione em *API Setup → To* |
| Hospital não recebe WhatsApp | Fora da janela de 24 h | Mande "oi" do celular do hospital para o bot (6.6) |
| Bot "esquece" a conversa | Redis não configurado (`store: memory`) | Passo 4 |
| Painel pede token sempre | `DASHBOARD_TOKEN` com espaço/valor diferente | Corrija e faça Redeploy |
| Botão "Falar no WhatsApp" não aparece | `NEXT_PUBLIC_WHATSAPP_NUMBER` vazio | Defina e faça **Redeploy** (a variável entra no build) |
