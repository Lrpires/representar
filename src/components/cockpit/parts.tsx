import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "../icons";

const pct = (d: number) => `${d > 0 ? "+" : ""}${Math.round(d * 100)}%`;

// Indicador com comparação ao período anterior.
export function Kpi({
  label,
  value,
  sub,
  delta,
  icon,
  href,
  upIsGood = true,
  big,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  delta?: number | null;
  icon: IconName;
  href?: string;
  upIsGood?: boolean;
  big?: boolean;
}) {
  const good = delta == null || delta === 0 ? null : (delta > 0) === upIsGood;
  const body = (
    <>
      <dt className="flex items-center gap-1.5 text-[13px] text-muted">
        <Icon name={icon} size={14} className="text-faint" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className={`mt-2 truncate font-semibold tracking-[-0.02em] text-ink ${big ? "text-[1.75rem] sm:text-[2rem]" : "text-xl sm:text-2xl"}`}>
        {value}
      </dd>
      <dd className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        {delta != null ? (
          <span
            className={`inline-flex items-center gap-0.5 rounded px-1 font-medium tabular-nums ${
              good == null ? "bg-hover text-muted" : good ? "bg-ok-soft text-ok" : "bg-alert-soft text-alert"
            }`}
          >
            {delta === 0 ? "=" : delta > 0 ? "▲" : "▼"} {delta === 0 ? "0%" : pct(delta)}
          </span>
        ) : (
          <span className="text-faint">sem comparação</span>
        )}
        {sub ? <span className="truncate text-muted">{sub}</span> : null}
      </dd>
    </>
  );
  return href ? (
    <Link href={href} className="block min-w-0 bg-white p-4 transition-colors hover:bg-subtle sm:p-5">
      {body}
    </Link>
  ) : (
    <div className="min-w-0 bg-white p-4 sm:p-5">{body}</div>
  );
}

// Lista ranqueada com barra de participação. Cada linha pode filtrar o painel ou abrir a ficha.
export function RankList({
  title,
  rows,
  empty,
  more,
}: {
  title: string;
  rows: { key: string; name: string; value: string; share: number; sub?: string; href?: string; active?: boolean }[];
  empty: string;
  more?: { href: string; label: string };
}) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-white">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {more ? (
          <Link href={more.href} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            {more.label}
            <Icon name="arrow-right" size={12} />
          </Link>
        ) : null}
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-muted">{empty}</p>
      ) : (
        <ol className="grid min-w-0 grid-cols-1 gap-0.5 p-1.5">
          {rows.map((r, i) => {
            const inner = (
              <>
                <span className="flex items-baseline gap-2">
                  <span className="w-4 shrink-0 text-right text-xs tabular-nums text-faint">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{r.name}</span>
                  <span className="shrink-0 text-[13px] tabular-nums text-ink">{r.value}</span>
                </span>
                <span className="mt-1.5 flex items-center gap-2 pl-6">
                  <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-active">
                    <span className="block h-full rounded-full bg-pen" style={{ width: `${Math.max(r.share * 100, 1.5)}%` }} />
                  </span>
                  <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted">{Math.round(r.share * 100)}%</span>
                </span>
                {r.sub ? <span className="block truncate pl-6 text-[11px] text-muted">{r.sub}</span> : null}
              </>
            );
            return (
              <li key={r.key} className="min-w-0">
                {r.href ? (
                  <Link
                    href={r.href}
                    scroll={false}
                    className={`block rounded-lg px-2.5 py-2 transition-colors hover:bg-hover ${r.active ? "bg-pen-soft" : ""}`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="px-2.5 py-2">{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
