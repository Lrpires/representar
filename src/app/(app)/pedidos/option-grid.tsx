"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { useNumberFormat } from "@/components/number-format";
import { ghostBtn, iconBtn, inputCls, primaryBtn } from "@/components/ui";
import { adjustText, priceWithOptions, type OptionList, type OptionValue } from "@/lib/options";

export type GridLine = { options: Record<string, string>; qty: string; price: string };

const cellCls =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-right text-sm tabular-nums outline-none placeholder:text-faint focus:border-accent focus:ring-[3px] focus:ring-accent/25 sm:h-9";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Grade do produto no pedido. As cores (ou outra opção) entram uma a uma pela busca, por código ou nome,
// porque uma cartela pode ter mais de 100 cores. Dá para cruzar com outra lista (ex.: tamanho), que vira colunas.
// O preço de cada linha vem sugerido (último preço do cliente naquela opção, ou o preço base com o acréscimo
// da opção) e pode ser alterado. Ao confirmar, cada opção com quantidade vira uma linha do pedido.
export function OptionGrid({
  available,
  initial,
  prefill,
  ...rest
}: {
  available: OptionList[]; // listas da representada (as ligadas ao produto vêm primeiro)
  initial: OptionList[]; // as que já abrem escolhidas
  prefill?: GridLine | null; // linha do pedido que está sendo trocada
  productName: string;
  suggest: (options: Record<string, string>) => number | null;
  basePrice: number | null;
  onConfirm: (lines: GridLine[]) => void;
  onPlain: () => void;
  onClose: () => void;
}) {
  // Reabrindo uma linha: começa na lista que tem a opção dela.
  const fromPrefill = prefill ? available.filter((l) => prefill.options[l.kind]) : [];
  const start = fromPrefill.length ? fromPrefill : initial;
  const [rowsId, setRowsId] = useState(start[0]?.id ?? available[0]?.id ?? "");
  const [colsId, setColsId] = useState(start[1]?.id ?? "");
  const rows = available.find((l) => l.id === rowsId) ?? available[0];
  const cols = available.find((l) => l.id === colsId && l.id !== rows?.id);
  const sel = "h-9 min-w-0 rounded-md border border-line-strong bg-surface px-2 text-[13px] outline-none focus:border-accent";
  const chooser =
    available.length > 1 ? (
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-[13px]">
        <span className="text-muted">Lista</span>
        <select value={rows?.id} onChange={(e) => setRowsId(e.target.value)} className={sel} aria-label="Lista">
          {available.map((l) => (
            <option key={l.id} value={l.id}>
              {l.kind}: {l.name}
            </option>
          ))}
        </select>
        <span className="ml-2 text-muted">Cruzar com</span>
        <select value={cols?.id ?? ""} onChange={(e) => setColsId(e.target.value)} className={sel} aria-label="Cruzar com">
          <option value="">Nada (só quantidade)</option>
          {available
            .filter((l) => l.id !== rows?.id)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.kind}: {l.name}
              </option>
            ))}
        </select>
      </div>
    ) : null;
  if (!rows) return null;
  return (
    <GridTable
      key={`${rows.id}:${cols?.id ?? ""}`}
      {...rest}
      lists={cols ? [rows, cols] : [rows]}
      prefill={prefill}
      chooser={chooser}
    />
  );
}

function GridTable({
  productName,
  lists,
  prefill,
  suggest,
  basePrice,
  onConfirm,
  onPlain,
  onClose,
  chooser,
}: {
  productName: string;
  lists: OptionList[];
  prefill?: GridLine | null;
  suggest: (options: Record<string, string>) => number | null;
  basePrice: number | null;
  onConfirm: (lines: GridLine[]) => void;
  onPlain: () => void;
  onClose: () => void;
  chooser: ReactNode;
}) {
  const { brl, num, priceText, numText, qtyText } = useNumberFormat();
  const [rowsList, colsList] = lists;
  const cols: (OptionValue | null)[] = colsList ? colsList.values : [null];
  const key = (r: OptionValue, c: OptionValue | null) => `${r.id}:${c?.id ?? "-"}`;
  const optsOf = (r: OptionValue, c: OptionValue | null) => ({
    [rowsList.kind]: r.name,
    ...(c && colsList ? { [colsList.kind]: c.name } : {}),
  });
  const suggestedRowPrice = (r: OptionValue, b: number | null) => {
    const exact = suggest({ [rowsList.kind]: r.name });
    return exact != null ? priceText(exact) : b != null ? priceText(priceWithOptions(b, [r])) : "";
  };

  // Linha que está sendo trocada: já entra com a opção, a quantidade e o preço dela.
  const pre = prefill ? rowsList.values.find((v) => v.name === prefill.options[rowsList.kind]) : undefined;
  const preCol = prefill && colsList ? colsList.values.find((v) => v.name === prefill.options[colsList.kind]) ?? null : null;

  const [picked, setPicked] = useState<OptionValue[]>(pre ? [pre] : []);
  const [base, setBase] = useState(basePrice != null ? priceText(basePrice) : "");
  const [rowPrice, setRowPrice] = useState<Record<string, string>>(() =>
    pre ? { [pre.id]: prefill!.price || suggestedRowPrice(pre, basePrice) } : {},
  );
  const [touched, setTouched] = useState<Set<string>>(() => new Set(pre && prefill?.price ? [pre.id] : []));
  const [qty, setQty] = useState<Record<string, string>>(() =>
    pre && (!colsList || preCol) ? { [key(pre, preCol)]: prefill!.qty } : {},
  );

  // Busca por código ou nome.
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  // Opção que acabou de entrar: o cursor vai para a quantidade dela depois que a linha aparece na tela.
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId) return;
    document.querySelector<HTMLInputElement>(`[data-qty="${focusId}"]`)?.focus();
    setFocusId(null);
  }, [focusId, picked]);
  const pickedIds = new Set(picked.map((v) => v.id));
  const matches = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    const starts: OptionValue[] = [];
    const contains: OptionValue[] = [];
    for (const v of rowsList.values) {
      if (pickedIds.has(v.id)) continue;
      const code = norm(v.code ?? "");
      const name = norm(v.name);
      if (code === t || code.startsWith(t) || name.startsWith(t)) starts.push(v);
      else if (name.includes(t) || code.includes(t)) contains.push(v);
    }
    return [...starts, ...contains].slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, picked, rowsList]);

  function add(v: OptionValue) {
    setPicked((p) => [...p, v]);
    setRowPrice((p) => (v.id in p ? p : { ...p, [v.id]: suggestedRowPrice(v, base.trim() ? num(base) : null) }));
    setQ("");
    setHi(0);
    setFocusId(v.id);
  }
  function remove(v: OptionValue) {
    setPicked((p) => p.filter((x) => x.id !== v.id));
    setQty((q0) => Object.fromEntries(Object.entries(q0).filter(([k]) => !k.startsWith(`${v.id}:`))));
  }

  // Mudou o preço base: atualiza as linhas que a pessoa não mexeu à mão.
  function changeBase(v: string) {
    setBase(v);
    const b = num(v);
    setRowPrice((prev) => {
      const next = { ...prev };
      for (const r of picked) {
        if (touched.has(r.id) || suggest({ [rowsList.kind]: r.name }) != null) continue;
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

  let totalQty = 0;
  let totalValue = 0;
  for (const r of picked)
    for (const c of cols) {
      const n = num(qty[key(r, c)] ?? "");
      if (n > 0) {
        totalQty += n;
        totalValue += n * (cellPrice(r, c) ?? 0);
      }
    }

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  useEffect(() => {
    if (!pre) search.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function confirm() {
    const lines: GridLine[] = [];
    for (const r of picked)
      for (const c of cols) {
        const n = num(qty[key(r, c)] ?? "");
        if (n <= 0) continue;
        const p = cellPrice(r, c);
        lines.push({ options: optsOf(r, c), qty: qty[key(r, c)], price: p == null ? "" : priceText(p) });
      }
    onConfirm(lines);
  }

  const adj = (v: OptionValue) => adjustText(v, brl);
  const kindLower = rowsList.kind.toLowerCase();

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
              Busque {kindLower === "cor" ? "a cor" : `o ${kindLower}`} pelo código ou nome e digite a quantidade. Cada uma vira
              uma linha do pedido.
            </p>
          </div>
          <button type="button" onClick={onClose} className={`${iconBtn} -mr-2`} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </header>

        {chooser}

        <div className="grid gap-3 border-b border-line bg-subtle px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              ref={search}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHi(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHi((h) => Math.min(h + 1, matches.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHi((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (matches[hi]) add(matches[hi]);
                }
              }}
              placeholder={`Adicionar ${kindLower}: código ou nome (${rowsList.values.length} na lista)`}
              aria-label={`Buscar ${kindLower}`}
              role="combobox"
              aria-expanded={matches.length > 0}
              className={`${inputCls} pl-9`}
            />
            {matches.length ? (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-float">
                {matches.map((v, i) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHi(i)}
                      onClick={() => add(v)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === hi ? "bg-hover" : ""}`}
                    >
                      <span className="w-14 shrink-0 font-mono text-xs text-muted">{v.code}</span>
                      <span className="min-w-0 flex-1 truncate">{v.name}</span>
                      {adj(v) ? <span className="text-xs text-muted">{adj(v)}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : q.trim() ? (
              <p className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-muted shadow-float">
                Nada com &quot;{q.trim()}&quot; nesta lista.
              </p>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="whitespace-nowrap text-muted">Preço base</span>
            <input
              inputMode="decimal"
              value={base}
              onChange={(e) => changeBase(e.target.value)}
              placeholder="0,00"
              title="Preço sem acréscimo. Vale para as opções que o cliente nunca comprou e que você não alterou."
              className={`${cellCls} w-28`}
            />
          </label>
        </div>

        <div className="scroll-thin min-h-[8rem] flex-1 overflow-auto">
          {picked.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              Nenhuma {kindLower === "cor" ? "cor" : "opção"} ainda. Use a busca acima: digite o código ou parte do nome e tecle
              Enter.
            </p>
          ) : (
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
                  <th className="w-10 pr-3" />
                </tr>
              </thead>
              <tbody>
                {picked.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-b-0">
                    <td className="py-1.5 pl-5 pr-2">
                      <span className="font-mono text-[11px] text-faint">{r.code}</span>
                      <span className={`font-medium ${r.code ? "ml-2" : ""}`}>{r.name}</span>
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
                    {cols.map((c, ci) => (
                      <td key={c?.id ?? "qty"} className="px-1.5 py-1.5">
                        <input
                          inputMode="decimal"
                          data-qty={ci === 0 ? r.id : undefined}
                          value={qty[key(r, c)] ?? ""}
                          onChange={(e) => setQty((q0) => ({ ...q0, [key(r, c)]: e.target.value }))}
                          onKeyDown={(e) => {
                            // Enter na quantidade volta para a busca, para lançar a próxima cor.
                            if (e.key === "Enter") {
                              e.preventDefault();
                              search.current?.focus();
                            }
                          }}
                          aria-label={`Quantidade de ${r.name}${c ? ` ${c.name}` : ""}`}
                          className={`${cellCls} text-center`}
                        />
                      </td>
                    ))}
                    <td className="pr-3 text-right">
                      <button type="button" onClick={() => remove(r)} className={iconBtn} aria-label={`Tirar ${r.name}`}>
                        <Icon name="x" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-line bg-subtle px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <span className="text-[13px] text-muted">
            <span className="font-semibold tabular-nums text-ink">{qtyText(totalQty) || "0"}</span> un. ·{" "}
            <span className="font-semibold tabular-nums text-ink">{brl(totalValue)}</span>
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={onPlain} className={ghostBtn}>
              Sem {kindLower}
            </button>
            <button type="button" onClick={confirm} disabled={totalQty <= 0} className={primaryBtn}>
              Adicionar ao pedido
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
