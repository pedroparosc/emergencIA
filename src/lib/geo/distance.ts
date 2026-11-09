/**
 * Cálculos geográficos (componente C7).
 */
import type { GeoPoint } from "@/lib/domain/types";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Distância em linha reta entre dois pontos (fórmula de Haversine), em km.
 * É uma aproximação: a distância real por ruas costuma ser 20–40% maior. Para escolher o
 * hospital mais próximo dentro de uma cidade, a ordenação por linha reta é suficiente no MVP.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Coordenadas válidas? */
export function isValidPoint(p: Partial<GeoPoint>): p is GeoPoint {
  return (
    typeof p.lat === "number" && typeof p.lng === "number" &&
    Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
  );
}

/** Link para abrir o ponto no Google Maps. */
export const mapsLink = (p: GeoPoint): string => `https://www.google.com/maps?q=${p.lat},${p.lng}`;

/** Link de rota até o destino (usa a localização atual de quem abre). */
export const directionsLink = (p: GeoPoint): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

/** Formata a distância para exibição: "850 m" ou "2,3 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}
