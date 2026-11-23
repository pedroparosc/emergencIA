import { describe, expect, it } from "vitest";
import { formatDistance, haversineKm, isValidPoint } from "@/lib/geo/distance";
import { defaultHospital, nearestHospitals } from "@/lib/geo/hospitals";
import type { Hospital } from "@/lib/domain/types";

describe("haversineKm", () => {
  it("São Paulo → Rio de Janeiro ≈ 357 km", () => {
    const d = haversineKm({ lat: -23.5505, lng: -46.6333 }, { lat: -22.9068, lng: -43.1729 });
    expect(d).toBeGreaterThan(350);
    expect(d).toBeLessThan(365);
  });
  it("mesmo ponto = 0", () => {
    expect(haversineKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
});

describe("nearestHospitals", () => {
  const base: Hospital[] = [
    { id: "a", name: "A", address: "", lat: 0, lng: 0.1, hasEmergency: true, kind: "PUBLICO" },
    { id: "b", name: "B", address: "", lat: 0, lng: 0.01, hasEmergency: true, kind: "PUBLICO" },
    { id: "c", name: "C", address: "", lat: 0, lng: 0.001, hasEmergency: false, kind: "PRIVADO" },
  ];
  it("ordena por distância e ignora hospitais sem PS", () => {
    const r = nearestHospitals({ lat: 0, lng: 0 }, 3, base);
    expect(r.map((h) => h.id)).toEqual(["b", "a"]);
    expect(r[0]!.distanceKm).toBeCloseTo(1.11, 1);
  });
  it("na base real, a Av. Paulista fica mais perto do HC ou da Santa Casa", () => {
    const [first] = nearestHospitals({ lat: -23.5614, lng: -46.6559 });
    expect(["hc-fmusp", "santa-casa-sp"]).toContain(first!.id);
  });
  it("hospital padrão existe", () => {
    expect(defaultHospital().id).toBe("hc-fmusp");
  });
});

describe("utilitários", () => {
  it("formatDistance", () => {
    expect(formatDistance(0.85)).toBe("850 m");
    expect(formatDistance(2.345)).toBe("2,3 km");
  });
  it("isValidPoint", () => {
    expect(isValidPoint({ lat: -23, lng: -46 })).toBe(true);
    expect(isValidPoint({ lat: 200, lng: 0 })).toBe(false);
    expect(isValidPoint({ lat: Number.NaN, lng: 0 })).toBe(false);
  });
});
