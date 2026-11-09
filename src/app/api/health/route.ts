/**
 * GET /api/health — diagnóstico da configuração (sem expor segredos).
 * Útil logo após o deploy para conferir se as variáveis de ambiente foram lidas.
 */
import { dashboardToken, simulatorEnabled, whatsappAppSecret, whatsappConfig, whatsappVerifyToken } from "@/lib/config";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({
    status: "ok",
    store: getStore().kind,
    whatsapp: Boolean(whatsappConfig()),
    webhookVerifyToken: Boolean(whatsappVerifyToken()),
    webhookSignature: Boolean(whatsappAppSecret()),
    dashboardProtected: Boolean(dashboardToken()),
    simulator: simulatorEnabled(),
    time: new Date().toISOString(),
  });
}
