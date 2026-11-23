/**
 * Base de protocolos de primeiros socorros (componente C3).
 *
 * Conteúdo baseado em orientações públicas para leigos (Ministério da Saúde/SAMU 192,
 * Cruz Vermelha e diretrizes de RCP da American Heart Association).
 *
 * ⚠️ ANTES DE QUALQUER USO REAL este conteúdo deve ser revisado por um profissional de saúde.
 *
 * Formatação: os textos usam a marcação do WhatsApp (*negrito*, _itálico_), que o simulador web
 * também interpreta. Mantenha cada texto com menos de 1024 caracteres (limite do corpo de
 * mensagens interativas do WhatsApp). Um teste automatizado verifica esses limites.
 */
import type {
  CriticalKind,
  IncidentContext,
  IncidentType,
  QuestionId,
  Severity,
} from "@/lib/domain/types";

/* -------------------------------------------------------------------------- */
/* Perguntas de triagem                                                       */
/* -------------------------------------------------------------------------- */

export interface TriageQuestion {
  id: QuestionId;
  /** Pergunta exibida ao usuário (resposta sim/não). */
  text: string;
  /** Qual resposta indica perigo (true = "sim" é perigoso; false = "não" é perigoso). */
  dangerAnswer: boolean;
  /** Gravidade atribuída quando a resposta indica perigo. */
  severityIfDanger: Severity;
  /** Motivo legível enviado ao hospital. */
  reason: string;
  /** Instruções imediatas a usar quando esta resposta leva a um caso CRÍTICO. */
  criticalKind?: CriticalKind;
}

export const QUESTIONS: Record<QuestionId, TriageQuestion> = {
  CONSCIENTE: {
    id: "CONSCIENTE",
    text: "A vítima está *acordada* e responde quando você fala com ela ou toca no ombro?",
    dangerAnswer: false,
    severityIfDanger: "CRITICA",
    reason: "Vítima inconsciente",
    criticalKind: "INCONSCIENTE",
  },
  RESPIRA: {
    id: "RESPIRA",
    text: "Ela está *respirando normalmente*? (o peito sobe e desce de forma regular)",
    dangerAnswer: false,
    severityIfDanger: "CRITICA",
    reason: "Respiração ausente ou anormal",
    criticalKind: "RCP",
  },
  SANGRAMENTO_GRAVE: {
    id: "SANGRAMENTO_GRAVE",
    text: "Há *sangramento forte*, que não para mesmo apertando o local?",
    dangerAnswer: true,
    severityIfDanger: "CRITICA",
    reason: "Sangramento intenso",
    criticalKind: "HEMORRAGIA",
  },
  PRESO_FERRAGENS: {
    id: "PRESO_FERRAGENS",
    text: "Alguém está *preso nas ferragens* ou há *fogo/fumaça* no veículo?",
    dangerAnswer: true,
    severityIfDanger: "CRITICA",
    reason: "Vítima presa nas ferragens ou risco de incêndio",
    criticalKind: "FERRAGENS",
  },
  LESAO_COLUNA_CABECA: {
    id: "LESAO_COLUNA_CABECA",
    text:
      "A vítima *bateu a cabeça* com força, tem *dor no pescoço ou nas costas*, formigamento, " +
      "vômitos ou está confusa?",
    dangerAnswer: true,
    severityIfDanger: "ALTA",
    reason: "Suspeita de trauma na cabeça ou na coluna",
  },
  QUEIMADURA_EXTENSA: {
    id: "QUEIMADURA_EXTENSA",
    text:
      "A queimadura é *maior que a palma da mão*, atinge *rosto, mãos, pés ou genitais*, tem a pele " +
      "branca/preta ou foi causada por *produto químico*?",
    dangerAnswer: true,
    severityIfDanger: "ALTA",
    reason: "Queimadura extensa, profunda ou em área crítica",
  },
  OBJETO_CRAVADO: {
    id: "OBJETO_CRAVADO",
    text: "Há *objeto cravado* no corpo ou *osso aparecendo*?",
    dangerAnswer: true,
    severityIfDanger: "ALTA",
    reason: "Objeto cravado ou fratura exposta",
  },
  CORTE_PROFUNDO: {
    id: "CORTE_PROFUNDO",
    text: "O corte é *profundo ou largo* (bordas abertas, parece precisar de pontos)?",
    dangerAnswer: true,
    severityIfDanger: "MODERADA",
    reason: "Corte profundo (provável sutura)",
  },
  CONSEGUE_TOSSIR: {
    id: "CONSEGUE_TOSSIR",
    text: "A pessoa engasgada *consegue tossir, falar ou respirar*?",
    dangerAnswer: false,
    severityIfDanger: "CRITICA",
    reason: "Engasgo com obstrução total das vias aéreas",
    criticalKind: "HEIMLICH",
  },
  CHOQUE_GRAVE: {
    id: "CHOQUE_GRAVE",
    text:
      "Depois do choque ela *desmaiou*, tem *queimadura*, dor no peito, coração disparado ou foi " +
      "*alta tensão* (poste, fio da rua)?",
    dangerAnswer: true,
    severityIfDanger: "ALTA",
    reason: "Choque elétrico com sinais de gravidade",
  },
  INTOXICACAO_SINTOMAS: {
    id: "INTOXICACAO_SINTOMAS",
    text:
      "Ela está com *sonolência, vômitos, falta de ar, convulsão* ou a boca/garganta queimando?",
    dangerAnswer: true,
    severityIfDanger: "ALTA",
    reason: "Intoxicação com sintomas",
  },
  AFOGAMENTO_SINTOMAS: {
    id: "AFOGAMENTO_SINTOMAS",
    text: "Ela tem *tosse que não passa, falta de ar, espuma na boca* ou está confusa?",
    dangerAnswer: true,
    severityIfDanger: "ALTA",
    reason: "Afogamento com sintomas respiratórios",
  },
};

/* -------------------------------------------------------------------------- */
/* Instruções imediatas para casos CRÍTICOS                                   */
/* -------------------------------------------------------------------------- */

/** Enviadas ANTES do pedido de localização: são os primeiros minutos que salvam vidas. */
export const CRITICAL_ACTIONS: Record<CriticalKind, string> = {
  RCP:
    "🫀 *Faça massagem cardíaca (RCP) AGORA:*\n" +
    "1. Deite a pessoa de barriga para cima em superfície firme.\n" +
    "2. Mãos uma sobre a outra no *centro do peito*, braços esticados.\n" +
    "3. Empurre *forte e rápido*: 5 a 6 cm, *100 a 120 vezes por minuto* (ritmo de \"Stayin' Alive\").\n" +
    "4. Deixe o peito voltar entre as compressões. *Não pare* até o socorro chegar ou a pessoa reagir.\n" +
    "5. Se houver desfibrilador (DEA) por perto, peça para alguém buscar e siga o aparelho.\n" +
    "_Bebês: use 2 dedos no centro do peito, cerca de 4 cm._",
  HEIMLICH:
    "🫁 *Engasgo grave — manobra de Heimlich:*\n" +
    "1. Fique atrás da pessoa e abrace-a pela cintura.\n" +
    "2. Mão fechada *um pouco acima do umbigo*, a outra mão por cima.\n" +
    "3. Puxe com força *para dentro e para cima*, várias vezes, até o objeto sair.\n" +
    "4. *Bebê (menos de 1 ano):* de bruços no seu antebraço, cabeça mais baixa: 5 tapas firmes nas " +
    "costas, depois vire e faça 5 compressões no peito com 2 dedos. Repita.\n" +
    "5. Se a pessoa desmaiar, deite-a e comece a massagem cardíaca (envie *RCP*).",
  HEMORRAGIA:
    "🩸 *Sangramento intenso — aperte o ferimento:*\n" +
    "1. Se puder, proteja as mãos (luva ou saco plástico).\n" +
    "2. Aperte *firme e sem soltar* com pano limpo, gaze ou roupa.\n" +
    "3. Se o pano encharcar, *não tire*: coloque outro por cima e continue apertando.\n" +
    "4. *Não retire objetos cravados*: apoie panos ao redor deles.\n" +
    "5. Mantenha a pessoa deitada e aquecida.",
  INCONSCIENTE:
    "😶 *Vítima desacordada:*\n" +
    "1. Chame alto e toque nos ombros. Observe o peito por até 10 segundos.\n" +
    "2. *Se NÃO respira* (ou só \"puxa o ar\" às vezes): comece a massagem cardíaca — envie *RCP*.\n" +
    "3. *Se respira e NÃO houve trauma*: vire-a de lado (posição lateral de segurança).\n" +
    "4. *Se houve queda ou batida*: não mova a vítima, a menos que haja perigo no local.\n" +
    "5. Não dê água nem comida.",
  FERRAGENS:
    "🚒 *Vítima presa / risco de incêndio:*\n" +
    "1. Ligue também para os *Bombeiros (193)*.\n" +
    "2. Ligue o pisca-alerta e sinalize o local; fique em lugar seguro.\n" +
    "3. Desligue o motor se for seguro. Não fume perto.\n" +
    "4. *Não tente retirar a vítima*, a não ser que haja fogo — pode piorar lesões na coluna.\n" +
    "5. Converse com a vítima e mantenha-a calma.",
  CONVULSAO:
    "⚡ *Convulsão:*\n" +
    "1. Afaste objetos e proteja a cabeça com algo macio.\n" +
    "2. *Não coloque nada na boca* e não segure os movimentos.\n" +
    "3. Afrouxe roupas apertadas e marque o tempo da crise.\n" +
    "4. Quando parar, vire a pessoa de lado.\n" +
    "5. Se ela não voltar a respirar normalmente, comece a massagem cardíaca (envie *RCP*).",
  GERAL:
    "🆘 *Enquanto o socorro não chega:*\n" +
    "1. Garanta que o local é seguro para você.\n" +
    "2. Mantenha a vítima em repouso, na posição mais confortável para respirar.\n" +
    "3. Não dê água, comida nem remédios.\n" +
    "4. Se ela desmaiar e parar de respirar, comece a massagem cardíaca (envie *RCP*).",
};

/* -------------------------------------------------------------------------- */
/* Protocolos por tipo de acidente                                            */
/* -------------------------------------------------------------------------- */

export interface Protocol {
  type: IncidentType;
  /** Título da opção na lista (máx. 24 caracteres). */
  label: string;
  /** Descrição curta na lista (máx. 72 caracteres). */
  description: string;
  /** Em quais menus (trânsito/doméstico) este tipo aparece. */
  contexts: IncidentContext[];
  /** Gravidade mínima, mesmo que todas as respostas sejam tranquilizadoras. */
  minSeverity: Severity;
  /** Perguntas na ordem em que são feitas (as de risco de vida primeiro). */
  questions: QuestionId[];
  /** Passo a passo de primeiros socorros. */
  steps: string;
  /** Sinais que indicam piora (o usuário deve escrever PIOROU). */
  warningSigns: string;
}

export const PROTOCOLS: Record<IncidentType, Protocol> = {
  COLISAO: {
    type: "COLISAO",
    label: "Batida de carro",
    description: "Colisão, capotamento ou engavetamento",
    contexts: ["TRANSITO"],
    // Mesmo sem sintomas, a adrenalina esconde lesões: sempre recomendamos avaliação.
    minSeverity: "MODERADA",
    questions: ["PRESO_FERRAGENS", "CONSCIENTE", "RESPIRA", "SANGRAMENTO_GRAVE", "LESAO_COLUNA_CABECA"],
    steps:
      "🚗 *Primeiros socorros — batida de carro:*\n" +
      "1. *Segurança primeiro:* pisca-alerta, triângulo a ~30 passos e fique fora da pista.\n" +
      "2. Desligue o motor dos veículos envolvidos, se for seguro.\n" +
      "3. *Não mova a vítima* (risco de lesão na coluna), a não ser que haja fogo ou outro perigo.\n" +
      "4. Converse com ela, peça que não se mexa e mantenha-a aquecida.\n" +
      "5. Comprima sangramentos com pano limpo.\n" +
      "6. Não dê água nem comida.",
    warningSigns:
      "dor no pescoço/costas, formigamento, sonolência, vômitos, falta de ar, barriga dura ou dolorida, " +
      "palidez e suor frio",
  },
  MOTO: {
    type: "MOTO",
    label: "Moto ou bicicleta",
    description: "Queda ou batida de moto, bicicleta ou patinete",
    contexts: ["TRANSITO"],
    minSeverity: "MODERADA",
    questions: ["CONSCIENTE", "RESPIRA", "SANGRAMENTO_GRAVE", "LESAO_COLUNA_CABECA"],
    steps:
      "🏍️ *Primeiros socorros — acidente de moto/bicicleta:*\n" +
      "1. Sinalize o local e proteja-se do trânsito.\n" +
      "2. *NÃO retire o capacete* — só profissionais devem fazer isso.\n" +
      "3. *Não mova a vítima* nem a deixe levantar.\n" +
      "4. Comprima sangramentos com pano limpo.\n" +
      "5. Mantenha-a aquecida e converse para mantê-la acordada.\n" +
      "6. Não dê água nem comida.",
    warningSigns:
      "sonolência, confusão, vômitos, dor no pescoço, formigamento, deformidade em braços/pernas, falta de ar",
  },
  ATROPELAMENTO: {
    type: "ATROPELAMENTO",
    label: "Atropelamento",
    description: "Pedestre ou ciclista atingido por veículo",
    contexts: ["TRANSITO"],
    // Trauma de alta energia: sempre aciona o hospital.
    minSeverity: "ALTA",
    questions: ["CONSCIENTE", "RESPIRA", "SANGRAMENTO_GRAVE"],
    steps:
      "🚶 *Primeiros socorros — atropelamento:*\n" +
      "1. Sinalize o local para evitar novo acidente.\n" +
      "2. *Não mova a vítima* e não a deixe levantar, mesmo que diga estar bem.\n" +
      "3. Comprima sangramentos com pano limpo.\n" +
      "4. Mantenha-a aquecida (casaco, manta) e converse com ela.\n" +
      "5. Não dê água nem comida.\n" +
      "6. Anote a placa do veículo, se possível.",
    warningSigns: "sonolência, vômitos, falta de ar, palidez, suor frio, barriga dura",
  },
  QUEDA: {
    type: "QUEDA",
    label: "Queda",
    description: "Queda de escada, altura, tombo ou escorregão",
    contexts: ["DOMESTICO", "TRANSITO"],
    minSeverity: "BAIXA",
    questions: ["CONSCIENTE", "RESPIRA", "SANGRAMENTO_GRAVE", "LESAO_COLUNA_CABECA"],
    steps:
      "🪜 *Primeiros socorros — queda:*\n" +
      "1. Se houver dor no pescoço/costas, *não mova a pessoa*.\n" +
      "2. Suspeita de fratura (dor forte, inchaço, deformidade): *não tente colocar no lugar*; " +
      "imobilize na posição encontrada com papelão/revista e panos.\n" +
      "3. Gelo envolto em pano por 15–20 min em batidas e inchaços (nunca gelo direto na pele).\n" +
      "4. Lave arranhões com água e sabão.\n" +
      "5. Idosos e crianças que bateram a cabeça: observe por 24 h.",
    warningSigns:
      "vômitos, sonolência, confusão, dor de cabeça forte, sangue ou líquido saindo do nariz/ouvido, " +
      "pupilas de tamanhos diferentes, fraqueza em braço/perna",
  },
  QUEIMADURA: {
    type: "QUEIMADURA",
    label: "Queimadura",
    description: "Fogo, óleo/água quente, vapor, produto químico",
    contexts: ["DOMESTICO"],
    minSeverity: "BAIXA",
    questions: ["CONSCIENTE", "RESPIRA", "QUEIMADURA_EXTENSA"],
    steps:
      "🔥 *Primeiros socorros — queimadura:*\n" +
      "1. Afaste a pessoa da fonte de calor.\n" +
      "2. *Água corrente fria (não gelada) por 20 minutos* sobre a queimadura.\n" +
      "3. Retire anéis, relógios e roupas soltas *antes de inchar* (não puxe o que estiver grudado).\n" +
      "4. Cubra com pano limpo e úmido ou filme plástico.\n" +
      "5. *NÃO use* pasta de dente, manteiga, óleo, pó de café, gelo ou pomadas caseiras.\n" +
      "6. *Não estoure bolhas.*\n" +
      "7. Produto químico: lave com muita água corrente por 20 min.",
    warningSigns: "bolhas grandes, pele branca ou preta, febre, pus, dor que aumenta, dificuldade para respirar",
  },
  CORTE: {
    type: "CORTE",
    label: "Corte ou ferimento",
    description: "Faca, vidro, objeto cortante ou perfurante",
    contexts: ["DOMESTICO"],
    minSeverity: "BAIXA",
    questions: ["CONSCIENTE", "SANGRAMENTO_GRAVE", "OBJETO_CRAVADO", "CORTE_PROFUNDO"],
    steps:
      "🩹 *Primeiros socorros — corte:*\n" +
      "1. Aperte com pano limpo por 10 minutos sem soltar para parar o sangramento.\n" +
      "2. Lave com água corrente e sabão neutro.\n" +
      "3. Cubra com gaze ou curativo limpo.\n" +
      "4. *Objeto cravado: não retire* — apoie com panos e procure atendimento.\n" +
      "5. Mantenha a parte machucada elevada, se não houver fratura.\n" +
      "6. Confira se a vacina antitetânica está em dia (reforço a cada 10 anos).",
    warningSigns: "sangramento que volta, vermelhidão que aumenta, pus, febre, dormência ou dedo que não mexe",
  },
  ENGASGO: {
    type: "ENGASGO",
    label: "Engasgo",
    description: "Alimento ou objeto preso na garganta",
    contexts: ["DOMESTICO"],
    minSeverity: "BAIXA",
    questions: ["CONSEGUE_TOSSIR", "CONSCIENTE"],
    steps:
      "🫁 *Primeiros socorros — engasgo leve:*\n" +
      "1. Se a pessoa *consegue tossir ou falar*, incentive-a a *tossir com força*.\n" +
      "2. *Não dê tapas nas costas* nem água enquanto ela tosse.\n" +
      "3. Não tente tirar o objeto com os dedos se não estiver visível.\n" +
      "4. Se ela parar de tossir/falar ou ficar roxa: *manobra de Heimlich* (envie *PIOROU*).",
    warningSigns: "não consegue mais tossir ou falar, lábios roxos, chiado, tosse que não passa após horas",
  },
  CHOQUE: {
    type: "CHOQUE",
    label: "Choque elétrico",
    description: "Tomada, fio desencapado, eletrodoméstico, rede",
    contexts: ["DOMESTICO"],
    // Choque pode causar arritmia mesmo sem sintomas aparentes.
    minSeverity: "MODERADA",
    questions: ["CONSCIENTE", "RESPIRA", "CHOQUE_GRAVE"],
    steps:
      "⚡ *Primeiros socorros — choque elétrico:*\n" +
      "1. *NÃO toque na vítima* enquanto ela estiver em contato com a eletricidade.\n" +
      "2. *Desligue o disjuntor* ou a chave geral.\n" +
      "3. Se não der, afaste o fio com material *seco e não condutor* (cabo de vassoura de madeira, plástico).\n" +
      "4. Fio da rede elétrica (poste): mantenha distância e chame a concessionária e o 193.\n" +
      "5. Resfrie queimaduras com água corrente e cubra com pano limpo.",
    warningSigns: "dor no peito, coração disparado ou irregular, falta de ar, confusão, queimaduras",
  },
  INTOXICACAO: {
    type: "INTOXICACAO",
    label: "Intoxicação",
    description: "Produto de limpeza, remédios, veneno, gás",
    contexts: ["DOMESTICO"],
    minSeverity: "MODERADA",
    questions: ["CONSCIENTE", "RESPIRA", "INTOXICACAO_SINTOMAS"],
    steps:
      "☠️ *Primeiros socorros — intoxicação:*\n" +
      "1. Ligue para o *Disque-Intoxicação: 0800 722 6001* (gratuito, 24 h).\n" +
      "2. *NÃO provoque vômito* e não dê leite, água ou óleo sem orientação.\n" +
      "3. *Guarde a embalagem* do produto/remédio para mostrar no atendimento.\n" +
      "4. Gás ou fumaça: abra janelas e leve a pessoa para o ar livre (sem se arriscar).\n" +
      "5. Produto na pele ou nos olhos: lave com água corrente por 15 minutos.",
    warningSigns: "sonolência, vômitos, convulsão, falta de ar, boca/garganta queimando, confusão",
  },
  AFOGAMENTO: {
    type: "AFOGAMENTO",
    label: "Afogamento",
    description: "Piscina, banheira, balde, mar ou rio",
    contexts: ["DOMESTICO"],
    // Todo afogamento precisa de avaliação (risco de piora horas depois).
    minSeverity: "MODERADA",
    questions: ["CONSCIENTE", "RESPIRA", "AFOGAMENTO_SINTOMAS"],
    steps:
      "🌊 *Primeiros socorros — afogamento:*\n" +
      "1. *Não entre na água se não for seguro*: jogue algo que flutue (boia, garrafa PET, isopor).\n" +
      "2. Fora da água, deite a pessoa de barriga para cima.\n" +
      "3. Se *não respira*: comece a massagem cardíaca (envie *RCP*); se souber, faça ventilações boca a boca.\n" +
      "4. Se respira: vire de lado, tire a roupa molhada e aqueça com toalhas.\n" +
      "5. Não tente \"tirar a água da barriga\".",
    warningSigns: "tosse persistente, falta de ar, sonolência, febre nas horas seguintes",
  },
  OUTRO: {
    type: "OUTRO",
    label: "Outro acidente",
    description: "Não está na lista",
    contexts: ["DOMESTICO", "TRANSITO"],
    minSeverity: "BAIXA",
    questions: ["CONSCIENTE", "RESPIRA", "SANGRAMENTO_GRAVE", "LESAO_COLUNA_CABECA"],
    steps:
      "🆘 *Orientações gerais:*\n" +
      "1. Garanta que o local é seguro para você e para a vítima.\n" +
      "2. Se houve batida ou queda, não mova a vítima.\n" +
      "3. Comprima sangramentos com pano limpo.\n" +
      "4. Mantenha a vítima aquecida e calma.\n" +
      "5. Não dê água, comida nem remédios.",
    warningSigns: "desmaio, falta de ar, sangramento que não para, dor forte, confusão, vômitos",
  },
};

/** Tipos exibidos no menu de cada contexto, na ordem do menu. */
export function typesForContext(context: IncidentContext): IncidentType[] {
  return (Object.values(PROTOCOLS) as Protocol[])
    .filter((p) => p.contexts.includes(context))
    .map((p) => p.type);
}

/* -------------------------------------------------------------------------- */
/* Textos fixos                                                               */
/* -------------------------------------------------------------------------- */

export const DISCLAIMER =
  "_As orientações do emergencIA não substituem atendimento médico. Em emergência ligue 192 (SAMU) " +
  "ou 193 (Bombeiros)._";

export const EMERGENCY_NUMBERS =
  "📞 *Números de emergência:* SAMU *192* · Bombeiros *193* · Polícia *190* · " +
  "Disque-Intoxicação *0800 722 6001*";
