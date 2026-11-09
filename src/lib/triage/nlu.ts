/**
 * NLU — "entendimento" de linguagem natural por palavras-chave (componente C2).
 *
 * Por que palavras-chave e não um modelo de linguagem? Em emergências, o comportamento precisa
 * ser previsível, auditável e funcionar sem custo nem latência extra. As listas abaixo cobrem as
 * formas mais comuns de escrever (com e sem acento, abreviações de WhatsApp como "ñ" e "vc").
 * Uma evolução opcional (F7.1) é usar um LLM só para casos que estas regras não reconhecerem.
 */
import type { CriticalKind, IncidentContext, IncidentType } from "@/lib/domain/types";

/**
 * Normaliza o texto para comparação: minúsculas, sem acentos, sem pontuação e com espaços
 * únicos. Ex.: "Ele NÃO está respirando!!" → "ele nao esta respirando".
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ñ/g, "nao ") // "ñ" (abreviação de "não") vira "nao" antes de tirar os acentos
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos (acentos, cedilha)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Verifica se o texto normalizado contém alguma das expressões (também normalizadas). */
function containsAny(normalized: string, phrases: readonly string[]): string | undefined {
  // Adiciona espaços nas pontas para casar palavras inteiras (" cai " não casa com "caixa").
  const padded = ` ${normalized} `;
  return phrases.find((p) => padded.includes(` ${p} `));
}

/* -------------------------------------------------------------------------- */
/* Sinais de alerta críticos                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Expressões que, sozinhas, indicam risco imediato de vida. Se aparecerem em QUALQUER momento
 * da conversa, o bot pula as perguntas e vai direto para instruções imediatas + localização.
 * Cada entrada tem a frase (normalizada) e o motivo exibido ao hospital.
 */
const CRITICAL_SIGNS: ReadonlyArray<{ phrases: string[]; reason: string; kind: CriticalKind }> = [
  {
    phrases: [
      "nao respira", "nao esta respirando", "nao ta respirando", "parou de respirar",
      "sem respirar", "sem respiracao", "nao respirando",
    ],
    reason: "Relato de que a vítima não respira",
    kind: "RCP",
  },
  {
    phrases: [
      "inconsciente", "desmaiada", "desmaiado", "desmaiou", "nao acorda", "nao responde",
      "nao reage", "apagou", "desacordado", "desacordada", "perdeu a consciencia",
    ],
    reason: "Relato de vítima inconsciente",
    kind: "INCONSCIENTE",
  },
  {
    // Pessoa acordada com grande dificuldade para respirar (engasgo, reação alérgica, asma...).
    phrases: ["nao consegue respirar", "falta de ar", "sufocando", "sem ar"],
    reason: "Dificuldade grave para respirar",
    kind: "GERAL",
  },
  {
    phrases: ["sem pulso", "coracao parou", "parada cardiaca"],
    reason: "Suspeita de parada cardíaca",
    kind: "RCP",
  },
  {
    // Pessoa acordada com suspeita de infarto: NÃO é caso de massagem (ela tem pulso).
    phrases: ["infarto", "infartando", "dor no peito forte"],
    reason: "Suspeita de infarto",
    kind: "GERAL",
  },
  {
    phrases: [
      "muito sangue", "sangrando muito", "sangue jorrando", "hemorragia", "nao para de sangrar",
      "sangramento forte", "sangramento intenso",
    ],
    reason: "Relato de sangramento intenso",
    kind: "HEMORRAGIA",
  },
  {
    phrases: ["convulsao", "convulsionando", "convulsionou", "se debatendo", "ataque epileptico"],
    reason: "Relato de convulsão",
    kind: "CONVULSAO",
  },
  {
    // Evitamos "roxo" sozinho: "o joelho ficou roxo" (hematoma) não é emergência.
    phrases: ["labios roxos", "labio roxo", "boca roxa", "ficando azul", "ficou azul", "labios azuis"],
    reason: "Sinal de falta de oxigenação (pele/lábios arroxeados)",
    kind: "INCONSCIENTE",
  },
  {
    phrases: ["presa nas ferragens", "preso nas ferragens", "presos nas ferragens", "pegando fogo", "carro em chamas"],
    reason: "Vítima presa nas ferragens ou fogo no local",
    kind: "FERRAGENS",
  },
];

export interface CriticalSign {
  reason: string;
  kind: CriticalKind;
}

/** Retorna o primeiro sinal crítico encontrado (motivo + natureza), ou `undefined`. */
export function detectCriticalSign(text: string): CriticalSign | undefined {
  const n = normalize(text);
  for (const sign of CRITICAL_SIGNS) {
    if (containsAny(n, sign.phrases)) return { reason: sign.reason, kind: sign.kind };
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Tipo de acidente e contexto                                                */
/* -------------------------------------------------------------------------- */

/** Palavras-chave por tipo. A ORDEM importa: tipos mais específicos vêm primeiro. */
const TYPE_KEYWORDS: ReadonlyArray<{ type: IncidentType; phrases: string[] }> = [
  { type: "ATROPELAMENTO", phrases: ["atropelado", "atropelada", "atropelamento", "atropelou", "atropelaram"] },
  { type: "MOTO", phrases: ["moto", "motoqueiro", "motociclista", "motocicleta", "bicicleta", "bike", "ciclista", "patinete"] },
  {
    type: "COLISAO",
    phrases: ["batida", "bateu o carro", "bati o carro", "colisao", "capotou", "capotamento", "acidente de carro", "engavetamento", "bateram", "batemos", "carro bateu"],
  },
  { type: "ENGASGO", phrases: ["engasgou", "engasgado", "engasgada", "engasgo", "engasgando", "entalou", "entalado", "entalada"] },
  { type: "AFOGAMENTO", phrases: ["afogou", "afogamento", "afogando", "afogado", "afogada", "piscina", "engoliu agua"] },
  { type: "CHOQUE", phrases: ["choque", "eletrico", "eletrocutado", "eletrocutada", "fio desencapado", "tomada"] },
  {
    type: "INTOXICACAO",
    phrases: ["intoxicacao", "intoxicado", "intoxicada", "envenenado", "envenenada", "veneno", "bebeu produto", "engoliu produto", "agua sanitaria", "remedio demais", "tomou remedios", "overdose", "chumbinho"],
  },
  {
    type: "QUEIMADURA",
    phrases: ["queimou", "queimadura", "queimado", "queimada", "oleo quente", "agua fervendo", "panela", "fogo", "escaldou"],
  },
  { type: "CORTE", phrases: ["corte", "cortou", "cortei", "faca", "vidro", "machucou a mao", "ferida", "ferimento"] },
  { type: "QUEDA", phrases: ["caiu", "cai", "queda", "escada", "escorregou", "tombo", "levou um tombo", "despencou"] },
];

/** Tipos que são, por natureza, de trânsito. */
const TRAFFIC_TYPES: ReadonlySet<IncidentType> = new Set(["COLISAO", "MOTO", "ATROPELAMENTO"]);

const TRAFFIC_WORDS = ["transito", "rua", "avenida", "rodovia", "estrada", "carro", "onibus", "caminhao", "acidente de transito"];
const HOME_WORDS = ["casa", "cozinha", "banheiro", "quintal", "domestico", "em casa", "apartamento"];

/** Detecta o tipo de acidente no texto livre. */
export function detectIncidentType(text: string): IncidentType | undefined {
  const n = normalize(text);
  return TYPE_KEYWORDS.find((k) => containsAny(n, k.phrases))?.type;
}

/** Detecta se o acidente é de trânsito ou doméstico. Usa o tipo quando ele já define o contexto. */
export function detectContext(text: string, type?: IncidentType): IncidentContext | undefined {
  if (type && TRAFFIC_TYPES.has(type)) return "TRANSITO";
  const n = normalize(text);
  if (containsAny(n, TRAFFIC_WORDS)) return "TRANSITO";
  if (containsAny(n, HOME_WORDS)) return "DOMESTICO";
  return undefined;
}

/** Contexto padrão de cada tipo (para quando o usuário não disser onde foi). */
export function defaultContextFor(type: IncidentType): IncidentContext {
  return TRAFFIC_TYPES.has(type) ? "TRANSITO" : "DOMESTICO";
}

/* -------------------------------------------------------------------------- */
/* Sim / não e comandos                                                       */
/* -------------------------------------------------------------------------- */

const YES = ["sim", "s", "ss", "yes", "isso", "positivo", "claro", "uhum", "aham", "ta", "esta", "tem", "consegue", "1"];
const NO = ["nao", "n", "no", "negativo", "nenhum", "nada", "2"];

/**
 * Interpreta uma resposta sim/não em texto livre.
 * Regras: "não sei"/"talvez" → indefinido (o bot pergunta de novo com botões); qualquer
 * "não" vence (ex.: "não está" contém "está"); depois procura "sim".
 */
export function parseYesNo(text: string): boolean | undefined {
  const n = normalize(text);
  if (!n) return undefined;
  if (containsAny(n, ["nao sei", "talvez", "acho que", "sei la"])) return undefined;
  const tokens = n.split(" ");
  if (tokens.some((t) => NO.includes(t))) return false;
  if (tokens.includes("sim") || YES.includes(n)) return true;
  return undefined;
}

export type Command = "MENU" | "PIOROU" | "AJUDA" | "CANCELAR" | "RCP";

/** Detecta comandos globais que funcionam em qualquer etapa. */
export function detectCommand(text: string): Command | undefined {
  const n = normalize(text);
  if (["menu", "inicio", "reiniciar", "recomecar", "novo", "oi", "ola", "bom dia", "boa tarde", "boa noite", "comecar"].includes(n)) {
    return "MENU";
  }
  if (containsAny(n, ["piorou", "piorando", "esta pior", "ta pior", "ficou pior"])) return "PIOROU";
  if (["ajuda", "help", "socorro", "emergencia"].includes(n)) return "AJUDA";
  if (["cancelar", "sair", "parar", "encerrar"].includes(n)) return "CANCELAR";
  if (["rcp", "massagem", "massagem cardiaca", "reanimacao"].includes(n)) return "RCP";
  return undefined;
}
