/**
 * Motor de triagem (componente C4).
 *
 * Sistema especialista baseado em regras: cada resposta de perigo eleva a gravidade conforme a
 * tabela de perguntas (protocols.ts). A gravidade final é o MÁXIMO entre:
 *   - a gravidade mínima do tipo de acidente (ex.: atropelamento ≥ ALTA);
 *   - a gravidade de cada resposta de perigo;
 *   - sinais críticos detectados no texto livre (tratados na máquina de estados).
 *
 * Princípio de segurança: na dúvida, classificar para CIMA. Um falso alarme custa menos que um
 * caso grave subestimado.
 */
import type {
  CriticalKind,
  Disposition,
  IncidentType,
  QuestionId,
  Session,
  Severity,
} from "@/lib/domain/types";
import { PROTOCOLS, QUESTIONS } from "./protocols";

/** Ordem de gravidade, para comparar níveis. */
export const SEVERITY_RANK: Record<Severity, number> = {
  BAIXA: 0,
  MODERADA: 1,
  ALTA: 2,
  CRITICA: 3,
};

/** Retorna a mais grave entre duas gravidades. */
export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/** Conduta para cada gravidade. */
export function dispositionFor(severity: Severity): Disposition {
  switch (severity) {
    case "CRITICA":
    case "ALTA":
      return "ACIONAR_HOSPITAL";
    case "MODERADA":
      return "INDICAR_HOSPITAL";
    case "BAIXA":
      return "CUIDADOS_EM_CASA";
  }
}

/** Rótulos amigáveis para exibição (bot e painel). */
export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICA: "🔴 CRÍTICA",
  ALTA: "🟠 ALTA",
  MODERADA: "🟡 MODERADA",
  BAIXA: "🟢 BAIXA",
};

export interface TriageResult {
  severity: Severity;
  reasons: string[];
  /** Natureza da situação crítica (define as instruções imediatas). */
  criticalKind?: CriticalKind;
}

/**
 * Respostas que podem ser deduzidas de outras, para não fazer perguntas óbvias.
 * Ex.: se a pessoa engasgada consegue falar, ela está consciente.
 */
function withImpliedAnswers(
  answers: Partial<Record<QuestionId, boolean>>,
): Partial<Record<QuestionId, boolean>> {
  const result = { ...answers };
  if (result.CONSEGUE_TOSSIR === true && result.CONSCIENTE === undefined) result.CONSCIENTE = true;
  return result;
}

/** Avalia a gravidade a partir do tipo de acidente e das respostas dadas até agora. */
export function evaluate(
  type: IncidentType,
  answers: Partial<Record<QuestionId, boolean>>,
): TriageResult {
  const protocol = PROTOCOLS[type];
  let severity: Severity = protocol.minSeverity;
  const reasons: string[] = [];
  let criticalKind: CriticalKind | undefined;

  if (protocol.minSeverity !== "BAIXA") {
    reasons.push(`${protocol.label}: exige avaliação médica`);
  }

  const all = withImpliedAnswers(answers);
  for (const qid of protocol.questions) {
    const answer = all[qid];
    if (answer === undefined) continue;
    const q = QUESTIONS[qid];
    if (answer === q.dangerAnswer) {
      severity = maxSeverity(severity, q.severityIfDanger);
      reasons.push(q.reason);
      // A primeira situação crítica encontrada define as instruções imediatas.
      if (q.severityIfDanger === "CRITICA" && !criticalKind) criticalKind = q.criticalKind;
    }
  }

  // Caso especial: inconsciente E sem respirar → massagem cardíaca tem prioridade.
  if (all.CONSCIENTE === false && all.RESPIRA === false) criticalKind = "RCP";

  return { severity, reasons, criticalKind };
}

/**
 * Próxima pergunta a fazer, ou `undefined` quando a triagem terminou.
 * A triagem termina mais cedo quando já é CRÍTICA: cada segundo conta.
 */
export function nextQuestion(
  type: IncidentType,
  answers: Partial<Record<QuestionId, boolean>>,
): QuestionId | undefined {
  if (evaluate(type, answers).severity === "CRITICA") return undefined;
  const all = withImpliedAnswers(answers);
  return PROTOCOLS[type].questions.find((qid) => all[qid] === undefined);
}

/**
 * Combina o resultado da triagem com a gravidade que a sessão já tinha (ex.: um sinal crítico
 * detectado no texto livre). Nunca reduz a gravidade.
 */
export function mergeWithSession(session: Session, result: TriageResult): TriageResult {
  const previous = session.severity ?? "BAIXA";
  const severity = maxSeverity(previous, result.severity);
  const reasons = [...new Set([...session.reasons, ...result.reasons])];
  const criticalKind = session.criticalKind ?? result.criticalKind;
  return { severity, reasons, criticalKind: severity === "CRITICA" ? criticalKind ?? "GERAL" : undefined };
}
