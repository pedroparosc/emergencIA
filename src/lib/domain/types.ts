/**
 * Tipos de domínio do emergencIA (componente C1).
 *
 * Este módulo é a "língua comum" de todo o sistema. Ele NÃO depende de canal (WhatsApp,
 * simulador) nem de framework: o núcleo de triagem e a máquina de estados trabalham só com
 * estes tipos, e os adaptadores de canal traduzem de/para eles.
 */

/* -------------------------------------------------------------------------- */
/* Classificação do incidente                                                 */
/* -------------------------------------------------------------------------- */

/** Onde o acidente aconteceu. */
export type IncidentContext = "TRANSITO" | "DOMESTICO";

/** Tipos de acidente cobertos pela base de protocolos. */
export type IncidentType =
  | "COLISAO" // colisão de carro
  | "MOTO" // acidente de moto/bicicleta
  | "ATROPELAMENTO"
  | "QUEDA"
  | "QUEIMADURA"
  | "CORTE"
  | "ENGASGO"
  | "CHOQUE"
  | "INTOXICACAO"
  | "AFOGAMENTO"
  | "OUTRO";

/**
 * Nível de gravidade (inspirado nas cores do Protocolo de Manchester, simplificado para leigos):
 * - CRITICA: risco imediato de vida → aciona hospital + instruções de suporte básico de vida.
 * - ALTA: precisa de atendimento de urgência → aciona hospital.
 * - MODERADA: precisa de avaliação médica, mas a pessoa pode ir por meios próprios → indica o
 *   hospital mais próximo, SEM abrir chamado.
 * - BAIXA: cuidados em casa + sinais de alerta para observar.
 */
export type Severity = "CRITICA" | "ALTA" | "MODERADA" | "BAIXA";

/**
 * Natureza da situação crítica — define QUAIS instruções imediatas o bot envia primeiro
 * (ex.: massagem cardíaca, manobra de Heimlich, compressão de sangramento).
 */
export type CriticalKind =
  | "RCP"
  | "HEIMLICH"
  | "HEMORRAGIA"
  | "INCONSCIENTE"
  | "FERRAGENS"
  | "CONVULSAO"
  | "GERAL";

/** O que o sistema faz para cada gravidade. */
export type Disposition = "ACIONAR_HOSPITAL" | "INDICAR_HOSPITAL" | "CUIDADOS_EM_CASA";

/** Identificadores das perguntas de triagem (respostas sim/não). */
export type QuestionId =
  | "CONSCIENTE"
  | "RESPIRA"
  | "SANGRAMENTO_GRAVE"
  | "PRESO_FERRAGENS"
  | "LESAO_COLUNA_CABECA"
  | "QUEIMADURA_EXTENSA"
  | "CORTE_PROFUNDO"
  | "OBJETO_CRAVADO"
  | "CONSEGUE_TOSSIR"
  | "CHOQUE_GRAVE"
  | "INTOXICACAO_SINTOMAS"
  | "AFOGAMENTO_SINTOMAS";

/* -------------------------------------------------------------------------- */
/* Geolocalização                                                             */
/* -------------------------------------------------------------------------- */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Localização informada pelo usuário: por GPS (lat/lng) e/ou por endereço digitado. */
export interface UserLocation extends Partial<GeoPoint> {
  /** Nome do local, se o WhatsApp enviar (ex.: "Shopping X"). */
  name?: string;
  /** Endereço textual (enviado pelo WhatsApp ou digitado pelo usuário). */
  address?: string;
  /** "gps" quando há coordenadas; "texto" quando só temos o endereço digitado. */
  source: "gps" | "texto";
}

export interface Hospital extends GeoPoint {
  id: string;
  name: string;
  address: string;
  /** Telefone fixo do pronto-socorro (opcional, exibido para o usuário). */
  phone?: string;
  /** WhatsApp do hospital para receber chamados (só dígitos com DDI). */
  whatsapp?: string;
  /** Possui pronto-socorro / porta de urgência. */
  hasEmergency: boolean;
  kind: "PUBLICO" | "PRIVADO" | "FILANTROPICO";
}

export interface HospitalWithDistance extends Hospital {
  distanceKm: number;
}

/* -------------------------------------------------------------------------- */
/* Mensagens independentes de canal                                           */
/* -------------------------------------------------------------------------- */

/** Canal de origem da conversa. */
export type Channel = "whatsapp" | "simulator";

/** Entrada do usuário já normalizada pelo adaptador de canal. */
export type IncomingMessage =
  | { kind: "text"; text: string }
  /** Clique em botão ou item de lista (id definido por nós em OutgoingMessage). */
  | { kind: "choice"; id: string; title?: string }
  | { kind: "location"; lat: number; lng: number; name?: string; address?: string };

export interface ButtonOption {
  /** Identificador devolvido quando o usuário clica (máx. 256 caracteres). */
  id: string;
  /** Texto do botão — o WhatsApp limita a 20 caracteres. */
  title: string;
}

export interface ListRow {
  id: string;
  /** Título da linha — o WhatsApp limita a 24 caracteres. */
  title: string;
  /** Descrição — o WhatsApp limita a 72 caracteres. */
  description?: string;
}

/** Resposta do bot, independente de canal. O adaptador converte para o formato de cada canal. */
export type OutgoingMessage =
  | { kind: "text"; text: string }
  /** Até 3 botões de resposta rápida (limite do WhatsApp). */
  | { kind: "buttons"; text: string; buttons: ButtonOption[] }
  /** Lista de opções (até 10 linhas no WhatsApp). */
  | { kind: "list"; text: string; buttonLabel: string; rows: ListRow[] }
  /** Pede ao usuário que compartilhe a localização (botão nativo do WhatsApp). */
  | { kind: "location_request"; text: string };

/* -------------------------------------------------------------------------- */
/* Sessão de conversa                                                         */
/* -------------------------------------------------------------------------- */

/** Etapas da máquina de estados (ver diagrama em development_plan.md). */
export type ConversationStep =
  | "INICIO"
  | "CONTEXTO"
  | "TIPO"
  | "PERGUNTAS"
  | "AGUARDANDO_LOCALIZACAO"
  | "ACOMPANHAMENTO";

/** Para que estamos pedindo a localização. */
export type LocationPurpose = "ALERTA" | "INDICACAO";

export interface Session {
  /** Chave única: "<canal>:<telefone ou id do simulador>". */
  id: string;
  channel: Channel;
  /** Telefone do usuário (WhatsApp) ou id anônimo (simulador). */
  userId: string;
  step: ConversationStep;
  context?: IncidentContext;
  incidentType?: IncidentType;
  /** Respostas já dadas às perguntas de triagem. */
  answers: Partial<Record<QuestionId, boolean>>;
  /** Pergunta atualmente aguardando resposta. */
  pendingQuestion?: QuestionId;
  severity?: Severity;
  /** Natureza da situação crítica (só quando severity = CRITICA). */
  criticalKind?: CriticalKind;
  /** Motivos legíveis que levaram à gravidade (vão para o painel do hospital). */
  reasons: string[];
  locationPurpose?: LocationPurpose;
  location?: UserLocation;
  /** Chamado aberto nesta sessão (se houver). */
  alertId?: string;
  createdAt: number;
  updatedAt: number;
}

/* -------------------------------------------------------------------------- */
/* Efeitos colaterais pedidos pela máquina de estados                         */
/* -------------------------------------------------------------------------- */

/**
 * A máquina de estados é pura: quando precisa de I/O, devolve um "efeito" que o orquestrador
 * executa. Isso permite testar toda a lógica de conversa sem banco nem rede.
 */
export type Effect =
  /** Abrir chamado no hospital mais próximo com os dados da sessão. */
  | { type: "DISPATCH_ALERT" }
  /** Responder com os hospitais mais próximos (sem abrir chamado). */
  | { type: "SUGGEST_HOSPITALS" }
  /** Acrescentar uma observação a um chamado já aberto (ex.: "paciente piorou"). */
  | { type: "ADD_ALERT_NOTE"; note: string };

/* -------------------------------------------------------------------------- */
/* Chamado (alerta enviado ao hospital)                                       */
/* -------------------------------------------------------------------------- */

export type AlertStatus = "NOVO" | "VISUALIZADO" | "A_CAMINHO" | "FINALIZADO" | "CANCELADO";

export interface AlertNote {
  at: number;
  text: string;
}

export interface EmergencyAlert {
  /** Protocolo legível, ex.: "EMG-4F7K2". */
  id: string;
  createdAt: number;
  updatedAt: number;
  status: AlertStatus;
  severity: Severity;
  context?: IncidentContext;
  incidentType?: IncidentType;
  reasons: string[];
  location: UserLocation;
  /** Hospital acionado (o mais próximo com PS). */
  hospital: HospitalWithDistance;
  channel: Channel;
  /** Telefone para o hospital retornar o contato (WhatsApp). No simulador é um id anônimo. */
  contact: string;
  /** Sessão de origem — usada para avisar o usuário quando o status mudar. */
  sessionId: string;
  notes: AlertNote[];
}
