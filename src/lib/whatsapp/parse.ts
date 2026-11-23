/**
 * Conversão do payload do webhook da Meta → mensagens de domínio (componente C10).
 * Referência: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */
import type { IncomingMessage } from "@/lib/domain/types";

/** Mensagem recebida já traduzida, com metadados para deduplicação e resposta. */
export interface ParsedWhatsAppMessage {
  /** id da mensagem na Meta (wamid...), usado para deduplicação. */
  messageId: string;
  /** Telefone do remetente (só dígitos, com DDI), usado para responder. */
  from: string;
  /** Nome do perfil do WhatsApp, se disponível. */
  profileName?: string;
  input: IncomingMessage;
}

/* Tipos mínimos do payload que usamos (o payload real tem muitos outros campos). */
interface WaMessage {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  interactive?: {
    type?: string;
    button_reply?: { id: string; title?: string };
    list_reply?: { id: string; title?: string };
  };
  button?: { payload?: string; text?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
}

interface WaWebhook {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: WaMessage[];
      };
    }>;
  }>;
}

/** Converte uma mensagem da Meta em entrada de domínio. Tipos não suportados → `undefined`. */
function toIncoming(m: WaMessage): IncomingMessage | undefined {
  switch (m.type) {
    case "text":
      return m.text?.body ? { kind: "text", text: m.text.body } : undefined;
    case "interactive": {
      const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
      return reply ? { kind: "choice", id: reply.id, title: reply.title } : undefined;
    }
    case "button": // botão de template
      return m.button?.payload ? { kind: "choice", id: m.button.payload, title: m.button.text } : undefined;
    case "location":
      return m.location
        ? {
            kind: "location",
            lat: Number(m.location.latitude),
            lng: Number(m.location.longitude),
            name: m.location.name,
            address: m.location.address,
          }
        : undefined;
    default:
      // Áudio, imagem, figurinha etc. — tratados como texto vazio para o bot pedir texto.
      return { kind: "text", text: `[${m.type}]` };
  }
}

/**
 * Extrai todas as mensagens de usuário do webhook. Notificações de status (entregue, lida) são
 * ignoradas. Nunca lança exceção: payload inválido → lista vazia.
 */
export function parseWebhook(body: unknown): ParsedWhatsAppMessage[] {
  const payload = body as WaWebhook;
  if (!payload || payload.object !== "whatsapp_business_account") return [];
  const result: ParsedWhatsAppMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;
      for (const m of value.messages) {
        const input = toIncoming(m);
        if (!input || !m.id || !m.from) continue;
        const contact = value.contacts?.find((c) => c.wa_id === m.from) ?? value.contacts?.[0];
        result.push({ messageId: m.id, from: m.from, profileName: contact?.profile?.name, input });
      }
    }
  }
  return result;
}
