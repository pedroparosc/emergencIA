/**
 * Orquestrador (componente C6): liga a máquina de estados pura ao mundo real.
 *
 *   1. carrega a sessão do Store (ou cria uma nova);
 *   2. executa `step()` da máquina de estados;
 *   3. executa os efeitos pedidos (abrir chamado, sugerir hospitais, nota no chamado);
 *   4. salva a sessão e devolve as mensagens a enviar, na ordem certa.
 *
 * É usado tanto pelo webhook do WhatsApp quanto pelo simulador web: os dois canais têm
 * exatamente o mesmo comportamento.
 */
import { addAlertNote, dispatchAlert, suggestHospitalsMessage, type AlertDeps } from "@/lib/alerts/service";
import type { Channel, IncomingMessage, OutgoingMessage, Session } from "@/lib/domain/types";
import { EMERGENCY_NUMBERS } from "@/lib/triage/protocols";
import { newSession, step } from "./machine";

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

export async function handleIncoming(params: HandleParams, deps: AlertDeps): Promise<HandleResult> {
  const now = deps.now();
  const id = `${params.channel}:${params.userId}`;
  let session = await deps.store.getSession(id);
  if (!session || now - session.updatedAt > SESSION_IDLE_RESET_MS) {
    session = newSession(params.channel, params.userId, now);
  }

  const result = step(session, params.input, now);
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
