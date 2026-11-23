/**
 * GET /api/hospitals/nearest?lat=-23.56&lng=-46.65&limit=3
 * Hospitais com pronto-socorro mais próximos (dados públicos, sem autenticação).
 */
import { isValidPoint } from "@/lib/geo/distance";
import { nearestHospitals } from "@/lib/geo/hospitals";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const point = { lat: Number(params.get("lat")), lng: Number(params.get("lng")) };
  if (!params.get("lat") || !params.get("lng") || !isValidPoint(point)) {
    return Response.json({ error: "Informe lat e lng válidos" }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(params.get("limit")) || 3, 1), 10);
  return Response.json({ hospitals: nearestHospitals(point, limit) });
}
