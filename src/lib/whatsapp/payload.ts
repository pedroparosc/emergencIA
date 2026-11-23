/**
 * Conversão de mensagens de domínio → payload da WhatsApp Cloud API (componente C10).
 * Referência: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 */
import type { OutgoingMessage } from "@/lib/domain/types";

/** Corta textos no limite do WhatsApp para nunca gerar erro 400 na API. */
const clip = (s: string, max: number): string => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

/** Monta o corpo do POST /{phone-number-id}/messages para um destinatário. */
export function toGraphPayload(to: string, message: OutgoingMessage): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };

  switch (message.kind) {
    case "text":
      return { ...base, type: "text", text: { body: clip(message.text, 4096), preview_url: true } };

    case "buttons":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: clip(message.text, 1024) },
          action: {
            buttons: message.buttons.slice(0, 3).map((b) => ({
              type: "reply",
              reply: { id: b.id, title: clip(b.title, 20) },
            })),
          },
        },
      };

    case "list":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: clip(message.text, 1024) },
          action: {
            button: clip(message.buttonLabel, 20),
            sections: [
              {
                title: "Opções",
                rows: message.rows.slice(0, 10).map((r) => ({
                  id: r.id,
                  title: clip(r.title, 24),
                  ...(r.description ? { description: clip(r.description, 72) } : {}),
                })),
              },
            ],
          },
        },
      };

    case "location_request":
      // Mensagem nativa que mostra o botão "Enviar localização" no WhatsApp.
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "location_request_message",
          body: { text: clip(message.text, 1024) },
          action: { name: "send_location" },
        },
      };
  }
}
