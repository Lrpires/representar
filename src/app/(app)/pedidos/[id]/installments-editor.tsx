"use client";

import { Icon } from "@/components/icons";
import { useNumberFormat } from "@/components/number-format";
import { formatDate } from "@/lib/format";

export type InstRow = { number: string; due: string; value: string };

// Parcelas (duplicatas) da nota: vencimento e valor de cada uma.
// Os campos se chamam inst_number / inst_due / inst_value (um de cada por parcela, na ordem).
export function InstallmentsEditor({
  rows,
  onChange,
  noteValue,
  termsLabel,
  onRegenerate,
  auto,
}: {
  rows: InstRow[];
  onChange: (rows: InstRow[]) => void;
  noteValue: number;
  termsLabel?: string | null;
  onRegenerate?: () => void;
  auto?: boolean;
}) {
  const { brl, num, priceText } = useNumberFormat();
  const sum = rows.reduce((s, r) => s + num(r.value), 0);
  const diff = Math.round((sum - noteValue) * 100) / 100;
  const set = (i: number, patch: Partial<InstRow>) => onChange(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const field =
    "h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-sm outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/25 sm:h-8";

  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-2">Parcelas (vencimentos)</p>
        {onRegenerate && termsLabel ? (
          <button type="button" onClick={onRegenerate} className="text-xs font-medium text-accent-ink hover:underline">
            Gerar pelo prazo do pedido ({termsLabel})
          </button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-line">
        <ul className="divide-y divide-line">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2 px-3 py-2">
              <input
                name="inst_number"
                value={r.number}
                onChange={(e) => set(i, { number: e.target.value })}
                aria-label={`Número da parcela ${i + 1}`}
                className={`${field} text-center font-mono text-xs`}
              />
              <input
                name="inst_due"
                type="date"
                value={r.due}
                onChange={(e) => set(i, { due: e.target.value })}
                aria-label={`Vencimento da parcela ${i + 1}`}
                className={field}
              />
              <input
                name="inst_value"
                inputMode="decimal"
                value={r.value}
                onChange={(e) => set(i, { value: e.target.value })}
                aria-label={`Valor da parcela ${i + 1}`}
                className={`${field} text-right tabular-nums`}
              />
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, n) => n !== i))}
                className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-alert-soft hover:text-alert"
                aria-label={`Tirar a parcela ${i + 1}`}
              >
                <Icon name="x" size={13} />
              </button>
            </li>
          ))}
          {rows.length === 0 ? <li className="px-3 py-3 text-[13px] text-muted">Sem parcelas: a nota vence de uma vez.</li> : null}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-subtle px-3 py-2 text-[13px]">
          <button
            type="button"
            onClick={() =>
              onChange([
                ...rows,
                {
                  number: String(rows.length + 1).padStart(3, "0"),
                  due: rows.at(-1)?.due ?? "",
                  value: priceText(Math.max(noteValue - sum, 0)),
                },
              ])
            }
            className="inline-flex items-center gap-1 font-medium text-ink-2 hover:text-ink"
          >
            <Icon name="plus" size={13} strokeWidth={2} />
            Adicionar parcela
          </button>
          <span className={`tabular-nums ${rows.length && Math.abs(diff) > 0.009 ? "text-warn" : "text-muted"}`}>
            Soma {brl(sum)}
            {rows.length && Math.abs(diff) > 0.009 ? ` · ${diff > 0 ? "passa" : "falta"} ${brl(Math.abs(diff))} da nota` : ""}
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {auto && rows.length
          ? `Calculadas pelo prazo do pedido, a partir de ${formatDate(rows[0].due)}. Ajuste se a nota tiver vencimentos diferentes. `
          : ""}
        Se a representada paga na liquidez, cada parcela gera a sua comissão, conforme o vencimento.
      </p>
    </div>
  );
}
