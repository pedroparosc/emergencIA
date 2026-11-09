/**
 * Base de hospitais com pronto-socorro — DADOS DE DEMONSTRAÇÃO.
 *
 * ⚠️ As coordenadas são APROXIMADAS e servem apenas para a demonstração acadêmica na cidade de
 * São Paulo. Antes de qualquer uso real, substitua por uma fonte oficial (CNES/DataSUS) e valide
 * cada endereço — ver tarefa F7.3 do development_plan.md.
 *
 * O campo `whatsapp` (opcional) permite que um hospital receba os chamados por WhatsApp. Na
 * demonstração usamos HOSPITAL_NOTIFY_WHATSAPP (variável de ambiente) para todos.
 */
import type { Hospital } from "@/lib/domain/types";

export const HOSPITALS: Hospital[] = [
  {
    id: "hc-fmusp",
    name: "Hospital das Clínicas (FMUSP)",
    address: "Av. Dr. Enéas Carvalho de Aguiar, 255 — Cerqueira César",
    lat: -23.5572,
    lng: -46.6693,
    hasEmergency: true,
    kind: "PUBLICO",
  },
  {
    id: "santa-casa-sp",
    name: "Santa Casa de São Paulo",
    address: "R. Dr. Cesário Mota Júnior, 112 — Vila Buarque",
    lat: -23.5436,
    lng: -46.6512,
    hasEmergency: true,
    kind: "FILANTROPICO",
  },
  {
    id: "hosp-sao-paulo",
    name: "Hospital São Paulo (Unifesp)",
    address: "R. Napoleão de Barros, 715 — Vila Clementino",
    lat: -23.5983,
    lng: -46.6449,
    hasEmergency: true,
    kind: "PUBLICO",
  },
  {
    id: "hm-tatuape",
    name: "Hospital Municipal do Tatuapé",
    address: "Av. Celso Garcia, 4815 — Tatuapé",
    lat: -23.5366,
    lng: -46.5745,
    hasEmergency: true,
    kind: "PUBLICO",
  },
  {
    id: "hm-jabaquara",
    name: "Hospital Municipal do Jabaquara",
    address: "Av. Francisco de Paula Quintanilha Ribeiro, 860 — Jabaquara",
    lat: -23.6371,
    lng: -46.6426,
    hasEmergency: true,
    kind: "PUBLICO",
  },
  {
    id: "hm-campo-limpo",
    name: "Hospital Municipal do Campo Limpo",
    address: "Estr. de Itapecerica, 1661 — Vila Maracanã",
    lat: -23.6424,
    lng: -46.7603,
    hasEmergency: true,
    kind: "PUBLICO",
  },
  {
    id: "hm-ermelino",
    name: "Hospital Municipal de Ermelino Matarazzo",
    address: "Av. Boturussu, 168 — Ermelino Matarazzo",
    lat: -23.4945,
    lng: -46.4807,
    hasEmergency: true,
    kind: "PUBLICO",
  },
  {
    id: "hm-pirituba",
    name: "Hospital Municipal de Pirituba",
    address: "Av. Menotti Laudisio, 100 — Pirituba",
    lat: -23.4855,
    lng: -46.7262,
    hasEmergency: true,
    kind: "PUBLICO",
  },
  {
    id: "hm-vila-nova-cachoeirinha",
    name: "Hospital Municipal da Vila Nova Cachoeirinha",
    address: "Av. Deputado Emílio Carlos, 3100 — Vila Nova Cachoeirinha",
    lat: -23.4724,
    lng: -46.6726,
    hasEmergency: true,
    kind: "PUBLICO",
  },
  {
    id: "hm-mboi-mirim",
    name: "Hospital Municipal M'Boi Mirim",
    address: "Estr. do M'Boi Mirim, 5203 — Jardim Ângela",
    lat: -23.6908,
    lng: -46.7716,
    hasEmergency: true,
    kind: "PUBLICO",
  },
];

/**
 * Hospital de referência usado quando o usuário só informa o endereço por texto (sem GPS) e
 * não conseguimos calcular distância. Na demonstração, o primeiro da lista.
 */
export const DEFAULT_HOSPITAL_ID = "hc-fmusp";
