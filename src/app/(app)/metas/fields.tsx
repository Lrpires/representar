"use client";

import { useMemo, useState } from "react";
import { METRICS, closes, type Dimension } from "@/lib/goals";
import { round2 } from "@/lib/orders";
import { Field, FormGroup, inputCls, textareaCls } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { useNumberFormat } from "@/components/number-format";

const PERIODS = [
  { value: "mes", label: "Mês" },
  { value: "trimestre", label: "Trimestre" },
  { value: "ano", label: "Ano" },
  { value: "personalizado", label: "Datas" },
] as const;

/* ---------- Meta do escritório (novo plano) ---------- */

export function OfficeGoalFields({ month }: { month: string }) {
  const [metric, setMetric] = useState<string>("vendido");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["value"]>("mes");
  const money = METRICS.find((m) => m.value === metric)?.money ?? true;

  return (
    <>
      <p className="rounded-lg bg-subtle px-3 py-2.5 text-[13px] leading-relaxed text-ink-2 sm:col-span-2">
        Esta é a <span className="font-medium text-ink">meta do escritório</span>. Depois você distribui por vendedor,
        por representada ou pelos dois, e cada distribuição precisa somar este total.
      </p>

      <FormGroup title="O que medir" />
      <div className="grid grid-cols-2 gap-2 sm:col-span-2">
        {METRICS.map((m) => (
          <label
            key={m.value}
            className={`cursor-pointer rounded-lg border p-3 transition ${
              metric === m.value ? "border-pen bg-pen-soft/60" : "border-line-strong hover:bg-subtle"
            }`}
          >
            <input type="radio" name="metric" value={m.value} checked={metric === m.value} onChange={() => setMetric(m.value)} className="sr-only" />
            <span className="block text-sm font-medium leading-tight">{m.label}</span>
            <span className="block text-xs text-muted">{m.hint}</span>
          </label>
        ))}
      </div>

      <TargetField money={money} metric={metric} label="Meta do escritório" />

      <FormGroup title="Período" />
      <div className="sm:col-span-2">
        <input type="hidden" name="period_type" value={period} />
        <div className="inline-flex gap-0.5 rounded-[0.6rem] bg-hover p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`h-9 rounded-lg px-3 text-[13px] font-medium transition sm:h-8 ${
                period === p.value ? "bg-surface text-ink shadow-panel" : "text-muted hover:text-ink-2"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === "mes" || period === "trimestre" ? (
        <>
          <Field label={period === "mes" ? "Mês" : "Primeiro mês do trimestre"}>
            <input name="month" type="month" required defaultValue={month} className={inputCls} />
          </Field>
          <Field label="Repetir" hint="Lança a mesma meta para os períodos seguintes.">
            <select name="repeat" defaultValue="1" className={inputCls}>
              <option value="1">Só este período</option>
              {(period === "mes" ? [3, 6, 12] : [2, 4]).map((n) => (
                <option key={n} value={n}>
                  Este e os próximos {n - 1} {period === "mes" ? "meses" : "trimestres"}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : period === "ano" ? (
        <Field label="Ano">
          <input name="year" inputMode="numeric" required defaultValue={month.slice(0, 4)} className={inputCls} />
        </Field>
      ) : (
        <>
          <Field label="Início">
            <input name="start" type="date" required defaultValue={`${month}-01`} className={inputCls} />
          </Field>
          <Field label="Fim">
            <input name="end" type="date" required className={inputCls} />
          </Field>
        </>
      )}

      <Field label="Observação" className="sm:col-span-2">
        <textarea name="notes" rows={2} placeholder="Ex.: campanha de verão, bônus de 1% se bater" className={textareaCls} />
      </Field>
    </>
  );
}

export function TargetField({
  money,
  metric,
  label,
  defaultValue,
}: {
  money: boolean;
  metric: string;
  label: string;
  defaultValue?: number;
}) {
  const { priceText, symbol } = useNumberFormat();
  return (
    <Field label={money ? `${label} (${symbol})` : `${label} (${metric === "pedidos" ? "pedidos" : "clientes"})`} className="sm:col-span-2">
      <span className="relative block">
        {money ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">{symbol}</span> : null}
        <input
          name="target"
          inputMode="decimal"
          required
          defaultValue={defaultValue == null ? "" : money ? priceText(defaultValue) : String(defaultValue)}
          placeholder={money ? "100.000,00" : "30"}
          className={`${inputCls} text-right text-lg font-semibold tabular-nums ${money ? "pl-10" : ""}`}
        />
      </span>
    </Field>
  );
}

/* ---------- Distribuição do total ---------- */

export type DistEntity = { id: string; name: string; photo?: string | null; round?: boolean };

export function DistributionEditor({
  dimension,
  money,
  total,
  rows,
  cols,
  initial,
  reference,
  referenceLabel,
  sellerGoals,
}: {
  dimension: Dimension;
  money: boolean;
  total: number | null;
  rows: DistEntity[]; // vendedores ou representadas
  cols: DistEntity[]; // representadas (só na distribuição vendedor × representada)
  initial: Record<string, number>; // chave "vendedor__representada"
  reference: Record<string, number>; // realizado no período anterior, mesma chave
  referenceLabel: string;
  sellerGoals: Record<string, number>; // meta de cada vendedor (para conferir a matriz)
}) {
  const { brl, num, numText, priceText, symbol } = useNumberFormat();
  const matrix = dimension === "vendedor_representada";
  const keyOf = (r: DistEntity, c?: DistEntity) =>
    dimension === "vendedor" ? `${r.id}__` : dimension === "representada" ? `__${r.id}` : `${r.id}__${c!.id}`;
  const cells = useMemo(
    () => (matrix ? rows.flatMap((r) => cols.map((c) => keyOf(r, c))) : rows.map((r) => keyOf(r))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, cols, dimension],
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(cells.map((k) => [k, initial[k] ? (money ? priceText(initial[k]) : String(initial[k])) : ""])),
  );
  const [useSum, setUseSum] = useState(total == null);

  const sum = round2(cells.reduce((s, k) => s + num(values[k]), 0));
  const target = useSum || total == null ? sum : total;
  const diff = round2(target - sum);
  const ok = closes(sum, target) && sum > 0;
  const show = (n: number) => (money ? brl(n) : numText(n, 2));
  const fmtInput = (n: number) => (money ? priceText(round2(n)) : String(Math.round(n)));

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  // Divide o total igualmente entre todos (o centavo que sobra vai para o primeiro).
  function splitEqually() {
    if (!total) return;
    const n = cells.length;
    const base = money ? Math.floor((total / n) * 100) / 100 : Math.floor(total / n);
    const rest = round2(total - base * n);
    setValues(Object.fromEntries(cells.map((k, i) => [k, fmtInput(i === 0 ? base + rest : base)])));
  }
  // Divide proporcional ao que cada um fez no período anterior.
  function splitByHistory() {
    if (!total) return;
    const ref = cells.reduce((s, k) => s + (reference[k] ?? 0), 0);
    if (!ref) return;
    let acc = 0;
    const next = cells.map((k, i) => {
      const v = i === cells.length - 1 ? total - acc : money ? Math.round(((total * (reference[k] ?? 0)) / ref) * 100) / 100 : Math.round((total * (reference[k] ?? 0)) / ref);
      acc += v;
      return [k, v ? fmtInput(v) : ""];
    });
    setValues(Object.fromEntries(next));
  }
  const hasHistory = cells.some((k) => (reference[k] ?? 0) > 0);

  const input = (k: string, label: string) => (
    <span className="relative block">
      {money ? <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">{symbol}</span> : null}
      <input
        name={`t__${k}`}
        inputMode="decimal"
        aria-label={label}
        value={values[k] ?? ""}
        onChange={(e) => set(k, e.target.value)}
        placeholder="0"
        className={`h-11 w-full rounded-md border border-line-strong bg-surface pr-2.5 text-right text-base tabular-nums outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/25 sm:h-9 sm:text-sm ${money ? "pl-8" : "pl-2.5"}`}
      />
    </span>
  );

  return (
    <>
      {/* Placar da distribuição */}
      <div className={`rounded-lg border p-3 sm:col-span-2 ${ok ? "border-ok/30 bg-ok-soft" : "border-warn-dot/40 bg-warn-soft"}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className={`text-[13px] font-medium ${ok ? "text-ok" : "text-warn"}`}>
            {ok ? "Distribuição fechada" : diff > 0 ? `Faltam ${show(diff)}` : sum > 0 ? `Passou ${show(-diff)}` : "Distribua o total"}
          </span>
          <span className="text-sm tabular-nums">
            <span className="font-semibold">{show(sum)}</span>
            <span className="text-muted"> de {show(target)}</span>
          </span>
        </div>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface/70">
          <span
            className={`block h-full rounded-full ${ok ? "bg-ok" : sum > target ? "bg-alert" : "bg-warn-dot"}`}
            style={{ width: `${target ? Math.min(sum / target, 1) * 100 : 0}%` }}
          />
        </span>
        {total != null ? (
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px] text-ink-2">
            <input type="checkbox" name="use_sum" checked={useSum} onChange={(e) => setUseSum(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              Usar a soma como meta do escritório
              <span className="block text-xs text-muted">Hoje a meta do escritório é {show(total)}. Marcando, ela passa a ser a soma daqui.</span>
            </span>
          </label>
        ) : (
          <p className="mt-2 text-xs text-muted">Ainda não há meta do escritório: ela será a soma desta distribuição.</p>
        )}
      </div>

      {total ? (
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="button" onClick={splitEqually} className="rounded-md px-2 py-1 text-[13px] font-medium text-pen hover:bg-pen-soft">
            Dividir igualmente
          </button>
          {hasHistory ? (
            <button type="button" onClick={splitByHistory} className="rounded-md px-2 py-1 text-[13px] font-medium text-pen hover:bg-pen-soft">
              Dividir pelo {referenceLabel.toLowerCase()}
            </button>
          ) : null}
        </div>
      ) : null}

      {!matrix ? (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line sm:col-span-2">
          {rows.map((r) => {
            const k = keyOf(r);
            const share = target ? num(values[k]) / target : 0;
            return (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={r.name} size={30} round={r.round} src={r.photo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted">
                    {referenceLabel}: {show(reference[k] ?? 0)}
                    {share ? ` · ${Math.round(share * 100)}% do total` : ""}
                  </p>
                </div>
                <span className="w-32 shrink-0 sm:w-36">{input(k, `Meta de ${r.name}`)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line sm:col-span-2">
          <table className="w-full min-w-max text-sm">
            <thead className="border-b border-line bg-subtle text-xs text-muted">
              <tr>
                <th className="sticky left-0 bg-subtle px-3 py-2 text-left font-medium">Vendedor</th>
                {cols.map((c) => (
                  <th key={c.id} className="min-w-[8.5rem] px-2 py-2 text-left font-medium">
                    {c.name}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Soma</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rowSum = round2(cols.reduce((s, c) => s + num(values[keyOf(r, c)]), 0));
                const sg = sellerGoals[r.id];
                const mismatch = sg != null && rowSum > 0 && !closes(rowSum, sg);
                return (
                  <tr key={r.id} className="border-b border-line last:border-b-0">
                    <td className="sticky left-0 bg-surface px-3 py-2">
                      <span className="block max-w-[9rem] truncate font-medium">{r.name}</span>
                      {sg != null ? <span className="block text-[11px] text-muted">Meta dele: {show(sg)}</span> : null}
                    </td>
                    {cols.map((c) => (
                      <td key={c.id} className="px-2 py-2">
                        {input(keyOf(r, c), `Meta de ${r.name} em ${c.name}`)}
                      </td>
                    ))}
                    <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${mismatch ? "font-medium text-warn" : ""}`} title={mismatch ? "Diferente da meta do vendedor" : undefined}>
                      {show(rowSum)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {matrix && Object.keys(sellerGoals).length ? (
        <p className="text-xs text-muted sm:col-span-2">
          Em âmbar: a soma do vendedor nas representadas é diferente da meta individual dele.
        </p>
      ) : null}
    </>
  );
}
