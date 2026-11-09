import type { NextConfig } from "next";

/**
 * Configuração do Next.js.
 * - poweredByHeader desligado: não expõe a tecnologia do servidor.
 * - Cabeçalhos de segurança básicos em todas as rotas.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Geolocalização liberada apenas para a própria origem (simulador usa o GPS do navegador).
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
