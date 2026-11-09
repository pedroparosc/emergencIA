/**
 * API do simulador web — mesmo motor de conversa do WhatsApp, sem precisar da Meta.
 *
 * POST { sessionId, input }  → { messages }  processa uma mensagem do usuário
 * GET  ?sessionId=...        → { messages }  mensagens assíncronas pendentes (ex.: status do chamado)
 */
import { z } from "zod";
import { simulatorEnabled } from "@/lib/config";
import { handleIncoming } from "@/lib/conversation/orchestrator";
import { defaultDeps } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Id anônimo gerado no navegador (sem dados pessoais). */
const SessionId = z.string().regex(/^[a-zA-Z0-9-]{8,64}$/);

const Input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().min(1).max(1000) }),
  z.object({ kind: z.literal("choice"), id: z.string().min(1).max(256), title: z.string().max(100).optional() }),
  z.object({
    kind: z.literal("location"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    name: z.string().max(200).optional(),
    address: z.string().max(300).optional(),
  }),
]);

const Body = z.object({ sessionId: SessionId, input: Input });

const disabled = () => Response.json({ error: "Simulador desativado" }, { status: 404 });

export async function POST(request: Request): Promise<Response> {
  if (!simulatorEnabled()) return disabled();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Requisição inválida", issues: parsed.error.issues }, { status: 400 });
  }
  const { sessionId, input } = parsed.data;
  const { messages, session } = await handleIncoming({ channel: "simulator", userId: sessionId, input }, defaultDeps());
  return Response.json({ messages, step: session.step, severity: session.severity ?? null, alertId: session.alertId ?? null });
}

export async function GET(request: Request): Promise<Response> {
  if (!simulatorEnabled()) return disabled();
  const parsed = SessionId.safeParse(new URL(request.url).searchParams.get("sessionId"));
  if (!parsed.success) return Response.json({ error: "sessionId inválido" }, { status: 400 });
  const messages = await defaultDeps().store.drainOutbox(`simulator:${parsed.data}`);
  return Response.json({ messages });
}
