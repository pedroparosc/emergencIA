import { describe, expect, it } from "vitest";
import { parseWebhook } from "@/lib/whatsapp/parse";
import { toGraphPayload } from "@/lib/whatsapp/payload";
import { computeSignature, isValidSignature } from "@/lib/whatsapp/signature";

/** Monta um webhook mínimo no formato da Meta com uma mensagem. */
function webhook(message: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ wa_id: "5511988887777", profile: { name: "Maria" } }],
              messages: [{ id: "wamid.1", from: "5511988887777", timestamp: "1700000000", ...message }],
            },
          },
        ],
      },
    ],
  };
}

describe("parseWebhook", () => {
  it("texto", () => {
    const [m] = parseWebhook(webhook({ type: "text", text: { body: "socorro" } }));
    expect(m).toEqual({ messageId: "wamid.1", from: "5511988887777", profileName: "Maria", input: { kind: "text", text: "socorro" } });
  });

  it("botão interativo", () => {
    const [m] = parseWebhook(webhook({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "ans:yes", title: "Sim" } } }));
    expect(m?.input).toEqual({ kind: "choice", id: "ans:yes", title: "Sim" });
  });

  it("item de lista", () => {
    const [m] = parseWebhook(webhook({ type: "interactive", interactive: { type: "list_reply", list_reply: { id: "type:QUEDA" } } }));
    expect(m?.input).toMatchObject({ kind: "choice", id: "type:QUEDA" });
  });

  it("localização", () => {
    const [m] = parseWebhook(webhook({ type: "location", location: { latitude: -23.55, longitude: -46.63, address: "Av. Paulista" } }));
    expect(m?.input).toEqual({ kind: "location", lat: -23.55, lng: -46.63, address: "Av. Paulista", name: undefined });
  });

  it("ignora notificações de status e payloads inválidos", () => {
    expect(parseWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual([]);
    expect(parseWebhook(null)).toEqual([]);
    expect(parseWebhook({ object: "page" })).toEqual([]);
  });
});

describe("toGraphPayload", () => {
  it("botões", () => {
    const p = toGraphPayload("5511", { kind: "buttons", text: "Ok?", buttons: [{ id: "a", title: "Sim" }] });
    expect(p).toMatchObject({
      type: "interactive",
      interactive: { type: "button", action: { buttons: [{ type: "reply", reply: { id: "a", title: "Sim" } }] } },
    });
  });

  it("pedido de localização", () => {
    const p = toGraphPayload("5511", { kind: "location_request", text: "Envie" });
    expect(p).toMatchObject({ interactive: { type: "location_request_message", action: { name: "send_location" } } });
  });

  it("corta textos acima do limite", () => {
    const p = toGraphPayload("5511", { kind: "buttons", text: "x".repeat(2000), buttons: [{ id: "a", title: "y".repeat(30) }] }) as {
      interactive: { body: { text: string }; action: { buttons: Array<{ reply: { title: string } }> } };
    };
    expect(p.interactive.body.text.length).toBe(1024);
    expect(p.interactive.action.buttons[0]!.reply.title.length).toBe(20);
  });
});

describe("assinatura do webhook", () => {
  const secret = "segredo-de-teste";
  const body = JSON.stringify({ hello: "world" });

  it("aceita assinatura correta", () => {
    expect(isValidSignature(body, computeSignature(body, secret), secret)).toBe(true);
  });
  it("rejeita assinatura errada, ausente ou de outro corpo", () => {
    expect(isValidSignature(body, "sha256=abc", secret)).toBe(false);
    expect(isValidSignature(body, null, secret)).toBe(false);
    expect(isValidSignature(body + " ", computeSignature(body, secret), secret)).toBe(false);
  });
});
