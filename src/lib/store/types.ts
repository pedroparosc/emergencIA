/**
 * Contrato de persistência (componente C8).
 *
 * Funções serverless da Vercel não guardam estado entre execuções, por isso sessões e chamados
 * ficam num armazenamento externo. Esta interface permite trocar a implementação (Redis em
 * produção, memória em desenvolvimento/testes) sem mexer no resto do código.
 */
import type { EmergencyAlert, OutgoingMessage, Session } from "@/lib/domain/types";

/** Por quanto tempo uma sessão de conversa fica guardada sem atividade. */
export const SESSION_TTL_SECONDS = 24 * 60 * 60;
/** Por quanto tempo um chamado fica guardado (LGPD: dados mínimos pelo menor tempo útil). */
export const ALERT_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Janela de deduplicação de mensagens do webhook (a Meta pode reenviar a mesma mensagem). */
export const MESSAGE_DEDUP_TTL_SECONDS = 24 * 60 * 60;
/** Mensagens pendentes do simulador expiram rápido. */
export const OUTBOX_TTL_SECONDS = 60 * 60;
/** Quantidade máxima de chamados no índice do painel. */
export const MAX_ALERTS_INDEX = 500;

export interface Store {
  /** "redis" ou "memory" — exibido em /api/health. */
  readonly kind: "redis" | "memory";

  getSession(id: string): Promise<Session | null>;
  saveSession(session: Session): Promise<void>;

  saveAlert(alert: EmergencyAlert): Promise<void>;
  getAlert(id: string): Promise<EmergencyAlert | null>;
  /** Chamados mais recentes primeiro. */
  listAlerts(limit?: number): Promise<EmergencyAlert[]>;

  /**
   * Marca uma mensagem do webhook como processada.
   * @returns `true` na primeira vez; `false` se já tinha sido processada (duplicada).
   */
  markMessageProcessed(messageId: string): Promise<boolean>;

  /** Fila de mensagens para o simulador web (ele busca por polling). */
  pushOutbox(sessionId: string, messages: OutgoingMessage[]): Promise<void>;
  /** Retorna e esvazia a fila do simulador. */
  drainOutbox(sessionId: string): Promise<OutgoingMessage[]>;
}
