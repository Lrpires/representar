import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Biblioteca que gera o PDF do pedido roda direto no Node (sem passar pelo empacotador).
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    // Permite enviar o PDF/XML da nota fiscal pelo formulário (até 12 MB).
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
