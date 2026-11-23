/**
 * Busca de hospitais (componente C7).
 */
import { DEFAULT_HOSPITAL_ID, HOSPITALS } from "@/data/hospitals";
import type { GeoPoint, Hospital, HospitalWithDistance } from "@/lib/domain/types";
import { haversineKm } from "./distance";

/**
 * Hospitais com pronto-socorro ordenados do mais próximo ao mais distante.
 * @param origin localização da vítima
 * @param limit quantos retornar (padrão 3)
 * @param hospitals base usada (injetável para testes)
 */
export function nearestHospitals(
  origin: GeoPoint,
  limit = 3,
  hospitals: Hospital[] = HOSPITALS,
): HospitalWithDistance[] {
  return hospitals
    .filter((h) => h.hasEmergency)
    .map((h) => ({ ...h, distanceKm: haversineKm(origin, h) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/** Hospital de referência (quando não há coordenadas). Distância desconhecida = NaN. */
export function defaultHospital(hospitals: Hospital[] = HOSPITALS): HospitalWithDistance {
  const h = hospitals.find((x) => x.id === DEFAULT_HOSPITAL_ID) ?? hospitals[0];
  if (!h) throw new Error("Nenhum hospital cadastrado em src/data/hospitals.ts");
  return { ...h, distanceKm: Number.NaN };
}
