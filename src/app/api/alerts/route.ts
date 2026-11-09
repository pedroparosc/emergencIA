/**
 * GET /api/alerts?limit=50 — lista de chamados para o painel do hospital (mais recentes primeiro).
 * Requer o token do painel (DASHBOARD_TOKEN).
 */
import { defaultDeps, isDashboardAuthorized, unauthorized } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isDashboardAuthorized(request)) return unauthorized();
  const limitParam = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
  const alerts = await defaultDeps().store.listAlerts(limit);
  return Response.json({ alerts });
}
