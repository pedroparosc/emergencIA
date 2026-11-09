/**
 * Utilitários compartilhados pelas rotas de API (somente servidor).
 */
import { timingSafeEqual } from "node:crypto";
import { DefaultNotifier } from "@/lib/alerts/notifier";
import type { AlertDeps } from "@/lib/alerts/service";
import { dashboardToken } from "@/lib/config";
import { getStore } from "@/lib/store";

/** Dependências reais (Store configurado + notificador padrão + relógio do sistema). */
export function defaultDeps(): AlertDeps {
  const store = getStore();
  return { store, notifier: new DefaultNotifier(store), now: () => Date.now() };
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
