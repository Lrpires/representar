"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { PERIOD_OPTIONS } from "@/lib/cockpit";
import { Icon } from "../icons";

type Opt = { value: string; label: string };

// Filtros do Painel numa linha só; tudo abaixo responde a eles.
// Enquanto recarrega, o conteúdo fica levemente apagado (sem piscar nem pular).
export function CockpitShell({
  principals,
  sellers,
  periodLabel,
  compareLabel,
  children,
}: {
  principals: Opt[];
  sellers: Opt[] | null;
  periodLabel: string;
  compareLabel: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const period = params.get("periodo") ?? "mes";
  const [de, setDe] = useState(params.get("de") ?? "");
  const [ate, setAte] = useState(params.get("ate") ?? "");

  function apply(patch: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const qs = sp.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const active = (params.get("rep") ? 1 : 0) + (params.get("vend") ? 1 : 0);
  const select =
    "h-10 min-w-0 rounded-lg border bg-white pl-3 text-sm shadow-field outline-none transition focus:border-pen focus:ring-[3px] focus:ring-pen/15 sm:h-8 sm:text-[13px]";

  return (
    <>
      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-line bg-white/92 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <div className="-mx-1 flex max-w-full gap-0.5 overflow-x-auto rounded-[0.6rem] bg-hover p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PERIOD_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => apply({ periodo: o.value === "mes" ? null : o.value, ...(o.value !== "datas" ? { de: null, ate: null } : {}) })}
                aria-pressed={period === o.value}
                className={`h-9 shrink-0 rounded-lg px-2.5 text-[13px] font-medium transition sm:h-7 ${
                  period === o.value ? "bg-white text-ink shadow-panel" : "text-muted hover:text-ink-2"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {period === "datas" ? (
            <div className="flex items-center gap-1.5">
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} aria-label="De" className={`${select} border-line-strong pr-2`} />
              <span className="text-xs text-muted">a</span>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Até" className={`${select} border-line-strong pr-2`} />
              <button
                type="button"
                disabled={!de || !ate || de > ate}
                onClick={() => apply({ periodo: "datas", de, ate })}
                className="h-10 rounded-lg bg-pen px-3 text-[13px] font-medium text-white disabled:opacity-40 sm:h-8"
              >
                Aplicar
              </button>
            </div>
          ) : null}

          <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
            <select
              aria-label="Representada"
              value={params.get("rep") ?? ""}
              onChange={(e) => apply({ rep: e.target.value || null })}
              className={`${select} ${params.get("rep") ? "border-pen/50 font-medium text-pen-ink" : "border-line-strong text-ink-2"}`}
            >
              <option value="">Todas as representadas</option>
              {principals.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {sellers ? (
              <select
                aria-label="Vendedor"
                value={params.get("vend") ?? ""}
                onChange={(e) => apply({ vend: e.target.value || null })}
                className={`${select} ${params.get("vend") ? "border-pen/50 font-medium text-pen-ink" : "border-line-strong text-ink-2"}`}
              >
                <option value="">Todos os vendedores</option>
                {sellers.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 font-medium text-ink-2">
            <Icon name="calendar" size={13} className="text-faint" />
            {periodLabel}
          </span>
          <span>{compareLabel}</span>
          {active ? (
            <button type="button" onClick={() => apply({ rep: null, vend: null })} className="inline-flex items-center gap-1 font-medium text-pen hover:underline">
              <Icon name="x" size={12} />
              Limpar filtros ({active})
            </button>
          ) : null}
          {pending ? <span className="ml-auto inline-flex items-center gap-1.5"><span className="h-3 w-3 animate-spin rounded-full border-2 border-pen border-r-transparent" />Atualizando…</span> : null}
        </div>
      </div>
      <div className={`transition-opacity duration-200 ${pending ? "pointer-events-none opacity-55" : ""}`}>{children}</div>
    </>
  );
}
