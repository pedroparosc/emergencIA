/**
 * Página inicial (web mobile): apresenta o serviço e leva ao WhatsApp, ao simulador e ao 192.
 */
import Link from "next/link";
import { PROTOCOLS } from "@/lib/triage/protocols";

/** Link wa.me com mensagem inicial, se o número do bot estiver configurado. */
function whatsappLink(): string | undefined {
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  return number ? `https://wa.me/${number}?text=${encodeURIComponent("Oi, preciso de ajuda")}` : undefined;
}

export default function Home() {
  const wa = whatsappLink();
  const types = Object.values(PROTOCOLS).filter((p) => p.type !== "OUTRO");

  return (
    <main className="container">
      <section className="hero">
        <h1>
          Primeiros socorros no <em>WhatsApp</em>, e o hospital acionado com a sua localização.
        </h1>
        <p>
          O emergencIA orienta você, passo a passo, em acidentes de trânsito e domésticos, avalia a
          gravidade e, nos casos graves, abre um chamado no hospital mais próximo, sem você precisar
          explicar tudo por telefone.
        </p>
        <div className="cta">
          {wa ? (
            <a className="btn btn-wa" href={wa} target="_blank" rel="noopener noreferrer">
              💬 Falar no WhatsApp
            </a>
          ) : null}
          <Link className="btn" href="/simulador">
            🧪 Testar no simulador
          </Link>
          <a className="btn btn-primary" href="tel:192">
            📞 Ligar 192 (SAMU)
          </a>
        </div>
        <div className="alert-192" role="note">
          <span aria-hidden>⚠️</span>
          <span>
            <strong>Risco de vida?</strong> Ligue <strong>192</strong> imediatamente. O emergencIA é um
            apoio enquanto a ajuda chega e não substitui o atendimento médico.
          </span>
        </div>
      </section>

      <section className="section" aria-labelledby="como">
        <h2 id="como">Como funciona</h2>
        <div className="grid grid-3">
          <div className="card">
            <span className="step-num">1</span>
            <h3>Conte o que aconteceu</h3>
            <p>Escreva do seu jeito (“meu pai caiu da escada”) ou escolha nas opções.</p>
          </div>
          <div className="card">
            <span className="step-num">2</span>
            <h3>Responda 2 a 5 perguntas</h3>
            <p>Perguntas de sim/não avaliam a gravidade em segundos, como numa triagem.</p>
          </div>
          <div className="card">
            <span className="step-num">3</span>
            <h3>Receba ajuda certa</h3>
            <p>
              Orientação passo a passo. Se for grave, você envia a 📍 e o hospital mais próximo recebe
              o chamado com a sua localização.
            </p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="tipos">
        <h2 id="tipos">Situações cobertas</h2>
        <div className="chips">
          {types.map((p) => (
            <span key={p.type} className="chip">
              {p.label}
            </span>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="gravidade">
        <h2 id="gravidade">O que acontece em cada nível de gravidade</h2>
        <div className="grid grid-2">
          <div className="card sev-card sev-CRITICA">
            <h3>🔴 Crítica / 🟠 Alta</h3>
            <p>Instruções imediatas (RCP, Heimlich, sangramento) e chamado automático ao hospital mais próximo.</p>
          </div>
          <div className="card sev-card sev-MODERADA">
            <h3>🟡 Moderada</h3>
            <p>Orientação e indicação dos pronto-socorros mais próximos, com rota.</p>
          </div>
          <div className="card sev-card sev-BAIXA">
            <h3>🟢 Baixa</h3>
            <p>Cuidados em casa e sinais de alerta. Se piorar, um toque aciona o hospital.</p>
          </div>
          <div className="card">
            <h3>🏥 Para hospitais</h3>
            <p>
              Painel com os chamados em tempo real, mapa, gravidade e contato.{" "}
              <Link href="/hospital">Abrir painel</Link>
            </p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>
          emergencIA é um projeto acadêmico (FMU Tech Inovação 2026.2). As orientações seguem materiais
          públicos de primeiros socorros e não substituem atendimento profissional. Emergências: SAMU 192 ·
          Bombeiros 193 · Polícia 190 · Disque-Intoxicação 0800 722 6001.
        </p>
      </footer>
    </main>
  );
}
