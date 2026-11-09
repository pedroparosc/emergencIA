"use client";

/**
 * Simulador do chat do WhatsApp (componente C12).
 *
 * Usa EXATAMENTE o mesmo motor de conversa do WhatsApp (via /api/simulator) e renderiza os
 * mesmos tipos de mensagem: texto, botões, lista e pedido de localização. Serve para:
 *   - demonstrar o projeto sem depender da conta da Meta;
 *   - testar fluxos rapidamente durante o desenvolvimento.
 * O id da sessão é anônimo e fica no localStorage (apenas conveniência deste navegador).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { WhatsAppText } from "@/components/WhatsAppText";
import type { IncomingMessage, ListRow, OutgoingMessage, Severity } from "@/lib/domain/types";

type ChatItem = { from: "user"; text: string } | { from: "bot"; message: OutgoingMessage };

const STORAGE_KEY = "emergencia.simulator.session";
/** Localização usada quando o GPS do navegador não está disponível (Av. Paulista, SP). */
const DEMO_LOCATION = { lat: -23.5614, lng: -46.6559, name: "Av. Paulista (demonstração)" };

const SEVERITY_TEXT: Record<Severity, string> = {
  CRITICA: "🔴 Crítica",
  ALTA: "🟠 Alta",
  MODERADA: "🟡 Moderada",
  BAIXA: "🟢 Baixa",
};

const EXAMPLES = [
  "Oi",
  "Meu pai caiu da escada e não acorda",
  "Cortei a mão com uma faca",
  "Meu filho engasgou",
  "Bati o carro na avenida",
];

function newSessionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sim-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function loadSessionId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    const id = newSessionId();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return newSessionId(); // navegação privada: sessão só desta aba
  }
}

/** Texto que representa a entrada do usuário no histórico. */
function describeInput(input: IncomingMessage): string {
  if (input.kind === "text") return input.text;
  if (input.kind === "choice") return input.title ?? input.id;
  return `📍 Localização enviada${input.name ? ` — ${input.name}` : ""}`;
}

export function Simulator() {
  const [sessionId, setSessionId] = useState<string>("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ title: string; rows: ListRow[] } | null>(null);
  const [locating, setLocating] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSessionId(loadSessionId()), []);

  // Rola para a última mensagem.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [items, busy]);

  /** Envia uma entrada ao motor de conversa e adiciona as respostas ao histórico. */
  const send = useCallback(
    async (input: IncomingMessage) => {
      if (!sessionId || busy) return;
      setItems((prev) => [...prev, { from: "user", text: describeInput(input) }]);
      setBusy(true);
      try {
        const res = await fetch("/api/simulator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, input }),
        });
        const data = (await res.json()) as {
          messages?: OutgoingMessage[];
          severity?: Severity | null;
          alertId?: string | null;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setItems((prev) => [...prev, ...(data.messages ?? []).map((m) => ({ from: "bot" as const, message: m }))]);
        setSeverity(data.severity ?? null);
        setAlertId(data.alertId ?? null);
      } catch (error) {
        setItems((prev) => [
          ...prev,
          { from: "bot", message: { kind: "text", text: `⚠️ Erro de conexão (${String(error)}). Em emergência, ligue *192*.` } },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [sessionId, busy],
  );

  // Com chamado aberto, busca atualizações do hospital (ex.: "equipe a caminho").
  useEffect(() => {
    if (!alertId || !sessionId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/simulator?sessionId=${encodeURIComponent(sessionId)}`);
        const data = (await res.json()) as { messages?: OutgoingMessage[] };
        if (data.messages?.length) {
          setItems((prev) => [...prev, ...data.messages!.map((m) => ({ from: "bot" as const, message: m }))]);
        }
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [alertId, sessionId]);

  /** Usa o GPS do navegador; se falhar, oferece a localização de demonstração. */
  function shareLocation() {
    if (!("geolocation" in navigator)) {
      void send({ kind: "location", ...DEMO_LOCATION });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        void send({ kind: "location", lat: pos.coords.latitude, lng: pos.coords.longitude, name: "Minha localização" });
      },
      () => {
        setLocating(false);
        void send({ kind: "location", ...DEMO_LOCATION });
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function restart() {
    const id = newSessionId();
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignora */
    }
    setSessionId(id);
    setItems([]);
    setSeverity(null);
    setAlertId(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void send({ kind: "text", text });
  }

  // Só a última mensagem do bot COM AÇÕES (botões/lista/localização) fica ativa, e apenas se o
  // usuário ainda não respondeu depois dela. Avisos assíncronos de texto (ex.: "equipe a
  // caminho") não desativam os botões de acompanhamento.
  const lastUserIndex = items.map((i) => i.from).lastIndexOf("user");
  const lastActionIndex = items.reduce(
    (acc, item, i) => (item.from === "bot" && item.message.kind !== "text" ? i : acc),
    -1,
  );

  return (
    <main className="sim">
      <div className="sim-header">
        <div className="avatar" aria-hidden>
          🚑
        </div>
        <div>
          <div className="title">emergencIA</div>
          <div className="sub">Simulador do WhatsApp</div>
        </div>
        <div className="spacer" />
        <button type="button" onClick={restart}>
          Reiniciar
        </button>
      </div>

      <div className="sim-status" aria-live="polite">
        <span>Gravidade: {severity ? SEVERITY_TEXT[severity] : "—"}</span>
        <span>·</span>
        <span>Chamado: {alertId ?? "—"}</span>
        {alertId ? (
          <a href="/hospital" target="_blank" rel="noopener noreferrer">
            ver no painel ↗
          </a>
        ) : null}
      </div>

      <div className="sim-log" ref={logRef} aria-live="polite">
        {items.length === 0 ? (
          <div className="sim-empty">
            <p>
              Descreva um acidente como faria no WhatsApp,
              <br />
              ou toque num exemplo:
            </p>
            <div className="chips">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="chip" onClick={() => void send({ kind: "text", text: ex })}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {items.map((item, index) => {
          if (item.from === "user") {
            return (
              <div key={index} className="bubble user">
                {item.text}
              </div>
            );
          }
          const m = item.message;
          const active = index === lastActionIndex && index > lastUserIndex && !busy;
          return (
            <div key={index} style={{ display: "contents" }}>
              <div className="bubble bot">
                <WhatsAppText text={m.text} />
              </div>
              {m.kind === "buttons" ? (
                <div className="bubble-actions">
                  {m.buttons.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="btn"
                      disabled={!active}
                      onClick={() => void send({ kind: "choice", id: b.id, title: b.title })}
                    >
                      {b.title}
                    </button>
                  ))}
                </div>
              ) : null}
              {m.kind === "list" ? (
                <div className="bubble-actions">
                  <button type="button" className="btn" disabled={!active} onClick={() => setSheet({ title: m.buttonLabel, rows: m.rows })}>
                    ☰ {m.buttonLabel}
                  </button>
                </div>
              ) : null}
              {m.kind === "location_request" ? (
                <div className="bubble-actions">
                  <button type="button" className="btn" disabled={!active || locating} onClick={shareLocation}>
                    {locating ? "Obtendo localização…" : "📍 Enviar localização"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!active}
                    onClick={() => void send({ kind: "location", ...DEMO_LOCATION })}
                  >
                    Usar local de demonstração
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
        {busy ? <div className="typing">digitando…</div> : null}
      </div>

      <form className="sim-input" onSubmit={submit}>
        <label htmlFor="sim-text" className="sr-only">
          Mensagem
        </label>
        <input
          id="sim-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Mensagem"
          autoComplete="off"
          maxLength={1000}
        />
        <button type="submit" aria-label="Enviar" disabled={busy || !draft.trim()}>
          ➤
        </button>
      </form>

      {sheet ? (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={sheet.title} onClick={(e) => e.stopPropagation()}>
            <h3>{sheet.title}</h3>
            {sheet.rows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="row"
                onClick={() => {
                  setSheet(null);
                  void send({ kind: "choice", id: row.id, title: row.title });
                }}
              >
                {row.title}
                {row.description ? <small>{row.description}</small> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
