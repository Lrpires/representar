import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Permite enviar o PDF/XML da nota fiscal pelo formulário (até 12 MB).
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
