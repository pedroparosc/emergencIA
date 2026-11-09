/**
 * Serviço de chamados (componente C9): criação, notas e mudança de status.
 */
import { randomInt } from "node:crypto";
import type {
  AlertStatus,
  EmergencyAlert,
  Hospital,
  HospitalWithDistance,
  OutgoingMessage,
  Session,
} from "@/lib/domain/types";
import { directionsLink, formatDistance, isValidPoint } from "@/lib/geo/distance";
import { defaultHospital, nearestHospitals } from "@/lib/geo/hospitals";
import type { Store } from "@/lib/store";
import type { Notifier } from "./notifier";

export interface AlertDeps {
  store: Store;
  notifier: Notifier;
  now: () => number;
  /** Base de hospitais (injetável para testes). */
  hospitals?: Hospital[];
}

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L) para ditar o protocolo por telefone. */
const PROTOCOL_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Gera um protocolo legível, ex.: "EMG-4F7K2". */
export function generateProtocol(): string {
  let code = "";
  for (let i = 0; i < 5; i++) code += PROTOCOL_ALPHABET[randomInt(PROTOCOL_ALPHABET.length)];
  return `EMG-${code}`;
}

/** Escolhe o hospital: o mais próximo com PS, ou o de referência quando não há GPS. */
function chooseHospital(session: Session, hospitals?: Hospital[]): HospitalWithDistance {
  const loc = session.location;
  if (loc && isValidPoint(loc)) {
    const [nearest] = nearestHospitals(loc, 1, hospitals);
    if (nearest) return nearest;
  }
  return defaultHospital(hospitals);
}

/**
 * Abre o chamado, salva e notifica o hospital.
 * @returns o chamado e as mensagens de confirmação para o usuário
 */
export async function dispatchAlert(
  session: Session,
  deps: AlertDeps,
): Promise<{ alert: EmergencyAlert; messages: OutgoingMessage[] }> {
  if (!session.location) throw new Error("dispatchAlert chamado sem localização na sessão");
  const now = deps.now();
  const hospital = chooseHospital(session, deps.hospitals);

  const alert: EmergencyAlert = {
    id: generateProtocol(),
    createdAt: now,
    updatedAt: now,
    status: "NOVO",
    severity: session.severity ?? "ALTA",
    context: session.context,
    incidentType: session.incidentType,
    reasons: session.reasons,
    location: session.location,
    hospital,
    channel: session.channel,
    contact: session.userId,
    sessionId: session.id,
    notes: [],
  };

  await deps.store.saveAlert(alert);
  await deps.notifier.notifyHospital(alert);

  const distance = Number.isFinite(hospital.distanceKm) ? ` — a ${formatDistance(hospital.distanceKm)} de você` : "";
  const locationNote =
    session.location.source === "texto"
      ? "\n_Recebemos só o endereço digitado; se conseguir, envie também o 📍 pelo WhatsApp._"
      : "";
  return {
    alert,
    messages: [
      {
        kind: "text",
        text:
          `🚑 *Chamado aberto: ${alert.id}*\n` +
          `Hospital acionado: *${hospital.name}*${distance}\n` +
          `${hospital.address}\n\n` +
          "O hospital recebeu sua *localização*, a *gravidade* e o seu *telefone* para contato." +
          locationNote +
          "\n\n📞 Se possível, ligue também para o *192* e informe o protocolo.",
      },
    ],
  };
}

/** Mensagem com os pronto-socorros mais próximos (casos moderados, sem chamado). */
export function suggestHospitalsMessage(session: Session, hospitals?: Hospital[]): OutgoingMessage {
  const loc = session.location;
  if (!loc || !isValidPoint(loc)) {
    return { kind: "text", text: "Não consegui ler sua localização. Procure a UPA ou pronto-socorro mais próximo." };
  }
  const list = nearestHospitals(loc, 3, hospitals)
    .map((h, i) => `${i + 1}. *${h.name}* — ${formatDistance(h.distanceKm)}\n   ${h.address}\n   Rota: ${directionsLink(h)}`)
    .join("\n\n");
  return {
    kind: "text",
    text: `🏥 *Pronto-socorros mais próximos:*\n\n${list}\n\n_Distâncias em linha reta, aproximadas._`,
  };
}

/** Acrescenta uma observação ao chamado e avisa o hospital. */
export async function addAlertNote(alertId: string, note: string, deps: AlertDeps): Promise<EmergencyAlert | null> {
  const alert = await deps.store.getAlert(alertId);
  if (!alert) return null;
  const now = deps.now();
  const updated: EmergencyAlert = { ...alert, updatedAt: now, notes: [...alert.notes, { at: now, text: note }] };
  await deps.store.saveAlert(updated);
  await deps.notifier.notifyHospital(updated, note);
  return updated;
}

/** Mensagem enviada ao usuário em cada mudança de status. */
export function statusMessage(alert: EmergencyAlert): string | undefined {
  const h = alert.hospital.name;
  switch (alert.status) {
    case "VISUALIZADO":
      return `👀 O *${h}* visualizou seu chamado *${alert.id}*. Mantenha o celular por perto.`;
    case "A_CAMINHO":
      return `🚑 *Equipe a caminho!* O *${h}* está enviando atendimento (chamado *${alert.id}*). Fique com a vítima e, se puder, aguarde em local visível.`;
    case "FINALIZADO":
      return `✅ O chamado *${alert.id}* foi finalizado pelo *${h}*. Esperamos que esteja tudo bem! Envie *menu* se precisar de algo.`;
    case "CANCELADO":
      return `O chamado *${alert.id}* foi cancelado pelo hospital. Se ainda precisar de ajuda, ligue *192*.`;
    default:
      return undefined;
  }
}

/** Atualiza o status (pelo painel do hospital) e avisa o usuário. */
export async function updateAlertStatus(
  alertId: string,
  status: AlertStatus,
  deps: AlertDeps,
): Promise<EmergencyAlert | null> {
  const alert = await deps.store.getAlert(alertId);
  if (!alert) return null;
  if (alert.status === status) return alert;
  const updated: EmergencyAlert = { ...alert, status, updatedAt: deps.now() };
  await deps.store.saveAlert(updated);
  const text = statusMessage(updated);
  if (text) {
    await deps.notifier.notifyUser(updated.channel, updated.contact, updated.sessionId, [{ kind: "text", text }]);
  }
  return updated;
}
