import { describe, expect, it } from "vitest";
import { dispositionFor, evaluate, maxSeverity, nextQuestion } from "@/lib/triage/engine";
import { PROTOCOLS, QUESTIONS } from "@/lib/triage/protocols";
import type { IncidentType } from "@/lib/domain/types";

describe("evaluate", () => {
  it("vítima inconsciente é CRÍTICA", () => {
    const r = evaluate("QUEDA", { CONSCIENTE: false });
    expect(r.severity).toBe("CRITICA");
    expect(r.criticalKind).toBe("INCONSCIENTE");
  });

  it("inconsciente e sem respirar prioriza RCP", () => {
    expect(evaluate("QUEDA", { CONSCIENTE: false, RESPIRA: false }).criticalKind).toBe("RCP");
  });

  it("atropelamento é no mínimo ALTA mesmo com respostas tranquilas", () => {
    const r = evaluate("ATROPELAMENTO", { CONSCIENTE: true, RESPIRA: true, SANGRAMENTO_GRAVE: false });
    expect(r.severity).toBe("ALTA");
    expect(dispositionFor(r.severity)).toBe("ACIONAR_HOSPITAL");
  });

  it("corte superficial é BAIXA (cuidados em casa)", () => {
    const r = evaluate("CORTE", { CONSCIENTE: true, SANGRAMENTO_GRAVE: false, OBJETO_CRAVADO: false, CORTE_PROFUNDO: false });
    expect(r.severity).toBe("BAIXA");
    expect(dispositionFor(r.severity)).toBe("CUIDADOS_EM_CASA");
  });

  it("corte profundo é MODERADA (indicar hospital, sem chamado)", () => {
    const r = evaluate("CORTE", { CONSCIENTE: true, SANGRAMENTO_GRAVE: false, OBJETO_CRAVADO: false, CORTE_PROFUNDO: true });
    expect(r.severity).toBe("MODERADA");
    expect(dispositionFor(r.severity)).toBe("INDICAR_HOSPITAL");
  });

  it("vítima presa nas ferragens é CRÍTICA", () => {
    expect(evaluate("COLISAO", { PRESO_FERRAGENS: true }).criticalKind).toBe("FERRAGENS");
  });

  it("engasgo sem conseguir tossir é CRÍTICO com Heimlich", () => {
    const r = evaluate("ENGASGO", { CONSEGUE_TOSSIR: false });
    expect(r.severity).toBe("CRITICA");
    expect(r.criticalKind).toBe("HEIMLICH");
  });

  it("queimadura extensa é ALTA", () => {
    expect(evaluate("QUEIMADURA", { CONSCIENTE: true, RESPIRA: true, QUEIMADURA_EXTENSA: true }).severity).toBe("ALTA");
  });
});

describe("nextQuestion", () => {
  it("segue a ordem do protocolo", () => {
    expect(nextQuestion("COLISAO", {})).toBe("PRESO_FERRAGENS");
    expect(nextQuestion("COLISAO", { PRESO_FERRAGENS: false })).toBe("CONSCIENTE");
  });

  it("para de perguntar quando já é CRÍTICA", () => {
    expect(nextQuestion("QUEDA", { CONSCIENTE: false })).toBeUndefined();
  });

  it("não pergunta se está consciente quem consegue falar (engasgo)", () => {
    expect(nextQuestion("ENGASGO", { CONSEGUE_TOSSIR: true })).toBeUndefined();
  });
});

describe("maxSeverity", () => {
  it("nunca reduz a gravidade", () => {
    expect(maxSeverity("ALTA", "BAIXA")).toBe("ALTA");
    expect(maxSeverity("MODERADA", "CRITICA")).toBe("CRITICA");
  });
});

describe("integridade da base de protocolos", () => {
  it.each(Object.keys(PROTOCOLS) as IncidentType[])("%s respeita limites do WhatsApp", (type) => {
    const p = PROTOCOLS[type];
    expect(p.label.length).toBeLessThanOrEqual(24);
    expect(p.description.length).toBeLessThanOrEqual(72);
    expect(p.steps.length).toBeLessThanOrEqual(1024);
    expect(p.questions.length).toBeGreaterThan(0);
    for (const q of p.questions) expect(QUESTIONS[q]).toBeDefined();
  });
});
