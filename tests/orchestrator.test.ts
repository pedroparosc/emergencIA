import { beforeEach, describe, expect, it } from "vitest";
import { generateProtocol, updateAlertStatus, type AlertDeps } from "@/lib/alerts/service";
import { hospitalAlertText, type Notifier } from "@/lib/alerts/notifier";
import { CHOICE } from "@/lib/conversation/machine";
import { handleIncoming, SESSION_IDLE_RESET_MS } from "@/lib/conversation/orchestrator";
import type { EmergencyAlert, IncomingMessage, OutgoingMessage } from "@/lib/domain/types";
import { MemoryStore } from "@/lib/store";

/** Notificador falso que só registra as chamadas. */
class FakeNotifier implements Notifier {
  hospital: Array<{ alert: EmergencyAlert; update?: string }> = [];
  user: Array<{ userId: string; messages: OutgoingMessage[] }> = [];
  async notifyHospital(alert: EmergencyAlert, update?: string) {
    this.hospital.push({ alert, update });
  }
  async notifyUser(_c: string, userId: string, _s: string, messages: OutgoingMessage[]) {
    this.user.push({ userId, messages });
  }
}

const PAULISTA = { lat: -23.5614, lng: -46.6559 };

describe("handleIncoming", () => {
  let store: MemoryStore;
  let notifier: FakeNotifier;
  let clock: number;
  let deps: AlertDeps;
  const send = (input: IncomingMessage | string, userId = "5511999990000") =>
    handleIncoming(
      { channel: "whatsapp", userId, input: typeof input === "string" ? { kind: "text", text: input } : input },
      deps,
    );

  beforeEach(() => {
    store = new MemoryStore();
    notifier = new FakeNotifier();
    clock = 1_700_000_000_000;
    deps = { store, notifier, now: () => (clock += 1000) };
  });

  it("caso grave: abre chamado no hospital mais próximo e notifica", async () => {
    await send("meu pai caiu da escada e não acorda");
    const r = await send({ kind: "location", ...PAULISTA });

    const [alert] = await store.listAlerts();
    expect(alert).toBeDefined();
    expect(alert!.id).toMatch(/^EMG-[2-9A-Z]{5}$/);
    expect(alert!.severity).toBe("CRITICA");
    expect(alert!.incidentType).toBe("QUEDA");
    expect(alert!.contact).toBe("5511999990000");
    expect(["hc-fmusp", "santa-casa-sp"]).toContain(alert!.hospital.id);
    expect(notifier.hospital).toHaveLength(1);

    // Confirmação do chamado vem ANTES do passo a passo.
    expect(r.messages[0]?.text).toContain(`Chamado aberto: ${alert!.id}`);
    expect(r.session.alertId).toBe(alert!.id);
    expect((await store.getSession("whatsapp:5511999990000"))?.alertId).toBe(alert!.id);
  });

  it("caso moderado: sugere hospitais sem abrir chamado", async () => {
    await send("cortei a mão com vidro");
    await send({ kind: "choice", id: CHOICE.YES });
    await send({ kind: "choice", id: CHOICE.NO });
    await send({ kind: "choice", id: CHOICE.NO });
    await send({ kind: "choice", id: CHOICE.YES });
    const r = await send({ kind: "location", ...PAULISTA });
    expect(await store.listAlerts()).toHaveLength(0);
    expect(r.messages[0]?.text).toContain("Pronto-socorros mais próximos");
  });

  it("piora depois do chamado vira nota e o hospital é avisado", async () => {
    await send("ela desmaiou");
    await send({ kind: "location", ...PAULISTA });
    await send("piorou");
    const [alert] = await store.listAlerts();
    expect(alert!.notes[0]?.text).toContain("PIORA");
    expect(notifier.hospital.at(-1)?.update).toContain("PIORA");
  });

  it("'piorou' depois da indicação de hospital aciona com a localização já conhecida", async () => {
    await send("levou choque na tomada");
    await send({ kind: "choice", id: CHOICE.YES });
    await send({ kind: "choice", id: CHOICE.YES });
    await send({ kind: "choice", id: CHOICE.NO });
    await send({ kind: "location", ...PAULISTA });
    const r = await send({ kind: "choice", id: CHOICE.PIOROU });
    expect(await store.listAlerts()).toHaveLength(1);
    // Banner de caso grave primeiro, depois a confirmação do chamado.
    expect(r.messages[0]?.text).toContain("CASO GRAVE");
    expect(r.messages[1]?.text).toContain("Chamado aberto");
  });

  it("endereço digitado usa o hospital de referência", async () => {
    await send("ela desmaiou");
    await send("Rua Vergueiro, 1000");
    const [alert] = await store.listAlerts();
    expect(alert!.location.source).toBe("texto");
    expect(alert!.hospital.id).toBe("hc-fmusp");
    expect(Number.isNaN(alert!.hospital.distanceKm)).toBe(true);
  });

  it("falha ao salvar o chamado → manda ligar 192", async () => {
    await send("ela desmaiou");
    store.saveAlert = async () => {
      throw new Error("Redis fora do ar");
    };
    const r = await send({ kind: "location", ...PAULISTA });
    expect(r.messages[0]?.text).toContain("LIGUE 192 AGORA");
  });

  it("sessão parada há muito tempo recomeça", async () => {
    await send("bati o carro");
    clock += SESSION_IDLE_RESET_MS + 1;
    const r = await send("ok");
    expect(r.session.step).toBe("CONTEXTO");
  });

  it("mudança de status avisa o usuário", async () => {
    await send("ela desmaiou");
    await send({ kind: "location", ...PAULISTA });
    const [alert] = await store.listAlerts();
    const updated = await updateAlertStatus(alert!.id, "A_CAMINHO", deps);
    expect(updated?.status).toBe("A_CAMINHO");
    expect(notifier.user[0]?.messages[0]?.text).toContain("Equipe a caminho");
  });
});

describe("utilitários de chamado", () => {
  it("protocolos são únicos na prática", () => {
    const set = new Set(Array.from({ length: 500 }, generateProtocol));
    expect(set.size).toBeGreaterThan(495);
  });

  it("texto para o hospital tem link do mapa e contato", () => {
    const text = hospitalAlertText({
      id: "EMG-ABCDE",
      createdAt: 0,
      updatedAt: 0,
      status: "NOVO",
      severity: "CRITICA",
      incidentType: "QUEDA",
      context: "DOMESTICO",
      reasons: ["Vítima inconsciente"],
      location: { ...PAULISTA, source: "gps" },
      hospital: { id: "x", name: "X", address: "", lat: 0, lng: 0, hasEmergency: true, kind: "PUBLICO", distanceKm: 1.2 },
      channel: "whatsapp",
      contact: "5511999990000",
      sessionId: "whatsapp:5511999990000",
      notes: [],
    });
    expect(text).toContain("https://www.google.com/maps?q=-23.5614,-46.6559");
    expect(text).toContain("+5511999990000");
    expect(text).toContain("Vítima inconsciente");
  });
});

describe("deduplicação", () => {
  it("a mesma mensagem só é processada uma vez", async () => {
    const store = new MemoryStore();
    expect(await store.markMessageProcessed("wamid.1")).toBe(true);
    expect(await store.markMessageProcessed("wamid.1")).toBe(false);
  });
});
