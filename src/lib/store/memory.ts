/**
 * Implementação em memória do Store — para desenvolvimento local e testes.
 *
 * ⚠️ Na Vercel, cada instância da função tem a própria memória e ela é descartada a qualquer
 * momento: NÃO use em produção (configure o Upstash Redis).
 */
import type { EmergencyAlert, OutgoingMessage, Session } from "@/lib/domain/types";
import { MAX_ALERTS_INDEX, type Store } from "./types";

export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private sessions = new Map<string, Session>();
  private alerts = new Map<string, EmergencyAlert>();
  private alertIndex: string[] = [];
  private processed = new Set<string>();
  private outbox = new Map<string, OutgoingMessage[]>();

  async getSession(id: string): Promise<Session | null> {
    const s = this.sessions.get(id);
    return s ? structuredClone(s) : null;
  }

  async saveSession(session: Session): Promise<void> {
    this.sessions.set(session.id, structuredClone(session));
  }

  async saveAlert(alert: EmergencyAlert): Promise<void> {
    if (!this.alerts.has(alert.id)) {
      this.alertIndex.unshift(alert.id);
      this.alertIndex = this.alertIndex.slice(0, MAX_ALERTS_INDEX);
    }
    this.alerts.set(alert.id, structuredClone(alert));
  }

  async getAlert(id: string): Promise<EmergencyAlert | null> {
    const a = this.alerts.get(id);
    return a ? structuredClone(a) : null;
  }

  async listAlerts(limit = 50): Promise<EmergencyAlert[]> {
    return this.alertIndex
      .slice(0, limit)
      .map((id) => this.alerts.get(id))
      .filter((a): a is EmergencyAlert => Boolean(a))
      .map((a) => structuredClone(a));
  }

  async markMessageProcessed(messageId: string): Promise<boolean> {
    if (this.processed.has(messageId)) return false;
    this.processed.add(messageId);
    return true;
  }

  async pushOutbox(sessionId: string, messages: OutgoingMessage[]): Promise<void> {
    this.outbox.set(sessionId, [...(this.outbox.get(sessionId) ?? []), ...messages]);
  }

  async drainOutbox(sessionId: string): Promise<OutgoingMessage[]> {
    const messages = this.outbox.get(sessionId) ?? [];
    this.outbox.delete(sessionId);
    return messages;
  }
}
