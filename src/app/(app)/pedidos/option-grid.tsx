"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useNumberFormat } from "@/components/number-format";
import { ghostBtn, iconBtn, primaryBtn } from "@/components/ui";
import { adjustText, priceWithOptions, type OptionList, type OptionValue } from "@/lib/options";

export type GridLine = { options: Record<string, string>; qty: string; price: string };

const cellCls =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-right text-sm tabular-nums outline-none placeholder:text-faint focus:border-accent focus:ring-[3px] focus:ring-accent/25 sm:h-9";

// Grade do produto no pedido: quantidade por opção (ex.: por cor) ou por cor × tamanho.
// O preço de cada linha vem sugerido (último preço do cliente naquela opção, ou o preço base com o acréscimo
// da opção) e pode ser alterado. Ao confirmar, cada opção com quantidade vira uma linha do pedido.
export function OptionGrid({
  productName,
  lists,
  suggest,
  basePrice,
  onConfirm,
  onClose,
}: {
  productName: string;
  lists: OptionList[];
  suggest: (options: Record<string, string>) => number | null; // último preço do cliente nessa combinação
  basePrice: number | null; // preço base (tabela ou último preço do cliente numa opção sem acréscimo)
  onConfirm: (lines: GridLine[]) => void;
  onClose: () => void;
}) {
  const { brl, num, priceText, numText } = useNumberFormat();
  const [rowsList, colsList] = lists;
  const cols: (OptionValue | null)[] = colsList ? colsList.values : [null];

  const optsOf = (r: OptionValue, c: OptionValue | null) => ({
    [rowsList.kind]: r.name,
    ...(c && colsList ? { [colsList.kind]: c.name } : {}),
  });

  // Preço sugerido por linha (opção da 1ª lista); na grade cor × tamanho, o tamanho soma o acréscimo dele.
  const [base, setBase] = useState(basePrice != null ? priceText(basePrice) : "");
  const [rowPrice, setRowPrice] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const r of rowsList.values) {
      const exact = suggest({ [rowsList.kind]: r.name });
      out[r.id] = exact != null ? priceText(exact) : basePrice != null ? priceText(priceWithOptions(basePrice, [r])) : "";
    }
    return out;
  });
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState<Record<string, string>>({});
  const key = (r: OptionValue, c: OptionValue | null) => `${r.id}:${c?.id ?? "-"}`;

  // Mudou o preço base: atualiza as linhas que a pessoa não mexeu à mão.
  function changeBase(v: string) {
    setBase(v);
    const b = num(v);
    setRowPrice((prev) => {
      const next = { ...prev };
      for (const r of rowsList.values) {
        if (touched.has(r.id)) continue;
        next[r.id] = v.trim() ? priceText(priceWithOptions(b, [r])) : "";
      }
      return next;
    });
  }

  const cellPrice = (r: OptionValue, c: OptionValue | null) => {
    const rp = rowPrice[r.id];
    if (!rp?.trim()) return null;
    if (!c) return num(rp);
    const exact = suggest(optsOf(r, c));
    return exact ?? priceWithOptions(num(rp), [c]);
  };

  const totals = useMemo(() => {
    let q = 0;
    let v = 0;
    for (const r of rowsList.values)
      for (const c of cols) {
        const n = num(qty[key(r, c)] ?? "");
        if (n > 0) {
          q += n;
          v += n * (cellPrice(r, c) ?? 0);
        }
      }
    return { q, v };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qty, rowPrice]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  function confirm() {
    const lines: GridLine[] = [];
    for (const r of rowsList.values)
      for (const c of cols) {
        const n = num(qty[key(r, c)] ?? "");
        if (n <= 0) continue;
        const p = cellPrice(r, c);
        lines.push({ options: optsOf(r, c), qty: qty[key(r, c)], price: p == null ? "" : priceText(p) });
      }
    onConfirm(lines);
  }

  const adj = (v: OptionValue) => adjustText(v, brl);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Grade de ${productName}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-float sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{productName}</h2>
            <p className="mt-0.5 text-[13px] text-muted">
              Digite a quantidade {colsList ? `por ${rowsList.kind.toLowerCase()} e ${colsList.kind.toLowerCase()}` : `por ${rowsList.kind.toLowerCase()}`}.
              Cada uma vira uma linha do pedido.
            </p>
          </div>
          <button type="button" onClick={onClose} className={`${iconBtn} -mr-2`} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-subtle px-5 py-3 text-[13px]">
          <label className="flex items-center gap-2">
            <span className="whitespace-nowrap text-muted">Preço base</span>
            <input
              inputMode="decimal"
              value={base}
              onChange={(e) => changeBase(e.target.value)}
              placeholder="0,00"
              className={`${cellCls} w-28`}
            />
          </label>
          <span className="text-xs text-muted">
            Muda o preço das {rowsList.kind === "Cor" ? "cores" : "opções"} que você não alterou, já com o acréscimo de cada uma.
          </span>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface text-xs text-muted shadow-[0_1px_0_var(--color-line)]">
              <tr>
                <th className="py-2 pl-5 pr-2 text-left font-medium">{rowsList.kind}</th>
                <th className="w-32 px-2 py-2 text-right font-medium">Preço</th>
                {cols.map((c) => (
                  <th key={c?.id ?? "qty"} className={`px-1.5 py-2 text-center font-medium ${c ? "min-w-[4.5rem]" : "w-28"}`}>
                    {c ? (
                      <>
                        {c.name}
                        {adj(c) ? <span className="block text-[10px] font-normal text-faint">{adj(c)}</span> : null}
                      </>
                    ) : (
                      "Qtd."
                    )}
                  </th>
                ))}
                {colsList ? <th className="w-16 pr-5 text-right font-medium">Total</th> : <th className="w-2 pr-3" />}
              </tr>
            </thead>
            <tbody>
              {rowsList.values.map((r) => {
                const rowQty = cols.reduce((s, c) => s + num(qty[key(r, c)] ?? ""), 0);
                return (
                  <tr key={r.id} className={`border-b border-line last:border-b-0 ${rowQty > 0 ? "bg-accent-soft/40" : ""}`}>
                    <td className="py-1.5 pl-5 pr-2">
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 font-mono text-[11px] text-faint">{r.code}</span>
                      {adj(r) ? <span className="ml-2 text-[11px] text-muted">{adj(r)}</span> : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        inputMode="decimal"
                        value={rowPrice[r.id] ?? ""}
                        onChange={(e) => {
                          setRowPrice((p) => ({ ...p, [r.id]: e.target.value }));
                          setTouched((t) => new Set(t).add(r.id));
                        }}
                        placeholder="0,00"
                        aria-label={`Preço de ${r.name}`}
                        className={cellCls}
                      />
                    </td>
                    {cols.map((c) => (
                      <td key={c?.id ?? "qty"} className="px-1.5 py-1.5">
                        <input
                          inputMode="decimal"
                          value={qty[key(r, c)] ?? ""}
                          onChange={(e) => setQty((q) => ({ ...q, [key(r, c)]: e.target.value }))}
                          aria-label={`Quantidade de ${r.name}${c ? ` ${c.name}` : ""}`}
                          className={`${cellCls} text-center`}
                        />
                      </td>
                    ))}
                    {colsList ? (
                      <td className="pr-5 text-right tabular-nums text-muted">{rowQty ? numText(rowQty, 3) : ""}</td>
                    ) : (
                      <td />
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-line bg-subtle px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <span className="text-[13px] text-muted">
            <span className="font-semibold tabular-nums text-ink">{numText(totals.q, 3) || "0"}</span> un. ·{" "}
            <span className="font-semibold tabular-nums text-ink">{brl(totals.v)}</span>
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className={ghostBtn}>
              Cancelar
            </button>
            <button type="button" onClick={confirm} disabled={totals.q <= 0} className={primaryBtn}>
              Adicionar ao pedido
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
