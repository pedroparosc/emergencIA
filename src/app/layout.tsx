import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "emergencIA — primeiros socorros no WhatsApp", template: "%s · emergencIA" },
  description:
    "Chatbot de WhatsApp que orienta primeiros socorros em acidentes de trânsito e domésticos e aciona o hospital mais próximo com a sua localização.",
  applicationName: "emergencIA",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c8102e" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

/** Layout raiz: barra superior com navegação comum a todas as páginas. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="topbar">
          <div className="container">
            <Link href="/" className="brand" aria-label="emergencIA — início">
              <span aria-hidden>🚑</span>
              <span>
                emergenc<b>IA</b>
              </span>
            </Link>
            <nav className="nav" aria-label="Principal">
              <Link href="/simulador">Simulador</Link>
              <Link href="/hospital">Hospital</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
