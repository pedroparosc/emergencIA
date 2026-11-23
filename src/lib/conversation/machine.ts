/**
 * Máquina de estados da conversa (componente C5).
 *
 * `step(sessão, entrada)` é uma FUNÇÃO PURA: não acessa banco, rede nem relógio (o horário vem
 * por parâmetro). Ela devolve a nova sessão, as respostas a enviar e os "efeitos" que o
 * orquestrador deve executar (ex.: abrir chamado no hospital). Isso torna toda a lógica de
 * conversa testável com testes unitários simples.
 *
 * Ordem de envio: o orquestrador envia PRIMEIRO as mensagens geradas pelos efeitos (ex.:
 * "Hospital X acionado") e DEPOIS as `replies` daqui (ex.: passo a passo de primeiros socorros).
 *
 * Etapas: INICIO → CONTEXTO → TIPO → PERGUNTAS → (AGUARDANDO_LOCALIZACAO) → ACOMPANHAMENTO.
 * Atalhos:
 *   - texto livre que descreve o acidente pula os menus;
 *   - sinal crítico ("não respira", "muito sangue"...) pula direto para instruções + localização;
 *   - comandos globais: MENU, CANCELAR, RCP, PIOROU, AJUDA.
 */
import type {
  Channel,
  CriticalKind,
  Effect,
  IncidentContext,
  IncidentType,
  IncomingMessage,
  OutgoingMessage,
  QuestionId,
  Session,
  Severity,
} from "@/lib/domain/types";
import {
  defaultContextFor,
  detectCommand,
  detectContext,
  detectCriticalSign,
  detectIncidentType,
  normalize,
  parseYesNo,
} from "@/lib/triage/nlu";
import {
  dispositionFor,
  evaluate,
  maxSeverity,
  mergeWithSession,
  nextQuestion,
  SEVERITY_LABEL,
} from "@/lib/triage/engine";
import {
  CRITICAL_ACTIONS,
  DISCLAIMER,
  EMERGENCY_NUMBERS,
  PROTOCOLS,
  QUESTIONS,
  typesForContext,
} from "@/lib/triage/protocols";

/** Resultado de um passo da máquina. */
export interface MachineResult {
  session: Session;
  replies: OutgoingMessage[];
  effects: Effect[];
}

/* -------------------------------------------------------------------------- */
/* IDs dos botões/listas (devolvidos pelo canal quando o usuário clica)       */
/* -------------------------------------------------------------------------- */

export const CHOICE = {
  CONTEXT_PREFIX: "ctx:",
  TYPE_PREFIX: "type:",
  YES: "ans:yes",
  NO: "ans:no",
  MENU: "cmd:menu",
  PIOROU: "cmd:piorou",
  RCP: "cmd:rcp",
} as const;

/** Endereço digitado precisa ter pelo menos este tamanho para ser aceito como localização. */
const MIN_ADDRESS_LENGTH = 8;

/** Palavras típicas de endereço (normalizadas). */
const ADDRESS_WORDS = ["rua", "r", "av", "avenida", "travessa", "alameda", "estrada", "rodovia", "praca", "km", "bairro", "numero", "n", "condominio", "bloco", "apto", "esquina", "viela"];

/**
 * Heurística simples: o texto parece um endereço? Exige tamanho mínimo E (um número OU uma
 * palavra típica de endereço). Evita tratar "ela não respira" como endereço.
 */
export function looksLikeAddress(raw: string): boolean {
  const n = normalize(raw);
  if (n.length < MIN_ADDRESS_LENGTH) return false;
  if (/\d/.test(n)) return true;
  return n.split(" ").some((w) => ADDRESS_WORDS.includes(w));
}

/* -------------------------------------------------------------------------- */
/* Fábrica de sessão                                                          */
/* -------------------------------------------------------------------------- */

/** Cria uma sessão nova (início de atendimento). */
export function newSession(channel: Channel, userId: string, now: number): Session {
  return {
    id: `${channel}:${userId}`,
    channel,
    userId,
    step: "INICIO",
    answers: {},
    reasons: [],
    createdAt: now,
    updatedAt: now,
  };
}

/* -------------------------------------------------------------------------- */
/* Construtores de mensagens                                                  */
/* -------------------------------------------------------------------------- */

const text = (t: string): OutgoingMessage => ({ kind: "text", text: t });

function welcome(): OutgoingMessage[] {
  return [
    {
      kind: "buttons",
      text:
        "Olá! Eu sou o *emergencIA* 🚑, seu assistente de primeiros socorros.\n\n" +
        "⚠️ Se alguém corre *risco de vida*, ligue *192* agora — e continue falando comigo.\n\n" +
        "Onde aconteceu o acidente? Você também pode *me descrever* o que houve " +
        "(ex.: \"minha mãe caiu da escada\").",
      buttons: [
        { id: `${CHOICE.CONTEXT_PREFIX}TRANSITO`, title: "🚗 Trânsito" },
        { id: `${CHOICE.CONTEXT_PREFIX}DOMESTICO`, title: "🏠 Em casa" },
      ],
    },
  ];
}

function typeMenu(context: IncidentContext): OutgoingMessage {
  const types = typesForContext(context);
  return {
    kind: "list",
    text:
      (context === "TRANSITO" ? "🚗 *Acidente de trânsito.*" : "🏠 *Acidente em casa.*") +
      "\nO que aconteceu? Toque em *Ver opções* (ou digite o número).\n" +
      types.map((t, i) => `${i + 1}. ${PROTOCOLS[t].label}`).join("\n"),
    buttonLabel: "Ver opções",
    rows: types.map((t) => ({
      id: `${CHOICE.TYPE_PREFIX}${t}`,
      title: PROTOCOLS[t].label,
      description: PROTOCOLS[t].description,
    })),
  };
}

function questionMessage(type: IncidentType, qid: QuestionId, prefix?: string): OutgoingMessage {
  const all = PROTOCOLS[type].questions;
  const index = all.indexOf(qid) + 1;
  return {
    kind: "buttons",
    text: `${prefix ? `${prefix}\n\n` : ""}*Pergunta ${index} de ${all.length}*\n${QUESTIONS[qid].text}`,
    buttons: [
      { id: CHOICE.YES, title: "✅ Sim" },
      { id: CHOICE.NO, title: "❌ Não" },
    ],
  };
}

function followUpButtons(intro: string): OutgoingMessage {
  return {
    kind: "buttons",
    text: `${intro}\n\n${DISCLAIMER}`,
    buttons: [
      { id: CHOICE.PIOROU, title: "⚠️ Piorou" },
      { id: CHOICE.RCP, title: "🫀 Como fazer RCP" },
      { id: CHOICE.MENU, title: "🔄 Novo atendimento" },
    ],
  };
}

function locationRequest(purpose: "ALERTA" | "INDICACAO"): OutgoingMessage {
  if (purpose === "ALERTA") {
    return {
      kind: "location_request",
      text:
        "📍 *Envie sua localização AGORA* para eu acionar o hospital mais próximo.\n" +
        "Toque no botão abaixo (ou 📎 → Localização → Localização atual).\n" +
        "Sem GPS? *Digite o endereço* com número e bairro.\n\n" +
        "_Ao enviar, você autoriza o compartilhamento da sua localização e do seu telefone com o " +
        "hospital para o atendimento._",
    };
  }
  return {
    kind: "location_request",
    text:
      "📍 Se quiser, envie sua localização para eu indicar o *pronto-socorro mais próximo*.\n" +
      "Se não precisar, digite *não*.",
  };
}

/** Banner de caso grave + instruções imediatas (enviado antes do pedido de localização). */
function severeBanner(severity: Severity, reasons: string[], kind?: CriticalKind): OutgoingMessage[] {
  const reasonText = reasons.length ? `\nMotivo: ${reasons.join("; ")}.` : "";
  const messages: OutgoingMessage[] = [
    text(
      `🚨 *CASO GRAVE — gravidade ${SEVERITY_LABEL[severity]}*${reasonText}\n\n` +
        "Vou acionar o hospital mais próximo com a sua localização. " +
        "📞 Se possível, peça para alguém *ligar 192* ao mesmo tempo.",
    ),
  ];
  if (severity === "CRITICA") messages.push(text(CRITICAL_ACTIONS[kind ?? "GERAL"]));
  return messages;
}

/* -------------------------------------------------------------------------- */
/* Transições auxiliares                                                      */
/* -------------------------------------------------------------------------- */

function touch(session: Session, now: number, patch: Partial<Session>): Session {
  return { ...session, ...patch, updatedAt: now };
}

/**
 * Leva a sessão para o fluxo de chamado: pede localização ou, se já houver localização,
 * dispara o chamado imediatamente.
 */
function goToDispatch(session: Session, now: number): MachineResult {
  const banner = severeBanner(session.severity ?? "ALTA", session.reasons, session.criticalKind);
  if (session.location) {
    // Já temos a localização (ex.: enviada para indicação de hospital): aciona direto.
    return {
      session: touch(session, now, { step: "ACOMPANHAMENTO", locationPurpose: "ALERTA" }),
      replies: [...banner, ...afterDispatchReplies(session)],
      // A confirmação do chamado entra logo depois do banner de caso grave.
      effects: [{ type: "DISPATCH_ALERT", insertAt: banner.length }],
    };
  }
  return {
    session: touch(session, now, { step: "AGUARDANDO_LOCALIZACAO", locationPurpose: "ALERTA" }),
    replies: [...banner, locationRequest("ALERTA")],
    effects: [],
  };
}

/** Mensagens enviadas depois que o chamado foi aberto. */
function afterDispatchReplies(session: Session): OutgoingMessage[] {
  const replies: OutgoingMessage[] = [];
  if (session.incidentType) replies.push(text(PROTOCOLS[session.incidentType].steps));
  replies.push(
    followUpButtons(
      "Fique com a vítima e mantenha o celular por perto: o hospital pode entrar em contato. " +
        "Se a situação piorar, toque em *Piorou*.",
    ),
  );
  return replies;
}

/** Fim da triagem: decide a conduta conforme a gravidade. */
function conclude(session: Session, now: number): MachineResult {
  const type = session.incidentType ?? "OUTRO";
  const protocol = PROTOCOLS[type];
  const severity = session.severity ?? protocol.minSeverity;

  switch (dispositionFor(severity)) {
    case "ACIONAR_HOSPITAL":
      return goToDispatch(session, now);

    case "INDICAR_HOSPITAL":
      return {
        session: touch(session, now, { step: "AGUARDANDO_LOCALIZACAO", locationPurpose: "INDICACAO" }),
        replies: [
          text(
            `Gravidade ${SEVERITY_LABEL[severity]}: a vítima *precisa de avaliação médica*, ` +
              "mas não há sinal de risco imediato de vida. Pode ir a um pronto-socorro ou UPA.",
          ),
          text(protocol.steps),
          text(
            `⚠️ *Sinais de alerta:* ${protocol.warningSigns}.\n` +
              "Se aparecer algum, envie *PIOROU* que eu aciono o hospital.",
          ),
          locationRequest("INDICACAO"),
        ],
        effects: [],
      };

    case "CUIDADOS_EM_CASA":
      return {
        session: touch(session, now, { step: "ACOMPANHAMENTO" }),
        replies: [
          text(`Gravidade ${SEVERITY_LABEL[severity]}: pelos dados informados, dá para cuidar em casa.`),
          text(protocol.steps),
          followUpButtons(
            `⚠️ *Procure atendimento se surgir:* ${protocol.warningSigns}.\n` +
              "Nesse caso, toque em *Piorou*.",
          ),
        ],
        effects: [],
      };
  }
}

/** Faz a próxima pergunta ou conclui a triagem. */
function askNextOrConclude(session: Session, now: number, prefix?: string): MachineResult {
  const type = session.incidentType ?? "OUTRO";
  const merged = mergeWithSession(session, evaluate(type, session.answers));
  const updated = touch(session, now, {
    severity: merged.severity,
    reasons: merged.reasons,
    criticalKind: merged.criticalKind,
  });

  const qid = merged.severity === "CRITICA" ? undefined : nextQuestion(type, updated.answers);
  if (qid) {
    return {
      session: touch(updated, now, { step: "PERGUNTAS", pendingQuestion: qid }),
      replies: [questionMessage(type, qid, prefix)],
      effects: [],
    };
  }
  const result = conclude(touch(updated, now, { pendingQuestion: undefined }), now);
  if (prefix) result.replies.unshift(text(prefix));
  return result;
}

/** Inicia a triagem de um tipo de acidente. */
function startTriage(
  session: Session,
  now: number,
  type: IncidentType,
  context?: IncidentContext,
): MachineResult {
  const updated = touch(session, now, {
    incidentType: type,
    context: context ?? session.context ?? defaultContextFor(type),
  });
  return askNextOrConclude(updated, now, `Entendi: *${PROTOCOLS[type].label}*. Vou fazer perguntas rápidas.`);
}

/** Usuário relatou piora. */
function handleWorsening(session: Session, now: number): MachineResult {
  if (session.alertId) {
    return {
      session: touch(session, now, {}),
      replies: [
        text(
          `⚠️ Avisei o hospital (chamado *${session.alertId}*) que a situação *piorou*.\n` +
            "📞 Ligue *192* se ainda não ligou. Se a vítima parar de respirar, envie *RCP*.",
        ),
      ],
      effects: [{ type: "ADD_ALERT_NOTE", note: "Usuário relatou PIORA da vítima." }],
    };
  }
  // Engasgo que piora = não consegue mais tossir: situação crítica com Heimlich.
  const choking = session.incidentType === "ENGASGO";
  const severity = maxSeverity(session.severity ?? "BAIXA", choking ? "CRITICA" : "ALTA");
  const escalated = touch(session, now, {
    severity,
    reasons: [...new Set([...session.reasons, "Usuário relatou piora"])],
    criticalKind: severity === "CRITICA" ? (choking ? "HEIMLICH" : session.criticalKind ?? "GERAL") : undefined,
  });
  return goToDispatch(escalated, now);
}

/** Um sinal crítico foi detectado no texto livre. */
function handleCriticalSign(
  session: Session,
  now: number,
  rawText: string,
  reason: string,
  kind: CriticalKind,
): MachineResult {
  const type = session.incidentType ?? detectIncidentType(rawText);
  // "Não consegue respirar" num engasgo → manobra de Heimlich.
  const effectiveKind: CriticalKind = type === "ENGASGO" && kind === "GERAL" ? "HEIMLICH" : kind;

  if (session.alertId) {
    // Chamado já aberto: avisa o hospital e repete as instruções imediatas.
    return {
      session: touch(session, now, {
        severity: "CRITICA",
        criticalKind: effectiveKind,
        reasons: [...new Set([...session.reasons, reason])],
      }),
      replies: [
        text(`🚨 Avisei o hospital (chamado *${session.alertId}*): ${reason.toLowerCase()}.`),
        text(CRITICAL_ACTIONS[effectiveKind]),
      ],
      effects: [{ type: "ADD_ALERT_NOTE", note: `Atualização do usuário: ${reason}. Texto: "${rawText}"` }],
    };
  }

  const escalated = touch(session, now, {
    incidentType: type,
    context: session.context ?? (type ? detectContext(rawText, type) ?? defaultContextFor(type) : detectContext(rawText)),
    severity: "CRITICA",
    criticalKind: effectiveKind,
    reasons: [...new Set([...session.reasons, reason])],
    pendingQuestion: undefined,
  });
  return goToDispatch(escalated, now);
}

/* -------------------------------------------------------------------------- */
/* Tratamento por etapa                                                       */
/* -------------------------------------------------------------------------- */

/** Tenta entender texto livre que descreve o acidente (usado no início e nos menus). */
function handleFreeDescription(session: Session, now: number, raw: string): MachineResult | undefined {
  const type = detectIncidentType(raw);
  if (type) return startTriage(session, now, type, detectContext(raw, type));
  const context = detectContext(raw);
  if (context) {
    return {
      session: touch(session, now, { step: "TIPO", context }),
      replies: [typeMenu(context)],
      effects: [],
    };
  }
  return undefined;
}

function onStart(session: Session, now: number, input: IncomingMessage): MachineResult {
  if (input.kind === "text") {
    const understood = handleFreeDescription(session, now, input.text);
    if (understood) return understood;
  }
  if (input.kind === "choice" && input.id.startsWith(CHOICE.CONTEXT_PREFIX)) {
    return onContext(touch(session, now, { step: "CONTEXTO" }), now, input);
  }
  return { session: touch(session, now, { step: "CONTEXTO" }), replies: welcome(), effects: [] };
}

function onContext(session: Session, now: number, input: IncomingMessage): MachineResult {
  if (input.kind === "choice" && input.id.startsWith(CHOICE.CONTEXT_PREFIX)) {
    const context = input.id.slice(CHOICE.CONTEXT_PREFIX.length) as IncidentContext;
    if (context === "TRANSITO" || context === "DOMESTICO") {
      return { session: touch(session, now, { step: "TIPO", context }), replies: [typeMenu(context)], effects: [] };
    }
  }
  if (input.kind === "text") {
    const n = normalize(input.text);
    if (n === "1") return onContext(session, now, { kind: "choice", id: `${CHOICE.CONTEXT_PREFIX}TRANSITO` });
    if (n === "2") return onContext(session, now, { kind: "choice", id: `${CHOICE.CONTEXT_PREFIX}DOMESTICO` });
    const understood = handleFreeDescription(session, now, input.text);
    if (understood) return understood;
  }
  return { session: touch(session, now, {}), replies: welcome(), effects: [] };
}

function onType(session: Session, now: number, input: IncomingMessage): MachineResult {
  const context = session.context ?? "DOMESTICO";
  const types = typesForContext(context);

  if (input.kind === "choice" && input.id.startsWith(CHOICE.TYPE_PREFIX)) {
    const type = input.id.slice(CHOICE.TYPE_PREFIX.length) as IncidentType;
    if (type in PROTOCOLS) return startTriage(session, now, type, context);
  }
  if (input.kind === "text") {
    const index = Number.parseInt(normalize(input.text), 10);
    const byNumber = Number.isInteger(index) ? types[index - 1] : undefined;
    if (byNumber) return startTriage(session, now, byNumber, context);
    const type = detectIncidentType(input.text);
    if (type) return startTriage(session, now, type, context);
  }
  return {
    session: touch(session, now, {}),
    replies: [text("Não entendi. Escolha uma opção da lista ou descreva o que aconteceu."), typeMenu(context)],
    effects: [],
  };
}

function onQuestion(session: Session, now: number, input: IncomingMessage): MachineResult {
  const type = session.incidentType ?? "OUTRO";
  const qid = session.pendingQuestion ?? nextQuestion(type, session.answers);
  if (!qid) return conclude(session, now);

  let answer: boolean | undefined;
  if (input.kind === "choice") answer = input.id === CHOICE.YES ? true : input.id === CHOICE.NO ? false : undefined;
  if (input.kind === "text") answer = parseYesNo(input.text);

  if (answer === undefined) {
    return {
      session: touch(session, now, {}),
      replies: [questionMessage(type, qid, "Por favor, responda *Sim* ou *Não*.")],
      effects: [],
    };
  }
  const updated = touch(session, now, { answers: { ...session.answers, [qid]: answer }, pendingQuestion: undefined });
  return askNextOrConclude(updated, now);
}

function onAwaitingLocation(session: Session, now: number, input: IncomingMessage): MachineResult {
  const purpose = session.locationPurpose ?? "ALERTA";

  if (input.kind === "location") {
    const withLocation = touch(session, now, {
      location: { lat: input.lat, lng: input.lng, name: input.name, address: input.address, source: "gps" },
      step: "ACOMPANHAMENTO",
    });
    if (purpose === "ALERTA") {
      return { session: withLocation, replies: afterDispatchReplies(withLocation), effects: [{ type: "DISPATCH_ALERT" }] };
    }
    return {
      session: withLocation,
      replies: [followUpButtons("Se a vítima piorar, toque em *Piorou* que eu aciono o hospital.")],
      effects: [{ type: "SUGGEST_HOSPITALS" }],
    };
  }

  if (input.kind === "text") {
    if (purpose === "INDICACAO" && parseYesNo(input.text) === false) {
      return {
        session: touch(session, now, { step: "ACOMPANHAMENTO" }),
        replies: [followUpButtons("Tudo bem. Se a vítima piorar, toque em *Piorou*.")],
        effects: [],
      };
    }
    // Nova informação crítica enquanto esperamos a localização: repete as instruções certas.
    const sign = detectCriticalSign(input.text);
    if (sign) {
      const kind: CriticalKind = session.incidentType === "ENGASGO" && sign.kind === "GERAL" ? "HEIMLICH" : sign.kind;
      return {
        session: touch(session, now, { reasons: [...new Set([...session.reasons, sign.reason])] }),
        replies: [text(CRITICAL_ACTIONS[kind]), locationRequest(purpose)],
        effects: [],
      };
    }
    if (purpose === "ALERTA" && looksLikeAddress(input.text)) {
      // Endereço digitado: abre o chamado mesmo sem GPS (o hospital recebe o texto).
      const withAddress = touch(session, now, {
        location: { address: input.text.trim(), source: "texto" },
        step: "ACOMPANHAMENTO",
      });
      return { session: withAddress, replies: afterDispatchReplies(withAddress), effects: [{ type: "DISPATCH_ALERT" }] };
    }
  }

  return {
    session: touch(session, now, {}),
    replies: [
      text(
        purpose === "ALERTA"
          ? "Preciso da sua *localização* para acionar o hospital."
          : "Para indicar o hospital mais próximo preciso da sua *localização* 📍.",
      ),
      locationRequest(purpose),
    ],
    effects: [],
  };
}

function onFollowUp(session: Session, now: number, input: IncomingMessage): MachineResult {
  if (input.kind === "text") {
    // Usuário descreve um NOVO acidente: começa outra triagem.
    const type = detectIncidentType(input.text);
    if (type && !session.alertId) {
      return startTriage(newSession(session.channel, session.userId, now), now, type, detectContext(input.text, type));
    }
  }
  const status = session.alertId ? `Seu chamado *${session.alertId}* está ativo. ` : "";
  return {
    session: touch(session, now, {}),
    replies: [followUpButtons(`${status}Como posso ajudar? Se a vítima piorar, toque em *Piorou*.`)],
    effects: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Ponto de entrada                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Processa UMA mensagem do usuário.
 * @param session sessão atual (use `newSession` se não existir)
 * @param input mensagem já normalizada pelo adaptador de canal
 * @param now horário atual em ms (injetado para facilitar testes)
 */
export function step(session: Session, input: IncomingMessage, now: number): MachineResult {
  // 1) Comandos globais por botão.
  if (input.kind === "choice") {
    if (input.id === CHOICE.MENU) {
      const fresh = touch(newSession(session.channel, session.userId, now), now, { step: "CONTEXTO" });
      return { session: fresh, replies: welcome(), effects: [] };
    }
    if (input.id === CHOICE.PIOROU) return handleWorsening(session, now);
    if (input.id === CHOICE.RCP) return { session: touch(session, now, {}), replies: [text(CRITICAL_ACTIONS.RCP)], effects: [] };
  }

  // 2) Comandos globais e sinais críticos em texto livre.
  if (input.kind === "text") {
    const command = detectCommand(input.text);
    switch (command) {
      case "MENU": {
        const fresh = touch(newSession(session.channel, session.userId, now), now, { step: "CONTEXTO" });
        return { session: fresh, replies: welcome(), effects: [] };
      }
      case "CANCELAR":
        return {
          session: newSession(session.channel, session.userId, now),
          replies: [text(`Atendimento encerrado. Se precisar, é só mandar uma mensagem.\n\n${EMERGENCY_NUMBERS}`)],
          effects: [],
        };
      case "RCP":
        return { session: touch(session, now, {}), replies: [text(CRITICAL_ACTIONS.RCP)], effects: [] };
      case "PIOROU":
        return handleWorsening(session, now);
      case "AJUDA":
        if (session.step === "INICIO" || session.step === "CONTEXTO") {
          return { session: touch(session, now, { step: "CONTEXTO" }), replies: [text(EMERGENCY_NUMBERS), ...welcome()], effects: [] };
        }
        break;
    }

    const sign = detectCriticalSign(input.text);
    // Só escala se ainda não estamos aguardando a localização de um caso já crítico.
    const alreadyCriticalWaiting = session.severity === "CRITICA" && session.step === "AGUARDANDO_LOCALIZACAO";
    if (sign && !alreadyCriticalWaiting) {
      return handleCriticalSign(session, now, input.text, sign.reason, sign.kind);
    }
  }

  // 3) Tratamento específico da etapa atual.
  switch (session.step) {
    case "INICIO":
      return onStart(session, now, input);
    case "CONTEXTO":
      return onContext(session, now, input);
    case "TIPO":
      return onType(session, now, input);
    case "PERGUNTAS":
      return onQuestion(session, now, input);
    case "AGUARDANDO_LOCALIZACAO":
      return onAwaitingLocation(session, now, input);
    case "ACOMPANHAMENTO":
      return onFollowUp(session, now, input);
  }
}
