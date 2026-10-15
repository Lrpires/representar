import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Fontes da marca: Schibsted Grotesk (textos) e JetBrains Mono (números, códigos e etiquetas).
const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-schibsted",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Representar", template: "%s · Representar" },
  icons: { icon: "/icon.svg", apple: "/icon-180.png" },
  appleWebApp: { capable: true, title: "Representar", statusBarStyle: "default" },
  description: "Mais pedidos, menos planilha. Pedidos, faturamento, comissões e clientes do representante comercial.",
};

export const viewport: Viewport = {
  themeColor: "#f3f0e8",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
