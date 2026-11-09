import { describe, expect, it } from "vitest";
import {
  detectCommand,
  detectContext,
  detectCriticalSign,
  detectIncidentType,
  normalize,
  parseYesNo,
} from "@/lib/triage/nlu";

describe("normalize", () => {
  it("remove acentos, pontuação e caixa", () => {
    expect(normalize("Ele NÃO está respirando!!")).toBe("ele nao esta respirando");
  });
  it("expande a abreviação ñ", () => {
    expect(normalize("ñ respira")).toBe("nao respira");
  });
});

describe("detectCriticalSign", () => {
  it.each([
    ["ele NÃO ESTÁ RESPIRANDO", "RCP"],
    ["minha mãe caiu e não acorda", "INCONSCIENTE"],
    ["tá saindo muito sangue", "HEMORRAGIA"],
    ["ele está tendo uma convulsão", "CONVULSAO"],
    ["tem gente presa nas ferragens", "FERRAGENS"],
    ["o bebê está com os lábios roxos", "INCONSCIENTE"],
    ["ela não consegue respirar", "GERAL"],
  ])("'%s' → %s", (text, kind) => {
    expect(detectCriticalSign(text)?.kind).toBe(kind);
  });

  it.each(["meu joelho ficou roxo", "cortei o dedo", "to morrendo de dor", "caí da escada"])(
    "não gera falso alarme para '%s'",
    (text) => {
      expect(detectCriticalSign(text)).toBeUndefined();
    },
  );
});

describe("detectIncidentType / detectContext", () => {
  it.each([
    ["bati o carro na avenida", "COLISAO"],
    ["meu filho caiu da bicicleta", "MOTO"],
    ["uma senhora foi atropelada", "ATROPELAMENTO"],
    ["meu pai caiu da escada", "QUEDA"],
    ["derramei óleo quente na mão", "QUEIMADURA"],
    ["cortei a mão com faca", "CORTE"],
    ["o bebê engasgou", "ENGASGO"],
    ["levou choque na tomada", "CHOQUE"],
    ["meu filho bebeu água sanitária", "INTOXICACAO"],
    ["a criança caiu na piscina", "AFOGAMENTO"],
  ])("'%s' → %s", (text, type) => {
    expect(detectIncidentType(text)).toBe(type);
  });

  it("não confunde 'caixa' com queda", () => {
    expect(detectIncidentType("bati a cabeça na caixa")).toBeUndefined();
  });

  it("deduz trânsito pelo tipo e doméstico pelas palavras", () => {
    expect(detectContext("foi atropelado", "ATROPELAMENTO")).toBe("TRANSITO");
    expect(detectContext("aconteceu aqui em casa")).toBe("DOMESTICO");
    expect(detectContext("foi na rua")).toBe("TRANSITO");
  });
});

describe("parseYesNo", () => {
  it.each([
    ["sim", true],
    ["Sim, está", true],
    ["s", true],
    ["não", false],
    ["ñ", false],
    ["nao esta nao", false],
    ["não sei", undefined],
    ["talvez", undefined],
    ["", undefined],
  ])("'%s' → %s", (text, expected) => {
    expect(parseYesNo(text)).toBe(expected);
  });
});

describe("detectCommand", () => {
  it("reconhece comandos globais", () => {
    expect(detectCommand("Oi")).toBe("MENU");
    expect(detectCommand("MENU")).toBe("MENU");
    expect(detectCommand("ele piorou")).toBe("PIOROU");
    expect(detectCommand("rcp")).toBe("RCP");
    expect(detectCommand("cancelar")).toBe("CANCELAR");
    expect(detectCommand("caiu da escada")).toBeUndefined();
  });
});
