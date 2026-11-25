/**
 * GET /api/health — diagnóstico da configuração (sem expor segredos).
 * Útil logo após o deploy para conferir se as variáveis de ambiente foram lidas.
 */
import {
  aiConfig,
  dashboardToken,
  simulatorEnabled,
  whatsappAppSecret,
  whatsappConfig,
  whatsappVerifyToken,
} from "@/lib/config";
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
    // IA da triagem: o nome do modelo, ou false se OPENROUTER_API_KEY não estiver definida.
    ai: aiConfig()?.model ?? false,
    time: new Date().toISOString(),
  });
}
