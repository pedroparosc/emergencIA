/**
 * GET   /api/alerts/:id                — detalhes de um chamado
 * PATCH /api/alerts/:id { status }     — muda o status e avisa o usuário
 * Requer o token do painel (DASHBOARD_TOKEN).
 */
import { z } from "zod";
import { updateAlertStatus } from "@/lib/alerts/service";
import { defaultDeps, isDashboardAuthorized, unauthorized } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const Patch = z.object({ status: z.enum(["NOVO", "VISUALIZADO", "A_CAMINHO", "FINALIZADO", "CANCELADO"]) });

export async function GET(request: Request, { params }: Context): Promise<Response> {
  if (!isDashboardAuthorized(request)) return unauthorized();
  const { id } = await params;
  const alert = await defaultDeps().store.getAlert(id);
  return alert ? Response.json({ alert }) : Response.json({ error: "Chamado não encontrado" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  if (!isDashboardAuthorized(request)) return unauthorized();
  const { id } = await params;
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Status inválido" }, { status: 400 });
  const alert = await updateAlertStatus(id, parsed.data.status, defaultDeps());
  return alert ? Response.json({ alert }) : Response.json({ error: "Chamado não encontrado" }, { status: 404 });
}
