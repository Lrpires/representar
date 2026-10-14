import type { MetadataRoute } from "next";

// App instalável (PWA): no celular, "Adicionar à tela de início" abre em tela cheia.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Representar",
    short_name: "Representar",
    description: "Pedidos, clientes, comissões e contas do representante comercial.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f7",
    theme_color: "#0f4c5c",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Novo pedido", url: "/pedidos/novo", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Clientes", url: "/clientes", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
