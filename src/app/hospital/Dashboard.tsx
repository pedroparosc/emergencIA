"use client";

/**
 * Painel do hospital (componente C12).
 *
 * - Busca /api/alerts a cada 5 s (polling simples, suficiente para o MVP na Vercel).
 * - Destaca chamados novos e mostra a contagem no título da aba.
 * - Mostra mapa (OpenStreetMap, sem chave de API), rota, motivos, notas e contato.
 * - Botões de status avisam o usuário pelo WhatsApp/simulador.
 * O token do painel (DASHBOARD_TOKEN) fica no localStorage deste navegador.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlertStatus, EmergencyAlert, Severity } from "@/lib/domain/types";

const TOKEN_KEY = "emergencia.dashboard.token";
const POLL_MS = 5000;

const SEVERITY_TEXT: Record<Severity, string> = { CRITICA: "CRÍTICA", ALTA: "ALTA", MODERADA: "MODERADA", BAIXA: "BAIXA" };
const STATUS_TEXT: Record<AlertStatus, string> = {
  NOVO: "🆕 Novo",
  VISUALIZADO: "👀 Visualizado",
  A_CAMINHO: "🚑 A caminho",
  FINALIZADO: "✅ Finalizado",
  CANCELADO: "✖ Cancelado",
};
const TYPE_TEXT: Record<string, string> = {
  COLISAO: "Batida de carro", MOTO: "Moto/bicicleta", ATROPELAMENTO: "Atropelamento", QUEDA: "Queda",
  QUEIMADURA: "Queimadura", CORTE: "Corte/ferimento", ENGASGO: "Engasgo", CHOQUE: "Choque elétrico",
  INTOXICACAO: "Intoxicação", AFOGAMENTO: "Afogamento", OUTRO: "Outro",
};
const ACTIVE: AlertStatus[] = ["NOVO", "VISUALIZADO", "A_CAMINHO"];

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(ts).toLocaleString("pt-BR");
}

/** URL do mapa embutido do OpenStreetMap centrado no ponto, com marcador. */
function osmEmbed(lat: number, lng: number): string {
  const d = 0.006;
  const bbox = [lng - d, lat - d, lng + d, lat + d].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export function Dashboard() {
  const [token, setToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [needsToken, setNeedsToken] = useState(false);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ativos" | "todos">("ativos");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => setToken(readToken()), []);

  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts?limit=100", { headers, cache: "no-store" });
      if (res.status === 401) {
        setNeedsToken(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { alerts: EmergencyAlert[] };
      setNeedsToken(false);
      setError(null);
      setLastUpdate(Date.now());
      // Marca como "novos" os chamados que apareceram desde a última consulta.
      if (knownIds.current) {
        const fresh = data.alerts.filter((a) => !knownIds.current!.has(a.id)).map((a) => a.id);
        if (fresh.length) setFreshIds(new Set(fresh));
      }
      knownIds.current = new Set(data.alerts.map((a) => a.id));
      setAlerts(data.alerts);
    } catch (e) {
      setError(`Falha ao atualizar: ${String(e)}`);
    }
  }, [headers]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Título da aba mostra quantos chamados novos aguardam.
  const newCount = alerts.filter((a) => a.status === "NOVO").length;
  useEffect(() => {
    document.title = newCount ? `(${newCount}) Painel do hospital · emergencIA` : "Painel do hospital · emergencIA";
  }, [newCount]);

  const visible = filter === "ativos" ? alerts.filter((a) => ACTIVE.includes(a.status)) : alerts;
  const selected = alerts.find((a) => a.id === selectedId) ?? visible[0] ?? null;

  async function setStatus(alert: EmergencyAlert, status: AlertStatus) {
    const res = await fetch(`/api/alerts/${encodeURIComponent(alert.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(headers ?? {}) },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const { alert: updated } = (await res.json()) as { alert: EmergencyAlert };
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } else {
      setError(`Não foi possível mudar o status (HTTP ${res.status}).`);
    }
  }

  function saveToken(e: React.FormEvent) {
    e.preventDefault();
    try {
      localStorage.setItem(TOKEN_KEY, tokenDraft);
    } catch {
      /* ignora */
    }
    setToken(tokenDraft);
  }

  if (needsToken) {
    return (
      <main className="container" style={{ padding: "32px 16px" }}>
        <div className="card">
          <h1 style={{ marginTop: 0 }}>🏥 Painel do hospital</h1>
          <p className="muted">Informe o token de acesso do painel (variável DASHBOARD_TOKEN).</p>
          <form className="form-inline" onSubmit={saveToken}>
            <label htmlFor="token" className="sr-only">
              Token
            </label>
            <input id="token" type="password" value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} autoComplete="current-password" />
            <button className="btn btn-primary" type="submit">
              Entrar
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="row-between" style={{ paddingTop: 16 }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>🏥 Chamados</h1>
        <div className="tabs" role="tablist" aria-label="Filtro">
          {(["ativos", "todos"] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={`btn btn-sm ${filter === f ? "btn-primary" : ""}`} onClick={() => setFilter(f)}>
              {f === "ativos" ? "Ativos" : "Todos"}
            </button>
          ))}
        </div>
      </div>
      <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }} aria-live="polite">
        {error ?? (lastUpdate ? `Atualizado ${timeAgo(lastUpdate)} · atualização automática a cada 5 s` : "Carregando…")}
      </p>

      <div className="dash">
        <div className="dash-list">
          {visible.length === 0 ? (
            <div className="card">
              <p>Nenhum chamado {filter === "ativos" ? "ativo" : ""} no momento.</p>
              <p className="muted" style={{ marginTop: 8 }}>
                Dica: abra o <a href="/simulador">simulador</a> e descreva um caso grave para ver o chamado chegar aqui.
              </p>
            </div>
          ) : null}
          {visible.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`card alert-item sev-${a.severity} ${freshIds.has(a.id) ? "new" : ""}`}
              aria-current={selected?.id === a.id}
              onClick={() => setSelectedId(a.id)}
            >
              <div className="row-between">
                <strong>{a.id}</strong>
                <span className={`badge ${a.severity}`}>{SEVERITY_TEXT[a.severity]}</span>
              </div>
              <div>{a.incidentType ? TYPE_TEXT[a.incidentType] : "Ocorrência não identificada"}</div>
              <div className="row-between muted" style={{ fontSize: "0.85rem" }}>
                <span>{STATUS_TEXT[a.status]}</span>
                <span>{timeAgo(a.createdAt)}</span>
              </div>
              {a.channel === "simulator" ? <span className="badge">SIMULAÇÃO</span> : null}
            </button>
          ))}
        </div>

        {selected ? <AlertDetail alert={selected} onStatus={setStatus} /> : null}
      </div>
    </main>
  );
}

function AlertDetail({ alert, onStatus }: { alert: EmergencyAlert; onStatus: (a: EmergencyAlert, s: AlertStatus) => void }) {
  const loc = alert.location;
  const hasGps = typeof loc.lat === "number" && typeof loc.lng === "number";
  return (
    <section className="card" aria-label={`Chamado ${alert.id}`}>
      <div className="row-between">
        <h2 style={{ margin: 0 }}>{alert.id}</h2>
        <span className={`badge ${alert.severity}`}>{SEVERITY_TEXT[alert.severity]}</span>
      </div>

      {hasGps ? (
        <>
          <iframe className="map" style={{ marginTop: 12 }} title="Mapa da localização da vítima" src={osmEmbed(loc.lat!, loc.lng!)} loading="lazy" />
          <div className="actions">
            <a className="btn btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer">
              🧭 Rota até a vítima
            </a>
            <a className="btn btn-sm" href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer">
              🗺️ Abrir no Google Maps
            </a>
          </div>
        </>
      ) : (
        <p className="alert-192" style={{ margin: "12px 0" }}>
          📍 Sem GPS. Endereço informado: <strong>{loc.address ?? "não informado"}</strong>
        </p>
      )}

      <dl className="kv">
        <dt>Status</dt>
        <dd>{STATUS_TEXT[alert.status]}</dd>
        <dt>Ocorrência</dt>
        <dd>
          {alert.incidentType ? TYPE_TEXT[alert.incidentType] : "Não identificada"}
          {alert.context ? ` · ${alert.context === "TRANSITO" ? "trânsito" : "doméstico"}` : ""}
        </dd>
        <dt>Motivos</dt>
        <dd>{alert.reasons.join("; ") || "—"}</dd>
        {loc.address && hasGps ? (
          <>
            <dt>Endereço</dt>
            <dd>{loc.address}</dd>
          </>
        ) : null}
        <dt>Hospital</dt>
        <dd>
          {alert.hospital.name}
          {Number.isFinite(alert.hospital.distanceKm) ? ` (${alert.hospital.distanceKm.toFixed(1).replace(".", ",")} km)` : ""}
        </dd>
        <dt>Contato</dt>
        <dd>
          {alert.channel === "whatsapp" ? (
            <>
              <a href={`https://wa.me/${alert.contact}`} target="_blank" rel="noopener noreferrer">
                WhatsApp +{alert.contact}
              </a>{" "}
              · <a href={`tel:+${alert.contact}`}>Ligar</a>
            </>
          ) : (
            "Simulador (demonstração)"
          )}
        </dd>
        <dt>Aberto</dt>
        <dd>{new Date(alert.createdAt).toLocaleString("pt-BR")}</dd>
      </dl>

      {alert.notes.length ? (
        <>
          <h3 style={{ marginBottom: 4 }}>Atualizações</h3>
          <ul style={{ marginTop: 0 }}>
            {alert.notes.map((n, i) => (
              <li key={i}>
                <span className="muted">{new Date(n.at).toLocaleTimeString("pt-BR")}</span> — {n.text}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="actions">
        <button className="btn btn-sm" disabled={alert.status !== "NOVO"} onClick={() => onStatus(alert, "VISUALIZADO")}>
          👀 Visualizado
        </button>
        <button className="btn btn-sm btn-primary" disabled={!ACTIVE.includes(alert.status) || alert.status === "A_CAMINHO"} onClick={() => onStatus(alert, "A_CAMINHO")}>
          🚑 Equipe a caminho
        </button>
        <button className="btn btn-sm" disabled={!ACTIVE.includes(alert.status)} onClick={() => onStatus(alert, "FINALIZADO")}>
          ✅ Finalizar
        </button>
        <button className="btn btn-sm" disabled={!ACTIVE.includes(alert.status)} onClick={() => onStatus(alert, "CANCELADO")}>
          ✖ Cancelar
        </button>
      </div>
    </section>
  );
}
