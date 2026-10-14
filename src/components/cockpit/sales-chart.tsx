"use client";

import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/cockpit";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// Eixo: valores redondos e curtos (R$ 12 mil, R$ 1,5 mi).
const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : n >= 1000
      ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
      : n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

const PREV = "#b6c2c8"; // período anterior: cinza de apoio (validado contra a cor principal)

export function SalesChart({ points, unit, compareLabel }: { points: Point[]; unit: string; compareLabel: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const H = 220;
  const pad = { l: 52, r: 8, t: 12, b: 26 };
  const iw = w - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(...points.map((p) => Math.max(p.current, p.previous)), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const slot = iw / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(24, slot * 0.62));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const x = (i: number) => pad.l + slot * i + slot / 2;
  const every = Math.max(1, Math.ceil(points.length / Math.floor(iw / 34)));
  const prevPath = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.previous).toFixed(1)}`).join(" ");
  const hasPrev = points.some((p) => p.previous > 0);
  const h = hover != null ? points[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-pen" />
          Período atual
        </span>
        {hasPrev ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: PREV }} />
            Período anterior
          </span>
        ) : null}
        <button type="button" onClick={() => setTable((t) => !t)} className="ml-auto font-medium text-muted hover:text-ink">
          {table ? "Ver gráfico" : "Ver em tabela"}
        </button>
      </div>

      {table ? (
        <div className="max-h-[220px] overflow-auto rounded-lg border border-line">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-subtle text-xs text-muted">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">{unit === "dia" ? "Dia" : unit === "semana" ? "Semana" : "Mês"}</th>
                <th className="px-3 py-1.5 text-right font-medium">Vendido</th>
                <th className="px-3 py-1.5 text-right font-medium">Anterior</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1.5">{p.tip}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{brl(p.current)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted">{brl(p.previous)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
          <svg width={w} height={H} role="img" aria-label={`Vendas por ${unit}`} className="block">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
                <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                  {compact(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const top = y(p.current);
              const hgt = pad.t + ih - top;
              const r = Math.min(4, barW / 2, hgt);
              const x0 = x(i) - barW / 2;
              return (
                <g key={i}>
                  {p.current > 0 ? (
                    <path
                      d={`M${x0},${pad.t + ih} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${pad.t + ih} Z`}
                      fill="var(--color-pen)"
                      opacity={hover == null || hover === i ? 1 : 0.45}
                    />
                  ) : null}
                  {i % every === 0 ? (
                    <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
                      {p.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {hasPrev ? <path d={prevPath} fill="none" stroke={PREV} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
            {hover != null && hasPrev ? (
              <circle cx={x(hover)} cy={y(points[hover].previous)} r={4} fill={PREV} stroke="#fff" strokeWidth={2} />
            ) : null}
            {/* Área de toque de cada coluna (maior que a barra) */}
            {points.map((p, i) => (
              <rect
                key={i}
                x={pad.l + slot * i}
                y={pad.t}
                width={slot}
                height={ih}
                fill="transparent"
                tabIndex={0}
                aria-label={`${p.tip}: ${brl(p.current)}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onTouchStart={() => setHover(i)}
                className="cursor-default outline-none"
              />
            ))}
          </svg>
          {h && hover != null ? (
            <div
              className="pointer-events-none absolute z-10 min-w-[10rem] rounded-lg bg-white px-3 py-2 text-xs shadow-menu"
              style={{
                left: Math.min(Math.max(x(hover) - 80, 0), w - 170),
                top: Math.max(y(Math.max(h.current, h.previous)) - 74, 0),
              }}
            >
              <p className="mb-1 text-muted">{h.tip}</p>
              <p className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-ink-2">
                  <span className="h-0.5 w-3 rounded-full bg-pen" />
                  Atual
                </span>
                <span className="font-semibold tabular-nums text-ink">{brl(h.current)}</span>
              </p>
              {hasPrev ? (
                <p className="mt-0.5 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-ink-2">
                    <span className="h-0.5 w-3 rounded-full" style={{ background: PREV }} />
                    Anterior
                  </span>
                  <span className="tabular-nums text-ink-2">{brl(h.previous)}</span>
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="sr-only">{compareLabel}</p>
        </div>
      )}
    </div>
  );
}
