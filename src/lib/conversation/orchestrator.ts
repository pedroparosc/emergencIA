/**
 * Orquestrador (componente C6): liga a máquina de estados pura ao mundo real.
 *
 *   1. carrega a sessão do Store (ou cria uma nova);
 *   1b. se o texto livre não foi reconhecido pelas regras, pede pistas à IA (opcional, F7.1);
 *   2. executa `step()` da máquina de estados;
 *   3. executa os efeitos pedidos (abrir chamado, sugerir hospitais, nota no chamado);
 *   4. salva a sessão e devolve as mensagens a enviar, na ordem certa.
 *
 * É usado tanto pelo webhook do WhatsApp quanto pelo simulador web: os dois canais têm
 * exatamente o mesmo comportamento.
 */
import type { TextInterpreter } from "@/lib/ai/decider";
import { addAlertNote, dispatchAlert, suggestHospitalsMessage, type AlertDeps } from "@/lib/alerts/service";
import type { Channel, IncomingMessage, OutgoingMessage, Session } from "@/lib/domain/types";
import { detectCommand, detectCriticalSign, normalize, type NluHints } from "@/lib/triage/nlu";
import { EMERGENCY_NUMBERS } from "@/lib/triage/protocols";
import { looksLikeAddress, newSession, step } from "./machine";

export interface OrchestratorDeps extends AlertDeps {
  /** IA da triagem (opcional). Sem ela, só as regras por palavras-chave são usadas. */
  interpret?: TextInterpreter;
}

/** Textos com menos palavras que isso ("sim", "não sei", "ok") não vão para a IA. */
const MIN_WORDS_FOR_AI = 3;

/**
 * Decide se vale consultar a IA para esta mensagem. Só texto livre com algum conteúdo, que não
 * seja comando, não tenha sinal crítico já reconhecido pelas regras e não seja um endereço
 * digitado enquanto esperamos a localização.
 */
export function shouldInterpret(session: Session, input: IncomingMessage): boolean {
  if (input.kind !== "text") return false;
  const words = normalize(input.text).split(" ").filter(Boolean);
  if (words.length < MIN_WORDS_FOR_AI) return false;
  if (detectCommand(input.text)) return false;
  if (detectCriticalSign(input.text)) return false;
  if (session.step === "AGUARDANDO_LOCALIZACAO" && looksLikeAddress(input.text)) return false;
  return true;
}

/** Depois deste tempo sem mensagens, a conversa recomeça do zero. */
export const SESSION_IDLE_RESET_MS = 6 * 60 * 60 * 1000;

export interface HandleParams {
  channel: Channel;
  /** Telefone (WhatsApp) ou id anônimo (simulador). */
  userId: string;
  input: IncomingMessage;
}

export interface HandleResult {
  session: Session;
  messages: OutgoingMessage[];
}

/** Mensagem de segurança se algo falhar ao abrir o chamado. */
const DISPATCH_FAILURE: OutgoingMessage = {
  kind: "text",
  text:
    "⚠️ *Não consegui acionar o hospital automaticamente.*\n" +
    `*LIGUE 192 AGORA.*\n\n${EMERGENCY_NUMBERS}`,
};

export async function handleIncoming(params: HandleParams, deps: OrchestratorDeps): Promise<HandleResult> {
  const now = deps.now();
  const id = `${params.channel}:${params.userId}`;
  let session = await deps.store.getSession(id);
  if (!session || now - session.updatedAt > SESSION_IDLE_RESET_MS) {
    session = newSession(params.channel, params.userId, now);
  }

  let hints: NluHints | undefined;
  if (deps.interpret && params.input.kind === "text" && shouldInterpret(session, params.input)) {
    try {
      hints = await deps.interpret(params.input.text);
    } catch (error) {
      // O interpretador não deveria lançar, mas a conversa nunca pode parar por causa da IA.
      console.error("[orchestrator] Falha na IA da triagem:", error);
    }
  }

  const result = step(session, params.input, now, hints);
  let current = result.session;
  const replies = [...result.replies];
  // Mensagens geradas pelos efeitos, com a posição onde devem entrar nas respostas.
  const inserts: Array<{ at: number; messages: OutgoingMessage[] }> = [];

  for (const effect of result.effects) {
    try {
      switch (effect.type) {
        case "DISPATCH_ALERT": {
          const { alert, messages } = await dispatchAlert(current, deps);
          current = { ...current, alertId: alert.id };
          inserts.push({ at: effect.insertAt ?? 0, messages });
          break;
        }
        case "SUGGEST_HOSPITALS":
          inserts.push({ at: 0, messages: [suggestHospitalsMessage(current, deps.hospitals)] });
          break;
        case "ADD_ALERT_NOTE":
          if (current.alertId) await addAlertNote(current.alertId, effect.note, deps);
          break;
      }
    } catch (error) {
      console.error(`[orchestrator] Falha no efeito ${effect.type}:`, error);
      if (effect.type === "DISPATCH_ALERT") inserts.push({ at: 0, messages: [DISPATCH_FAILURE] });
    }
  }

  // Insere de trás para frente para não deslocar as posições ainda não usadas.
  for (const insert of [...inserts].sort((a, b) => b.at - a.at)) {
    replies.splice(Math.min(insert.at, replies.length), 0, ...insert.messages);
  }

  await deps.store.saveSession(current);
  return { session: current, messages: replies };
}
