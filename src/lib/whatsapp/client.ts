/**
 * Cliente de envio da WhatsApp Cloud API (componente C10).
 */
import { whatsappConfig } from "@/lib/config";
import type { OutgoingMessage } from "@/lib/domain/types";
import { toGraphPayload } from "./payload";

/** Remove tudo que não é dígito ("+55 (11) 9..." → "5511 9..."). */
export const onlyDigits = (phone: string): string => phone.replace(/\D/g, "");

/**
 * Envia mensagens em sequência (a ordem importa: instruções antes do pedido de localização).
 * Erros são registrados no log e não interrompem as próximas mensagens.
 * @returns quantidade de mensagens enviadas com sucesso
 */
export async function sendWhatsAppMessages(to: string, messages: OutgoingMessage[]): Promise<number> {
  const config = whatsappConfig();
  if (!config) {
    console.warn("[whatsapp] WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID ausentes: mensagens não enviadas.");
    return 0;
  }
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  let sent = 0;
  for (const message of messages) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(toGraphPayload(onlyDigits(to), message)),
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) sent++;
      else console.error(`[whatsapp] Falha ao enviar (${response.status}):`, await response.text());
    } catch (error) {
      console.error("[whatsapp] Erro de rede ao enviar:", error);
    }
  }
  return sent;
}
