/**
 * Utilitários de teste: conversa simulada com a máquina de estados e verificação de limites do
 * WhatsApp em qualquer mensagem gerada.
 */
import { expect } from "vitest";
import { newSession, step, type MachineResult } from "@/lib/conversation/machine";
import type { IncomingMessage, OutgoingMessage, Session } from "@/lib/domain/types";

/** Verifica que a mensagem respeita os limites da WhatsApp Cloud API. */
export function assertWhatsAppLimits(m: OutgoingMessage): void {
  switch (m.kind) {
    case "text":
      expect(m.text.length).toBeLessThanOrEqual(4096);
      break;
    case "buttons":
      expect(m.text.length).toBeLessThanOrEqual(1024);
      expect(m.buttons.length).toBeGreaterThan(0);
      expect(m.buttons.length).toBeLessThanOrEqual(3);
      for (const b of m.buttons) expect(b.title.length).toBeLessThanOrEqual(20);
      break;
    case "list":
      expect(m.text.length).toBeLessThanOrEqual(1024);
      expect(m.buttonLabel.length).toBeLessThanOrEqual(20);
      expect(m.rows.length).toBeLessThanOrEqual(10);
      for (const r of m.rows) {
        expect(r.title.length).toBeLessThanOrEqual(24);
        expect((r.description ?? "").length).toBeLessThanOrEqual(72);
      }
      break;
    case "location_request":
      expect(m.text.length).toBeLessThanOrEqual(1024);
      break;
  }
}

/** Conversa de teste que acumula sessão e checa limites em todas as respostas. */
export class Conversation {
  session: Session;
  last!: MachineResult;
  private clock = 1_700_000_000_000;

  constructor(channel: "whatsapp" | "simulator" = "whatsapp", userId = "5511999990000") {
    this.session = newSession(channel, userId, this.clock);
  }

  send(input: IncomingMessage | string): MachineResult {
    const msg: IncomingMessage = typeof input === "string" ? { kind: "text", text: input } : input;
    this.clock += 1000;
    this.last = step(this.session, msg, this.clock);
    this.session = this.last.session;
    this.last.replies.forEach(assertWhatsAppLimits);
    return this.last;
  }

  choose(id: string): MachineResult {
    return this.send({ kind: "choice", id });
  }

  /** Texto de todas as respostas do último passo, concatenado (para buscas com toContain). */
  get text(): string {
    return this.last.replies.map((r) => r.text).join("\n---\n");
  }
}
