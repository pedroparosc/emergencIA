import type { MetadataRoute } from "next";

/** Manifest PWA: permite "Adicionar à tela inicial" no celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "emergencIA — primeiros socorros",
    short_name: "emergencIA",
    description: "Primeiros socorros guiados e acionamento do hospital mais próximo.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#c8102e",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
