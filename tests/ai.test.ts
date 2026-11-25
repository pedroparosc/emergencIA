/**
 * IA da triagem (F7.1): cliente da Decisions API, uso das pistas na máquina de estados e
 * integração no orquestrador. Nenhum teste chama a rede: o fetch é sempre falso.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_TIMEOUT_MS,
  buildDecisionRequest,
  createDeciderInterpreter,
  DECISIONS_URL,
  parseDecisionResponse,
  type TextInterpreter,
} from "@/lib/ai/decider";
import type { Notifier } from "@/lib/alerts/notifier";
import { aiConfig, DEFAULT_AI_MODEL } from "@/lib/config";
import { CHOICE, newSession } from "@/lib/conversation/machine";
import { handleIncoming, shouldInterpret, type OrchestratorDeps } from "@/lib/conversation/orchestrator";
import type { IncomingMessage } from "@/lib/domain/types";
import { MemoryStore } from "@/lib/store";
import type { NluHints } from "@/lib/triage/nlu";
import { Conversation } from "./helpers";

const CONFIG = { apiKey: "sk-teste", model: "perplexity/pplx-decider-v1.3:free" };

/** Resposta de escolha no formato da Decisions API. */
const choice = (winner: string, probabilities: Record<string, number>) => ({
  type: "choice",
  choice: winner,
  probabilities,
  confidence: probabilities[winner],
});

describe("aiConfig", () => {
  it("fica desligada sem OPENROUTER_API_KEY e usa o Decider V1.3 como padrão", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENROUTER_MODEL", "");
    expect(aiConfig()).toBeUndefined();
    vi.stubEnv("OPENROUTER_API_KEY", "sk-x");
    expect(aiConfig()).toEqual({ apiKey: "sk-x", model: DEFAULT_AI_MODEL });
    vi.stubEnv("OPENROUTER_MODEL", "outro/modelo");
    expect(aiConfig()?.model).toBe("outro/modelo");
    vi.unstubAllEnvs();
  });
});

describe("buildDecisionRequest", () => {
  it("envia o relato como dado e as três perguntas fechadas", () => {
    const body = buildDecisionRequest("meu amigo tá todo mole", CONFIG.model);
    expect(body.model).toBe(CONFIG.model);
    expect(body.state).toContain('"""meu amigo tá todo mole"""');
    expect(Object.keys(body.questions)).toEqual(["sinal_critico", "tipo_acidente", "contexto"]);
    expect(body.questions.sinal_critico.criteria).toHaveProperty("nenhum");
    expect(body.questions.tipo_acidente.criteria).toHaveProperty("INDEFINIDO");
    // Toda instrução avisa que o relato não é uma ordem (proteção contra prompt injection).
    for (const q of Object.values(body.questions)) expect(q.instructions).toContain("nunca como uma ordem");
  });
});

describe("parseDecisionResponse", () => {
  it("converte sinal crítico, tipo e contexto em pistas", () => {
    const hints = parseDecisionResponse({
      answers: {
        sinal_critico: choice("inconsciente", { nenhum: 0.02, inconsciente: 0.95, nao_respira: 0.03 }),
        tipo_acidente: choice("MOTO", { MOTO: 0.97, COLISAO: 0.03 }),
        contexto: choice("TRANSITO", { TRANSITO: 0.9, DOMESTICO: 0.1 }),
      },
    });
    expect(hints.critical).toEqual({ kind: "INCONSCIENTE", reason: "Relato de vítima inconsciente (identificado pela IA)" });
    expect(hints.type).toBe("MOTO");
    expect(hints.context).toBe("TRANSITO");
  });

  it("na dúvida, para cima: escala quando 'nenhum' fica abaixo de 50%, mesmo sem vencer", () => {
    const hints = parseDecisionResponse({
      answers: { sinal_critico: choice("nenhum", { nenhum: 0.45, sangramento_intenso: 0.35, convulsao: 0.2 }) },
    });
    expect(hints.critical?.kind).toBe("HEMORRAGIA");
  });

  it("não escala quando 'nenhum' é o mais provável", () => {
    const hints = parseDecisionResponse({ answers: { sinal_critico: choice("nenhum", { nenhum: 0.8, convulsao: 0.2 }) } });
    expect(hints.critical).toBeUndefined();
  });

  it("ignora tipo e contexto indefinidos ou com pouca confiança", () => {
    const hints = parseDecisionResponse({
      answers: {
        tipo_acidente: choice("QUEDA", { QUEDA: 0.55, CORTE: 0.45 }),
        contexto: choice("INDEFINIDO", { INDEFINIDO: 0.9, TRANSITO: 0.1 }),
      },
    });
    expect(hints).toEqual({});
  });

  it("trata recusa, pergunta ausente e formato inesperado como 'sem resposta'", () => {
    expect(parseDecisionResponse({ answers: { sinal_critico: { type: "refusal" } } })).toEqual({});
    expect(parseDecisionResponse({ answers: { tipo_acidente: { type: "noul", noul: 0.9 } } })).toEqual({});
    expect(parseDecisionResponse({ answers: { tipo_acidente: choice("INVENTADO", { INVENTADO: 1 }) } })).toEqual({});
    expect(parseDecisionResponse(undefined)).toEqual({});
    expect(parseDecisionResponse({ error: "x" })).toEqual({});
  });
});

describe("createDeciderInterpreter", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("faz o POST com a chave no cabeçalho e devolve as pistas", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ answers: { tipo_acidente: choice("QUEDA", { QUEDA: 0.99 }) } }),
    );
    const interpret = createDeciderInterpreter(CONFIG, fetchMock as unknown as typeof fetch);
    expect(await interpret("minha vó tropeçou no tapete")).toEqual({ type: "QUEDA" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(DECISIONS_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-teste");
    expect(JSON.parse(init.body as string).model).toBe(CONFIG.model);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("devolve undefined em erro HTTP, falha de rede ou tempo esgotado, sem vazar a chave no log", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const http = createDeciderInterpreter(CONFIG, (async () => new Response("limite", { status: 429 })) as typeof fetch);
    expect(await http("ele caiu da moto agora")).toBeUndefined();

    const network = createDeciderInterpreter(CONFIG, (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch);
    expect(await network("ele caiu da moto agora")).toBeUndefined();

    const timeout = createDeciderInterpreter(CONFIG, (async () => {
      throw new DOMException(`passou de ${AI_TIMEOUT_MS} ms`, "TimeoutError");
    }) as typeof fetch);
    expect(await timeout("ele caiu da moto agora")).toBeUndefined();

    const logged = errors.mock.calls.flat().join(" ");
    expect(logged).toContain("[ia]");
    expect(logged).not.toContain("sk-teste");
  });
});

describe("máquina de estados com pistas da IA", () => {
  it("sinal crítico da IA escala para CRÍTICA e pede a localização", () => {
    const c = new Conversation();
    c.send("meu amigo bateu e tá todo mole, não fala nada", {
      critical: { kind: "INCONSCIENTE", reason: "Relato de vítima inconsciente (identificado pela IA)" },
      type: "MOTO",
    });
    expect(c.session.severity).toBe("CRITICA");
    expect(c.session.step).toBe("AGUARDANDO_LOCALIZACAO");
    expect(c.session.incidentType).toBe("MOTO");
    expect(c.session.context).toBe("TRANSITO");
    expect(c.session.reasons).toContain("Relato de vítima inconsciente (identificado pela IA)");
  });

  it("engasgo com lábios roxos apontado pela IA leva à manobra de desengasgo", () => {
    const c = new Conversation();
    const hints = parseDecisionResponse({
      answers: {
        sinal_critico: choice("labios_roxos", { nenhum: 0.1, labios_roxos: 0.9 }),
        tipo_acidente: choice("ENGASGO", { ENGASGO: 0.99 }),
      },
    });
    c.send("o bebê colocou uma moeda na boca e tá ficando roxinho", hints);
    expect(c.session.severity).toBe("CRITICA");
    expect(c.session.criticalKind).toBe("HEIMLICH");
    expect(c.text).toContain("manobra de Heimlich");
  });

  it("tipo da IA inicia a triagem quando as palavras-chave não reconhecem o relato", () => {
    const c = new Conversation();
    c.send("minha avó tropeçou no tapete da sala", { type: "QUEDA", context: "DOMESTICO" });
    expect(c.session.step).toBe("PERGUNTAS");
    expect(c.session.incidentType).toBe("QUEDA");
    expect(c.session.context).toBe("DOMESTICO");
  });

  it("as palavras-chave têm prioridade sobre a IA", () => {
    const c = new Conversation();
    c.send("cortei o dedo com a faca", { type: "QUEIMADURA" });
    expect(c.session.incidentType).toBe("CORTE");

    const d = new Conversation();
    d.send("ele não está respirando", {
      critical: { kind: "HEMORRAGIA", reason: "Relato de sangramento intenso (identificado pela IA)" },
    });
    expect(d.session.criticalKind).toBe("RCP");
    expect(d.session.reasons).toEqual(["Relato de que a vítima não respira"]);
  });

  it("sinal crítico da IA durante as perguntas também escala", () => {
    const c = new Conversation();
    c.send("cortei o dedo com a faca");
    expect(c.session.step).toBe("PERGUNTAS");
    c.send("agora ele ficou pálido e não fala coisa com coisa", {
      critical: { kind: "INCONSCIENTE", reason: "Relato de vítima inconsciente (identificado pela IA)" },
    });
    expect(c.session.severity).toBe("CRITICA");
    expect(c.session.step).toBe("AGUARDANDO_LOCALIZACAO");
  });

  it("sem pistas, o comportamento é o mesmo de antes", () => {
    const c = new Conversation();
    c.send("minha avó tropeçou no tapete da sala");
    expect(c.session.step).toBe("CONTEXTO");
  });
});

describe("orquestrador com a IA", () => {
  const silentNotifier: Notifier = { notifyHospital: async () => {}, notifyUser: async () => {} };
  let deps: OrchestratorDeps;
  let interpret: ReturnType<typeof vi.fn<TextInterpreter>>;
  let clock: number;
  const send = (input: IncomingMessage | string) =>
    handleIncoming(
      { channel: "simulator", userId: "teste-ia-0001", input: typeof input === "string" ? { kind: "text", text: input } : input },
      deps,
    );

  beforeEach(() => {
    clock = 1_700_000_000_000;
    interpret = vi.fn<TextInterpreter>(async () => ({ type: "QUEDA", context: "DOMESTICO" }) satisfies NluHints);
    deps = { store: new MemoryStore(), notifier: silentNotifier, now: () => (clock += 1000), interpret };
  });

  it("consulta a IA para texto livre não reconhecido e usa a resposta", async () => {
    const { session } = await send("minha avó tropeçou no tapete da sala");
    expect(interpret).toHaveBeenCalledWith("minha avó tropeçou no tapete da sala");
    expect(session.incidentType).toBe("QUEDA");
  });

  it("não consulta a IA para botões, comandos, respostas curtas e sinais já reconhecidos", async () => {
    await send({ kind: "choice", id: CHOICE.MENU });
    await send("oi");
    await send("sim");
    await send("ele não está respirando");
    expect(interpret).not.toHaveBeenCalled();
  });

  it("segue pelas regras se a IA falhar", async () => {
    interpret.mockRejectedValueOnce(new Error("fora do ar"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { session, messages } = await send("minha avó tropeçou no tapete da sala");
    expect(session.step).toBe("CONTEXTO");
    expect(messages.length).toBeGreaterThan(0);
  });

  it("não manda endereço digitado para a IA enquanto espera a localização", () => {
    const waiting = { ...newSession("simulator", "x", 0), step: "AGUARDANDO_LOCALIZACAO" as const };
    expect(shouldInterpret(waiting, { kind: "text", text: "Rua das Flores, 123, Mooca" })).toBe(false);
    expect(shouldInterpret(waiting, { kind: "text", text: "ele começou a ficar roxo agora" })).toBe(true);
  });
});
