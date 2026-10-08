import type { MetadataRoute } from "next";

// Para o app ser instalável, adicione ícones PNG de 192x192 e 512x512 em /public
// e liste-os em "icons" abaixo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Representantes",
    short_name: "Representantes",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#0b0b0f",
    lang: "pt-BR",
  };
}
