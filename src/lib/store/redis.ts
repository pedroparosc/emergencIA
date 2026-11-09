/**
 * Implementação do Store com Upstash Redis (produção na Vercel).
 *
 * Chaves usadas:
 *   session:<id>        JSON da sessão (TTL 24 h)
 *   alert:<id>          JSON do chamado (TTL 30 dias)
 *   alerts:index        lista de ids de chamados, mais recente primeiro (até 500)
 *   msg:<id>            marcador de mensagem processada (TTL 24 h) — deduplicação
 *   outbox:<sessionId>  lista de mensagens pendentes do simulador (TTL 1 h)
 *
 * O cliente @upstash/redis fala HTTP/REST, ideal para funções serverless (sem conexões TCP
 * persistentes) e serializa/deserializa JSON automaticamente.
 */
import { Redis } from "@upstash/redis";
import type { RedisConfig } from "@/lib/config";
import type { EmergencyAlert, OutgoingMessage, Session } from "@/lib/domain/types";
import {
  ALERT_TTL_SECONDS,
  MAX_ALERTS_INDEX,
  MESSAGE_DEDUP_TTL_SECONDS,
  OUTBOX_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  type Store,
} from "./types";

const ALERTS_INDEX = "alerts:index";

export class RedisStore implements Store {
  readonly kind = "redis" as const;
  private redis: Redis;

  constructor(config: RedisConfig) {
    this.redis = new Redis({ url: config.url, token: config.token });
  }

  async getSession(id: string): Promise<Session | null> {
    return this.redis.get<Session>(`session:${id}`);
  }

  async saveSession(session: Session): Promise<void> {
    await this.redis.set(`session:${session.id}`, session, { ex: SESSION_TTL_SECONDS });
  }

  async saveAlert(alert: EmergencyAlert): Promise<void> {
    const key = `alert:${alert.id}`;
    // Só entra no índice na criação (set com NX não serve aqui porque também atualizamos).
    const exists = await this.redis.exists(key);
    const tx = this.redis.multi();
    tx.set(key, alert, { ex: ALERT_TTL_SECONDS });
    if (!exists) {
      tx.lpush(ALERTS_INDEX, alert.id);
      tx.ltrim(ALERTS_INDEX, 0, MAX_ALERTS_INDEX - 1);
    }
    await tx.exec();
  }

  async getAlert(id: string): Promise<EmergencyAlert | null> {
    return this.redis.get<EmergencyAlert>(`alert:${id}`);
  }

  async listAlerts(limit = 50): Promise<EmergencyAlert[]> {
    const ids = await this.redis.lrange<string>(ALERTS_INDEX, 0, limit - 1);
    if (ids.length === 0) return [];
    const alerts = await this.redis.mget<(EmergencyAlert | null)[]>(...ids.map((id) => `alert:${id}`));
    // Chamados expirados (TTL) somem do resultado.
    return alerts.filter((a): a is EmergencyAlert => Boolean(a));
  }

  async markMessageProcessed(messageId: string): Promise<boolean> {
    // SET NX é atômico: só a primeira execução consegue gravar.
    const result = await this.redis.set(`msg:${messageId}`, 1, { nx: true, ex: MESSAGE_DEDUP_TTL_SECONDS });
    return result === "OK";
  }

  async pushOutbox(sessionId: string, messages: OutgoingMessage[]): Promise<void> {
    if (messages.length === 0) return;
    const key = `outbox:${sessionId}`;
    const tx = this.redis.multi();
    tx.rpush(key, ...messages);
    tx.expire(key, OUTBOX_TTL_SECONDS);
    await tx.exec();
  }

  async drainOutbox(sessionId: string): Promise<OutgoingMessage[]> {
    const key = `outbox:${sessionId}`;
    const tx = this.redis.multi();
    tx.lrange<OutgoingMessage>(key, 0, -1);
    tx.del(key);
    const [messages] = (await tx.exec()) as [OutgoingMessage[], number];
    return messages ?? [];
  }
}
