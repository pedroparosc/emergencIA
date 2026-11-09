import { describe, expect, it } from "vitest";
import { CHOICE, looksLikeAddress } from "@/lib/conversation/machine";
import { PROTOCOLS } from "@/lib/triage/protocols";
import type { IncidentType } from "@/lib/domain/types";
import { Conversation } from "./helpers";

describe("fluxo por menus", () => {
  it("saudação → contexto → tipo → perguntas → caso leve", () => {
    const c = new Conversation();
    c.send("oi");
    expect(c.session.step).toBe("CONTEXTO");
    expect(c.last.replies[0]?.kind).toBe("buttons");

    c.choose(`${CHOICE.CONTEXT_PREFIX}DOMESTICO`);
    expect(c.session.step).toBe("TIPO");
    expect(c.last.replies[0]?.kind).toBe("list");

    c.choose(`${CHOICE.TYPE_PREFIX}CORTE`);
    expect(c.session.step).toBe("PERGUNTAS");
    expect(c.session.pendingQuestion).toBe("CONSCIENTE");

    c.choose(CHOICE.YES); // consciente
    c.choose(CHOICE.NO); // sem sangramento grave
    c.choose(CHOICE.NO); // sem objeto cravado
    c.choose(CHOICE.NO); // corte não profundo
    expect(c.session.severity).toBe("BAIXA");
    expect(c.session.step).toBe("ACOMPANHAMENTO");
    expect(c.last.effects).toEqual([]);
    expect(c.text).toContain("Primeiros socorros — corte");
  });

  it("aceita número digitado no menu de tipos", () => {
    const c = new Conversation();
    c.send("oi");
    c.send("1"); // trânsito
    expect(c.session.context).toBe("TRANSITO");
    c.send("3"); // 3º item do menu de trânsito
    expect(c.session.incidentType).toBe("ATROPELAMENTO");
  });

  it("pede de novo quando a resposta não é sim/não", () => {
    const c = new Conversation();
    c.send("cortei o dedo com a faca");
    c.send("não sei");
    expect(c.session.pendingQuestion).toBe("CONSCIENTE");
    expect(c.text).toContain("responda *Sim* ou *Não*");
  });
});

describe("casos graves", () => {
  it("atropelamento leva ao pedido de localização e ao chamado", () => {
    const c = new Conversation();
    c.send("um senhor foi atropelado aqui na frente");
    expect(c.session.incidentType).toBe("ATROPELAMENTO");
    c.choose(CHOICE.YES);
    c.choose(CHOICE.YES);
    c.choose(CHOICE.NO);
    expect(c.session.severity).toBe("ALTA");
    expect(c.session.step).toBe("AGUARDANDO_LOCALIZACAO");
    expect(c.last.replies.at(-1)?.kind).toBe("location_request");

    c.send({ kind: "location", lat: -23.55, lng: -46.63 });
    expect(c.last.effects).toEqual([{ type: "DISPATCH_ALERT" }]);
    expect(c.session.location).toMatchObject({ lat: -23.55, lng: -46.63, source: "gps" });
    expect(c.session.step).toBe("ACOMPANHAMENTO");
  });

  it("sinal crítico em texto livre pula as perguntas e manda RCP", () => {
    const c = new Conversation();
    c.send("meu pai caiu da escada e não está respirando");
    expect(c.session.severity).toBe("CRITICA");
    expect(c.session.incidentType).toBe("QUEDA");
    expect(c.session.criticalKind).toBe("RCP");
    expect(c.session.step).toBe("AGUARDANDO_LOCALIZACAO");
    expect(c.text).toContain("massagem cardíaca");
  });

  it("resposta crítica no meio das perguntas encerra a triagem", () => {
    const c = new Conversation();
    c.send("bati o carro");
    c.choose(CHOICE.NO); // não está preso
    c.choose(CHOICE.NO); // NÃO está consciente
    expect(c.session.severity).toBe("CRITICA");
    expect(c.session.step).toBe("AGUARDANDO_LOCALIZACAO");
  });

  it("engasgo que não consegue respirar recebe Heimlich", () => {
    const c = new Conversation();
    c.send("meu filho engasgou");
    c.send("ele não consegue respirar");
    expect(c.session.criticalKind).toBe("HEIMLICH");
    expect(c.text).toContain("Heimlich");
  });

  it("aceita endereço digitado quando não há GPS", () => {
    const c = new Conversation();
    c.send("ela desmaiou");
    c.send("Rua Vergueiro, 1000 - Liberdade");
    expect(c.last.effects).toEqual([{ type: "DISPATCH_ALERT" }]);
    expect(c.session.location).toMatchObject({ source: "texto", address: "Rua Vergueiro, 1000 - Liberdade" });
  });

  it("não confunde nova informação crítica com endereço", () => {
    const c = new Conversation();
    c.send("ela desmaiou");
    c.send("agora ela não respira");
    expect(c.last.effects).toEqual([]);
    expect(c.session.step).toBe("AGUARDANDO_LOCALIZACAO");
    expect(c.text).toContain("massagem cardíaca");
  });
});

describe("caso moderado e piora", () => {
  it("moderado indica hospital sem abrir chamado", () => {
    const c = new Conversation();
    c.send("cortei a mão com vidro");
    c.choose(CHOICE.YES);
    c.choose(CHOICE.NO);
    c.choose(CHOICE.NO);
    c.choose(CHOICE.YES); // profundo
    expect(c.session.severity).toBe("MODERADA");
    expect(c.session.locationPurpose).toBe("INDICACAO");
    c.send({ kind: "location", lat: -23.5, lng: -46.6 });
    expect(c.last.effects).toEqual([{ type: "SUGGEST_HOSPITALS" }]);
  });

  it("'piorou' depois de ter a localização aciona o hospital direto", () => {
    const c = new Conversation();
    c.send("cortei a mão com vidro");
    c.choose(CHOICE.YES);
    c.choose(CHOICE.NO);
    c.choose(CHOICE.NO);
    c.choose(CHOICE.YES);
    c.send({ kind: "location", lat: -23.5, lng: -46.6 });
    c.choose(CHOICE.PIOROU);
    expect(c.session.severity).toBe("ALTA");
    expect(c.last.effects).toEqual([{ type: "DISPATCH_ALERT", insertAt: 1 }]);
  });

  it("'piorou' com chamado aberto adiciona nota", () => {
    const c = new Conversation();
    c.send("ela desmaiou");
    c.send({ kind: "location", lat: -23.5, lng: -46.6 });
    c.session = { ...c.session, alertId: "EMG-TESTE" };
    c.send("piorou");
    expect(c.last.effects[0]).toMatchObject({ type: "ADD_ALERT_NOTE" });
  });

  it("recusar a indicação vai para acompanhamento", () => {
    const c = new Conversation();
    c.send("levou choque na tomada");
    c.choose(CHOICE.YES);
    c.choose(CHOICE.YES);
    c.choose(CHOICE.NO);
    expect(c.session.severity).toBe("MODERADA");
    c.send("não");
    expect(c.session.step).toBe("ACOMPANHAMENTO");
  });
});

describe("comandos globais", () => {
  it("menu reinicia a conversa", () => {
    const c = new Conversation();
    c.send("bati o carro");
    c.send("menu");
    expect(c.session.step).toBe("CONTEXTO");
    expect(c.session.incidentType).toBeUndefined();
  });

  it("rcp responde com instruções sem mudar a etapa", () => {
    const c = new Conversation();
    c.send("bati o carro");
    const before = c.session.step;
    c.send("rcp");
    expect(c.session.step).toBe(before);
    expect(c.text).toContain("100 a 120");
  });
});

describe("cobertura de todos os tipos", () => {
  it.each(Object.keys(PROTOCOLS) as IncidentType[])(
    "%s: respostas tranquilas terminam sem erro e respeitam limites",
    (type) => {
      const c = new Conversation();
      c.send("oi");
      c.choose(`${CHOICE.CONTEXT_PREFIX}${PROTOCOLS[type].contexts[0]}`);
      c.choose(`${CHOICE.TYPE_PREFIX}${type}`);
      let guard = 0;
      while (c.session.step === "PERGUNTAS" && guard++ < 10) {
        const q = c.session.pendingQuestion!;
        // Responde sempre a opção "segura".
        const safe = ["CONSCIENTE", "RESPIRA", "CONSEGUE_TOSSIR"].includes(q);
        c.choose(safe ? CHOICE.YES : CHOICE.NO);
      }
      expect(c.session.severity).toBe(PROTOCOLS[type].minSeverity);
    },
  );
});

describe("looksLikeAddress", () => {
  it("reconhece endereços e rejeita frases", () => {
    expect(looksLikeAddress("Rua das Flores 123")).toBe(true);
    expect(looksLikeAddress("Av Paulista perto do metrô")).toBe(true);
    expect(looksLikeAddress("ela não respira")).toBe(false);
    expect(looksLikeAddress("ok")).toBe(false);
  });
});
