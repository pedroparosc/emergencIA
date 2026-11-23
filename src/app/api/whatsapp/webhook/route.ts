/**
 * Webhook da WhatsApp Cloud API.
 *
 * GET  — handshake de verificação: a Meta chama com hub.mode=subscribe, hub.verify_token e
 *        hub.challenge; respondemos o challenge se o token bater com WHATSAPP_VERIFY_TOKEN.
 * POST — mensagens dos usuários: valida a assinatura, deduplica, responde 200 imediatamente e
 *        processa a conversa logo depois com `after()` (a Meta reenvia se demorarmos a responder).
 */
import { after } from "next/server";
import { whatsappAppSecret, whatsappVerifyToken } from "@/lib/config";
import { handleIncoming } from "@/lib/conversation/orchestrator";
import { defaultDeps } from "@/lib/server";
import { sendWhatsAppMessages } from "@/lib/whatsapp/client";
import { parseWebhook, type ParsedWhatsAppMessage } from "@/lib/whatsapp/parse";
import { isValidSignature } from "@/lib/whatsapp/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const expected = whatsappVerifyToken();
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Token de verificação inválido", { status: 403 });
}

export async function POST(request: Request): Promise<Response> {
  // O corpo BRUTO é necessário para conferir a assinatura (não use request.json() antes).
  const rawBody = await request.text();

  const secret = whatsappAppSecret();
  if (secret) {
    if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"), secret)) {
      return new Response("Assinatura inválida", { status: 401 });
    }
  } else {
    console.warn("[webhook] WHATSAPP_APP_SECRET não configurado: assinatura NÃO verificada.");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const deps = defaultDeps();
  const messages = parseWebhook(body);
  const fresh: ParsedWhatsAppMessage[] = [];
  for (const m of messages) {
    // A Meta pode entregar a mesma mensagem mais de uma vez.
    if (await deps.store.markMessageProcessed(m.messageId)) fresh.push(m);
  }

  // Processa depois de responder: a função continua viva na Vercel até terminar.
  after(async () => {
    for (const m of fresh) {
      try {
        const { messages: replies } = await handleIncoming({ channel: "whatsapp", userId: m.from, input: m.input }, deps);
        await sendWhatsAppMessages(m.from, replies);
      } catch (error) {
        console.error("[webhook] Erro ao processar mensagem", m.messageId, error);
        await sendWhatsAppMessages(m.from, [
          { kind: "text", text: "⚠️ Tive um problema técnico. Em emergência, *ligue 192 (SAMU)* agora." },
        ]);
      }
    }
  });

  return Response.json({ received: messages.length, processed: fresh.length });
}
