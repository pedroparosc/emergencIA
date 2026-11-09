/**
 * Notificações (componente C9): avisa o HOSPITAL sobre chamados e o USUÁRIO sobre mudanças de
 * status. O painel web não precisa de aviso ativo: ele lê o Store por polling.
 *
 * Canais do hospital (todos opcionais e independentes):
 *   1. WhatsApp do hospital (campo `whatsapp` do hospital) e/ou HOSPITAL_NOTIFY_WHATSAPP;
 *   2. Webhook HTTP (HOSPITAL_WEBHOOK_URL) com o JSON do chamado.
 * Falhas são registradas em log e NUNCA impedem a resposta ao usuário.
 */
import { hospitalNotifyWhatsApp, hospitalWebhookUrl } from "@/lib/config";
import type { Channel, EmergencyAlert, OutgoingMessage } from "@/lib/domain/types";
import { formatDistance, isValidPoint, mapsLink } from "@/lib/geo/distance";
import { SEVERITY_LABEL } from "@/lib/triage/engine";
import { PROTOCOLS } from "@/lib/triage/protocols";
import type { Store } from "@/lib/store";
import { sendWhatsAppMessages } from "@/lib/whatsapp/client";

export interface Notifier {
  /** Chamado novo ou atualizado (`update` descreve a mudança, ex.: nota de piora). */
  notifyHospital(alert: EmergencyAlert, update?: string): Promise<void>;
  /** Mensagens para o usuário fora do fluxo normal de resposta (ex.: "equipe a caminho"). */
  notifyUser(channel: Channel, userId: string, sessionId: string, messages: OutgoingMessage[]): Promise<void>;
}

/** Texto do chamado para o hospital (WhatsApp). */
export function hospitalAlertText(alert: EmergencyAlert, update?: string): string {
  const where = isValidPoint(alert.location)
    ? `📍 ${mapsLink(alert.location)}${alert.location.address ? `\n${alert.location.address}` : ""}`
    : `📍 Endereço informado: ${alert.location.address ?? "não informado"}`;
  const type = alert.incidentType ? PROTOCOLS[alert.incidentType].label : "Não identificado";
  const header = update
    ? `🔔 *ATUALIZAÇÃO — chamado ${alert.id}*\n${update}\n`
    : `🚨 *NOVO CHAMADO emergencIA — ${alert.id}*\n`;
  return (
    `${header}\n` +
    `Gravidade: *${SEVERITY_LABEL[alert.severity]}*\n` +
    `Ocorrência: ${type}${alert.context ? ` (${alert.context === "TRANSITO" ? "trânsito" : "doméstico"})` : ""}\n` +
    `Motivos: ${alert.reasons.join("; ") || "—"}\n` +
    `${where}\n` +
    (Number.isFinite(alert.hospital.distanceKm) ? `Distância até o hospital: ${formatDistance(alert.hospital.distanceKm)}\n` : "") +
    `Contato: ${alert.channel === "whatsapp" ? `+${alert.contact}` : "simulador (demonstração)"}`
  );
}

/** Implementação padrão usada pelas rotas de API. */
export class DefaultNotifier implements Notifier {
  constructor(private store: Store) {}

  async notifyHospital(alert: EmergencyAlert, update?: string): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    const recipients = new Set([alert.hospital.whatsapp, hospitalNotifyWhatsApp()].filter(Boolean) as string[]);
    for (const to of recipients) {
      tasks.push(sendWhatsAppMessages(to, [{ kind: "text", text: hospitalAlertText(alert, update) }]));
    }
    const webhook = hospitalWebhookUrl();
    if (webhook) {
      tasks.push(
        fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: update ? "alert.updated" : "alert.created", update, alert }),
          signal: AbortSignal.timeout(5000),
        }).catch((error) => console.error("[notifier] Falha no webhook do hospital:", error)),
      );
    }
    const results = await Promise.allSettled(tasks);
    results.filter((r) => r.status === "rejected").forEach((r) => console.error("[notifier]", r));
  }

  async notifyUser(channel: Channel, userId: string, sessionId: string, messages: OutgoingMessage[]): Promise<void> {
    if (channel === "whatsapp") await sendWhatsAppMessages(userId, messages);
    else await this.store.pushOutbox(sessionId, messages);
  }
}
