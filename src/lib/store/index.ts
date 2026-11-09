/**
 * Fábrica do Store: Redis se configurado, senão memória.
 * A instância fica em `globalThis` para sobreviver ao hot-reload do `next dev`.
 */
import { redisConfig } from "@/lib/config";
import { MemoryStore } from "./memory";
import { RedisStore } from "./redis";
import type { Store } from "./types";

export type { Store } from "./types";
export { MemoryStore } from "./memory";

const globalForStore = globalThis as unknown as { __emergenciaStore?: Store };

export function getStore(): Store {
  if (!globalForStore.__emergenciaStore) {
    const config = redisConfig();
    globalForStore.__emergenciaStore = config ? new RedisStore(config) : new MemoryStore();
    if (!config && process.env.VERCEL) {
      console.warn("[emergencIA] Upstash Redis não configurado: usando memória (dados serão perdidos).");
    }
  }
  return globalForStore.__emergenciaStore;
}
