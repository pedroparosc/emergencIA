# Apresentação — emergencIA (FMU Tech Inovação 2026.2)

Material de apoio para a equipe apresentar o projeto: pitch, roteiro de slides com falas,
demonstração ao vivo com plano B, perguntas prováveis da banca e checklist.

> ⚠️ **Pendente — alinhamento ao edital (itens 2 e 4).** O PDF do edital está no SharePoint da
> FMU, que exige login institucional e não pôde ser lido durante a preparação deste material.
> Cole o texto dos itens 2 e 4 na [seção 6](#6-alinhamento-ao-edital-itens-2-e-4) (ou envie para
> quem está mantendo o projeto) para ajustar os slides aos critérios exatos.

---

## 1. Pitch de 30 segundos

> "Quando acontece um acidente em casa ou no trânsito, quem está do lado não sabe o que fazer e
> perde minutos preciosos. O **emergencIA** é um assistente no **WhatsApp**, o app que todo
> brasileiro já tem, que orienta os primeiros socorros passo a passo, avalia a gravidade com
> poucas perguntas e, nos casos graves, **aciona automaticamente o hospital mais próximo com a
> localização da vítima**. Sem baixar nada, sem cadastro, sem precisar explicar tudo por telefone."

## 2. Roteiro de slides (≈ 10 min + demo)

| # | Slide | Conteúdo | Fala-chave | Tempo |
|---|-------|----------|-----------|-------|
| 1 | **Capa** | Nome, logo 🚑, equipe, curso, semestre, FMU Tech Inovação 2026.2 | "Somos [equipe] e vamos apresentar o emergencIA." | 0:20 |
| 2 | **O problema** | Acidentes domésticos e de trânsito; testemunhas leigas; minutos iniciais decisivos; ligação difícil sob estresse (endereço, o que aconteceu) | "Nos primeiros minutos, quem está do lado é quem pode salvar, mas quase ninguém sabe o que fazer." | 1:00 |
| 3 | **Dados** | 2 ou 3 números com fonte oficial (ver [§2.1](#21-dados-para-o-slide-2-e-3)) | "Isso não é raro: …" | 0:40 |
| 4 | **A solução** | Print do chat + 3 passos: conte → responda → receba ajuda | Pitch de 30 s | 0:50 |
| 5 | **Como avalia a gravidade** | 4 níveis (🔴🟠🟡🟢) e o que acontece em cada um; sinais críticos pulam direto para o chamado | "Inspirado no Protocolo de Manchester, simplificado para leigos." | 1:00 |
| 6 | **Chamado automático** | Fluxo: localização → hospital mais próximo → painel do hospital → "equipe a caminho" volta ao usuário | "O hospital recebe gravidade, tipo, localização e telefone em segundos." | 0:50 |
| 7 | **DEMO ao vivo** | Ver [§3](#3-roteiro-da-demonstração-ao-vivo) | — | 3:00 |
| 8 | **Tecnologia** | Diagrama de arquitetura (development_plan.md §1); Next.js + WhatsApp Cloud API + Upstash Redis + Vercel | "Uma base de código para o bot, o site e o painel, com deploy automático." | 1:00 |
| 9 | **Qualidade e segurança** | 113 testes automatizados; assinatura do webhook; LGPD (consentimento, dados mínimos, expiração); conteúdo baseado em protocolos oficiais | "Em saúde, previsível é melhor que criativo: usamos regras auditáveis." | 0:50 |
| 10 | **Impacto e público** | Famílias, idosos, cuidadores, motoristas e motociclistas; hospitais ganham informação antes da chegada | "Menos tempo perdido, mais informação para quem vai atender." | 0:40 |
| 11 | **Limitações e próximos passos** | Integração oficial com a Regulação do SAMU 192; base CNES/DataSUS; IA generativa para texto livre e áudio; validação com profissionais de saúde | "Sabemos o que falta, e esse é o roadmap." | 0:50 |
| 12 | **Encerramento** | QR code para o site/simulador; agradecimento | "Testem agora pelo QR code." | 0:20 |

**Dicas de design dos slides:** fundo claro, vermelho `#c8102e` como cor de destaque (a mesma do
app), pouco texto (no máximo 6 linhas por slide), prints reais do simulador e do painel e, no slide
12, um QR code apontando para a URL da Vercel.

### 2.1 Dados para os slides 2 e 3

Use **dados oficiais com fonte e ano no rodapé do slide**. A banca costuma perguntar de onde vêm
os números. Fontes sugeridas para pesquisar:

- **DATASUS / SIM** (Sistema de Informações sobre Mortalidade): óbitos por acidentes de
  transporte e por quedas, afogamentos, queimaduras etc.
- **Ministério da Saúde**: boletins sobre acidentes domésticos com crianças e idosos.
- **ONSV** (Observatório Nacional de Segurança Viária): números de trânsito.
- **SAMU 192 / Ministério da Saúde**: volume de chamados e tempo-resposta.
- **Pesquisas TIC Domicílios (Cetic.br)**: uso de WhatsApp no Brasil, que justifica o canal.

> ✏️ Não use números sem conferir a fonte e o ano.

## 3. Roteiro da demonstração ao vivo

**Preparação (antes de subir no palco):** painel `/hospital` aberto e logado no notebook
projetado; celular com WhatsApp espelhado (ou o simulador `/simulador` em outra aba); o celular do
"hospital" já mandou "oi" para o bot hoje (regra das 24 h); `/api/health` conferido.

| Tempo | Ação | O que falar |
|-------|------|-------------|
| 0:00 | No WhatsApp, enviar: **"meu pai caiu da escada e não acorda"** | "Vou escrever como uma pessoa assustada escreveria." |
| 0:15 | Mostrar a resposta: 🚨 caso grave + instruções imediatas + pedido de 📍 | "Ele identificou a queda e um sinal crítico, a pessoa desacordada, e pulou as perguntas." |
| 0:45 | Tocar em **Enviar localização** | "Ao enviar, o usuário autoriza o compartilhamento: é a parte de LGPD." |
| 1:00 | Mostrar a confirmação **"Chamado aberto: EMG-XXXXX"** + passo a passo | "Ele escolheu o hospital mais próximo e gerou um protocolo." |
| 1:15 | Virar para o **painel do hospital**: chamado novo piscando, mapa, gravidade, motivos | "Do lado do hospital, o chamado chega com tudo que a equipe precisa." |
| 1:45 | Clicar em **🚑 Equipe a caminho** | — |
| 1:55 | Mostrar no celular: **"Equipe a caminho!"** | "E a família é avisada na hora." |
| 2:10 | (Se houver tempo) Caso leve: **"cortei o dedo com faca"** → responder → cuidados em casa | "Nem todo caso vira chamado: aqui ele orienta e ensina os sinais de alerta." |
| 3:00 | Fim | — |

**Plano B (sem internet ou WhatsApp fora do ar):**
1. Usar o **simulador** (`/simulador`) com o botão *"Usar local de demonstração"*, que não depende
   do GPS.
2. Se não houver internet: rodar localmente (`npm run dev`) no notebook.
3. Último recurso: **vídeo gravado** da demo completa (gravar com antecedência, tarefa F3.7).

## 4. Divisão de falas (sugestão para 4 integrantes)

| Integrante | Slides | Responsabilidade extra |
|------------|--------|------------------------|
| A | 1–3 | Abertura e dados (confere as fontes) |
| B | 4–6 | Solução e gravidade |
| C | 7 | Demo ao vivo (opera o celular e o painel) |
| D | 8–12 | Tecnologia, impacto, próximos passos e perguntas |

## 5. Perguntas prováveis da banca

| Pergunta | Resposta sugerida |
|----------|-------------------|
| **Isso substitui o SAMU?** | Não. O bot sempre recomenda ligar 192/193 nos casos graves. Ele ganha tempo: orienta enquanto a ajuda não chega e já entrega ao hospital a localização e a gravidade. A integração oficial com a Central de Regulação do SAMU depende de convênio com o poder público e está no roadmap. |
| **E se o bot errar a orientação?** | As orientações são regras fixas baseadas em materiais oficiais de primeiros socorros (Ministério da Saúde, Cruz Vermelha, diretrizes de RCP), não textos inventados por IA. Na dúvida o sistema classifica para cima, e há 113 testes automatizados. Antes de uso real, o conteúdo precisa ser validado por profissionais de saúde. |
| **Onde está a "IA"?** | A triagem é um sistema especialista baseado em regras, uma forma clássica de IA, mais o entendimento de linguagem natural por palavras-chave (entende "meu pai caiu e não acorda"). Escolhemos regras porque, em saúde, a decisão precisa ser explicável. A evolução é usar IA generativa só para interpretar textos e áudios difíceis, mantendo as regras como rede de segurança. |
| **E a LGPD?** | Consentimento explícito antes de pedir a localização, só os dados necessários (telefone, localização, respostas), sessões apagadas em 24 h e chamados em 30 dias, painel protegido por senha, webhook com assinatura. |
| **Por que WhatsApp e não um app?** | O WhatsApp está em praticamente todos os celulares do Brasil. Ninguém baixa um app no meio de uma emergência. |
| **Como o hospital recebe?** | Por um painel web em tempo real, opcionalmente por WhatsApp, e por integração via webhook com o sistema do hospital. |
| **E se não tiver GPS?** | A pessoa pode digitar o endereço, e o chamado vai assim mesmo para o hospital de referência. |
| **Quanto custa?** | No protótipo, zero: Vercel, Upstash e o número de teste da Meta são gratuitos. Em produção, a Meta cobra por conversa iniciada pela empresa; respostas a quem chama o bot têm custo baixo ou nulo. |
| **Como escala?** | Funções serverless escalam sozinhas. O gargalo seria o limite de mensagens da Meta, que sobe com a verificação do negócio. |
| **Hospital recebe trote?** | Cada chamado tem protocolo e o telefone do WhatsApp de quem abriu (não é anônimo), e o hospital pode cancelar o chamado no painel. |

## 6. Alinhamento ao edital (itens 2 e 4)

> **A preencher assim que o texto do edital estiver disponível.** Para cada exigência dos itens
> 2 e 4, indique onde o projeto atende e em qual slide isso aparece.

| Item do edital | Exigência (copiar do edital) | Como o emergencIA atende | Evidência | Slide |
|----------------|------------------------------|--------------------------|-----------|-------|
| 2.x | _…_ | _…_ | _…_ | _…_ |
| 4.x | _…_ | _…_ | _…_ | _…_ |

Evidências disponíveis para citar:
- **Produto funcionando:** URL da Vercel, simulador, painel, WhatsApp.
- **Documentação:** `README.md`, `development_plan.md` (planejamento com fases, estimativas e
  checklist), `docs/` (deploy, API, arquitetura).
- **Qualidade:** `npm test` (113 testes), build automático na Vercel.
- **Gestão do projeto:** histórico de commits no GitHub e tarefas marcadas no plano.

## 7. Checklist do dia

- [ ] `/api/health` com tudo `true` e `store: redis`
- [ ] Token do WhatsApp **permanente** (ou temporário gerado no mesmo dia)
- [ ] Celular do "hospital" mandou "oi" para o bot hoje
- [ ] Painel `/hospital` aberto e logado; chamados de teste antigos finalizados
- [ ] Celular carregado, espelhamento testado, modo "não perturbe" ligado
- [ ] Vídeo da demo (plano B) no notebook, offline
- [ ] QR code do slide 12 testado
- [ ] Ensaio cronometrado feito pelo menos 2 vezes
