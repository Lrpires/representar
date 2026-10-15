"use client";

import { useMemo, useState } from "react";
import { parseNfe, matchItems, type Nfe } from "@/lib/nfe";
import { digits } from "@/lib/br";
import { brl, formatDate } from "@/lib/format";
import { numText, priceText } from "@/lib/orders";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui";

export type OpenOrder = {
  id: string;
  label: string;
  date: string;
  status: string;
  total: number;
  customerName: string;
  customerCnpj: string | null;
  principalName: string;
  principalCnpj: string | null;
  items: { id: string; code: string; description: string; qty: number; invoiced: number }[];
};

// Lançar nota pelo XML: lê a NF-e, sugere o pedido (mesmo cliente e representada) e casa os itens.
// Tudo vai no formulário em volta (SheetForm), que grava a nota no pedido escolhido.
export function XmlImport({ orders }: { orders: OpenOrder[] }) {
  const [nfe, setNfe] = useState<Nfe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);

  // Pontua cada pedido em aberto: mesmo emitente e mesmo destinatário valem mais; itens em comum, também.
  const ranked = useMemo(() => {
    if (!nfe) return [];
    return orders
      .map((o) => {
        const sameP = !!o.principalCnpj && digits(o.principalCnpj) === nfe.emitCnpj;
        const sameC = !!o.customerCnpj && digits(o.customerCnpj) === nfe.destDoc;
        const m = matchItems(nfe.items, o.items);
        const score = (sameP ? 4 : 0) + (sameC ? 4 : 0) + m.qty.size;
        return { o, sameP, sameC, matched: m.qty.size, score };
      })
      .sort((a, b) => b.score - a.score || b.o.date.localeCompare(a.o.date));
  }, [nfe, orders]);
  const strong = ranked.filter((r) => r.sameC && r.sameP);
  const list = showAll || strong.length === 0 ? ranked : strong;
  const chosen = orders.find((o) => o.id === orderId) ?? null;

  function choose(id: string) {
    setOrderId(id);
    const o = orders.find((x) => x.id === id);
    if (!o || !nfe) return;
    const m = matchItems(nfe.items, o.items);
    setQty(Object.fromEntries(o.items.map((i) => [i.id, m.qty.has(i.id) ? numText(m.qty.get(i.id)!, 3) : ""])));
  }

  async function onFile(file?: File) {
    setError(null);
    setNfe(null);
    setOrderId("");
    setFileName(file?.name ?? null);
    if (!file) return;
    try {
      const n = parseNfe(await file.text());
      setNfe(n);
      // Já escolhe sozinho quando só um pedido combina com cliente e representada.
      const best = orders.filter((o) => digits(o.principalCnpj) === n.emitCnpj && digits(o.customerCnpj) === n.destDoc);
      if (best.length === 1) {
        setOrderId(best[0].id);
        const m = matchItems(n.items, best[0].items);
        setQty(Object.fromEntries(best[0].items.map((i) => [i.id, m.qty.has(i.id) ? numText(m.qty.get(i.id)!, 3) : ""])));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler o XML.");
    }
  }

  return (
    <>
      <input type="hidden" name="back" value="faturamento" />
      <input type="hidden" name="order_id" value={orderId} />

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-5 transition hover:border-pen hover:bg-pen-soft/40 sm:col-span-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pen-soft text-pen">
          <Icon name={fileName ? "file" : "upload"} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{fileName ?? "Escolha o XML da NF-e"}</span>
          <span className="block text-xs text-muted">O sistema lê a nota e sugere o pedido. O XML fica guardado junto.</span>
        </span>
        <input type="file" name="file" accept=".xml,application/xml,text/xml" required className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error ? <p className="rounded-md bg-alert-soft px-3 py-2 text-[13px] text-alert sm:col-span-2">{error}</p> : null}

      {nfe ? (
        <>
          {/* Dados lidos da nota */}
          <input type="hidden" name="number" value={nfe.number} />
          <input type="hidden" name="series" value={nfe.series} />
          <input type="hidden" name="issued_at" value={nfe.issuedAt} />
          <input type="hidden" name="value" value={priceText(nfe.total)} />
          <input type="hidden" name="access_key" value={nfe.accessKey ?? ""} />
          <div className="rounded-lg border border-line bg-subtle p-3 sm:col-span-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">
                NF {nfe.number}
                {nfe.series ? <span className="font-normal text-muted"> · série {nfe.series}</span> : null}
              </p>
              <p className="text-base font-semibold tabular-nums">{brl(nfe.total)}</p>
            </div>
            <p className="mt-1 text-xs text-muted">
              {nfe.issuedAt ? `Emitida em ${formatDate(nfe.issuedAt)} · ` : ""}
              {nfe.items.length} {nfe.items.length === 1 ? "item" : "itens"}
            </p>
            <p className="mt-1.5 text-xs text-ink-2">
              <span className="text-muted">De:</span> {nfe.emitName || nfe.emitCnpj}
              <span className="mx-1.5 text-faint">→</span>
              <span className="text-muted">Para:</span> {nfe.destName || nfe.destDoc}
            </p>
          </div>

          {/* Pedido a vincular */}
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="text-[13px] font-medium text-ink-2">Vincular ao pedido</p>
              {strong.length > 0 && ranked.length > strong.length ? (
                <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-pen hover:underline">
                  {showAll ? "Só os sugeridos" : "Ver todos em aberto"}
                </button>
              ) : null}
            </div>
            {strong.length === 0 ? (
              <p className="mb-2 rounded-md bg-warn-soft px-3 py-2 text-[13px] text-warn">
                Nenhum pedido em aberto com este cliente e esta representada. Escolha manualmente abaixo.
              </p>
            ) : null}
            {list.length === 0 ? (
              <p className="text-[13px] text-muted">Não há pedidos enviados aguardando faturamento.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                {list.map(({ o, sameC, sameP, matched }) => (
                  <li key={o.id}>
                    <label className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition ${orderId === o.id ? "bg-pen-soft/60" : "hover:bg-subtle"}`}>
                      <input type="radio" name="_pick" checked={orderId === o.id} onChange={() => choose(o.id)} className="h-4 w-4 accent-[var(--color-pen)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          <span className="mr-1.5 font-mono text-xs text-muted">{o.label}</span>
                          {o.customerName}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {o.principalName} · {formatDate(o.date)} · {brl(o.total)}
                          {matched ? ` · ${matched} ${matched === 1 ? "item casou" : "itens casaram"}` : ""}
                        </span>
                      </span>
                      {sameC && sameP ? <Badge tone="ok">Sugerido</Badge> : o.status === "parcial" ? <Badge tone="pen">Parcial</Badge> : null}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quantidades casadas (editáveis) */}
          {chosen ? (
            <div className="overflow-hidden rounded-lg border border-line sm:col-span-2">
              <p className="border-b border-line bg-subtle px-3 py-2 text-xs font-medium text-muted">Quantidades desta nota no pedido {chosen.label}</p>
              <ul className="divide-y divide-line">
                {chosen.items.map((i) => {
                  const left = Math.max(i.qty - i.invoiced, 0);
                  return (
                    <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {i.code ? <span className="mr-1.5 font-mono text-xs text-muted">{i.code}</span> : null}
                          {i.description}
                        </p>
                        <p className="text-xs text-muted">
                          Pedido {numText(i.qty, 3)} · falta {numText(left, 3)}
                        </p>
                      </div>
                      <input
                        name={`qty_${i.id}`}
                        inputMode="decimal"
                        aria-label={`Quantidade de ${i.description}`}
                        value={qty[i.id] ?? ""}
                        disabled={left === 0}
                        placeholder="0"
                        onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
                        className="h-10 w-24 shrink-0 rounded-md border border-line-strong bg-surface px-2 text-right text-sm tabular-nums outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/25 disabled:bg-subtle sm:h-8"
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
