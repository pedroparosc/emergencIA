/**
 * Utilitários compartilhados pelas rotas de API (somente servidor).
 */
import { timingSafeEqual } from "node:crypto";
import { createDeciderInterpreter } from "@/lib/ai/decider";
import { DefaultNotifier } from "@/lib/alerts/notifier";
import { aiConfig, dashboardToken } from "@/lib/config";
import type { OrchestratorDeps } from "@/lib/conversation/orchestrator";
import { getStore } from "@/lib/store";

/**
 * Dependências reais: Store configurado, notificador padrão, relógio do sistema e, se
 * OPENROUTER_API_KEY estiver definida, a IA da triagem.
 */
export function defaultDeps(): OrchestratorDeps {
  const store = getStore();
  const ai = aiConfig();
  return {
    store,
    notifier: new DefaultNotifier(store),
    now: () => Date.now(),
    interpret: ai ? createDeciderInterpreter(ai) : undefined,
  };
}

/**
 * Verifica o token do painel do hospital. Aceita `Authorization: Bearer <token>` ou o
 * cabeçalho `x-dashboard-token`. Sem DASHBOARD_TOKEN configurado, o acesso é liberado
 * (apenas para desenvolvimento — configure-o na Vercel!).
 */
export function isDashboardAuthorized(request: Request): boolean {
  const expected = dashboardToken();
  if (!expected) return true;
  const header = request.headers.get("authorization");
  const received = header?.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-dashboard-token");
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Resposta 401 padrão. */
export const unauthorized = (): Response =>
  Response.json({ error: "Não autorizado. Informe o token do painel." }, { status: 401 });
