"use client";

import { useEffect, useState } from "react";

// Tema do sistema: Claro (padrão), Escuro ou Automático (segue o celular/computador).
// A escolha fica guardada neste aparelho.
export type AppTheme = "claro" | "escuro" | "auto";
const KEY = "representar-tema-app";

// Roda antes de desenhar a página, para não piscar no tema errado.
export const appThemeScript = `try{var t=localStorage.getItem("${KEY}")||"claro";var d=t==="escuro"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.dataset.theme="noite";else delete document.documentElement.dataset.theme}catch(e){}`;

function apply(theme: AppTheme) {
  const dark = theme === "escuro" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.dataset.theme = "noite";
  else delete document.documentElement.dataset.theme;
}

function read(): AppTheme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "escuro" || t === "auto" ? t : "claro";
  } catch {
    return "claro";
  }
}

const OPTIONS: { value: AppTheme; label: string }[] = [
  { value: "claro", label: "Claro" },
  { value: "escuro", label: "Escuro" },
  { value: "auto", label: "Automático" },
];

export function ThemeSwitch({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<AppTheme>("claro");

  useEffect(() => setTheme(read()), []);

  // No automático, acompanha a troca do aparelho (ex.: celular que escurece à noite).
  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("auto");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);

  const choose = (t: AppTheme) => {
    setTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
    apply(t);
  };

  return (
    <div className={className}>
      <p className="mb-1.5 text-xs text-muted">Tema</p>
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-lg bg-subtle p-1">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={theme === o.value}
            onClick={() => choose(o.value)}
            className={`h-8 rounded-md text-[12.5px] font-medium transition-colors ${
              theme === o.value ? "bg-surface text-ink shadow-panel" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
