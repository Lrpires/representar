"use client";

import { useMemo, useState } from "react";
import { parseNfe, matchItems, type Nfe } from "@/lib/nfe";
import { samePrincipal, sameCustomer } from "@/lib/nfe-match";
import { digits } from "@/lib/br";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui";
import { useNumberFormat } from "@/components/number-format";

export type OpenOrder = {
  id: string;
  number: number;
  label: string;
  date: string;
  status: string;
  total: number;
  customerName: string;
  customerCnpj: string | null;
  principalName: string;
  principalLegalName?: string | null;
  principalCnpj: string | null;
  items: { id: string; code: string; description: string; qty: number; invoiced: number }[];
};

// Lançar nota pelo XML: lê a NF-e, sugere o pedido (mesmo cliente e representada) e casa os itens.
// Tudo vai no formulário em volta (SheetForm), que grava a nota no pedido escolhido.
export function XmlImport({ orders }: { orders: OpenOrder[] }) {
  const { brl, numText, priceText } = useNumberFormat();
  const [nfe, setNfe] = useState<Nfe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  // Só entram os pedidos em aberto do cliente e da representada da nota.
  const candidates = useMemo(() => (nfe ? orders.filter((o) => samePrincipal(o, nfe) && sameCustomer(o, nfe)) : []), [nfe, orders]);
  const anyPrincipal = useMemo(() => (nfe ? orders.some((o) => samePrincipal(o, nfe)) : false), [nfe, orders]);
  const anyCustomer = useMemo(() => (nfe ? orders.some((o) => sameCustomer(o, nfe)) : false), [nfe, orders]);
  // Número do pedido citado na nota (forte) ou qualquer número das informações complementares (fraco).
  const cited = useMemo(() => {
    if (!nfe) return new Set<string>();
    const strong = new Set(nfe.orderRefs);
    const byRef = candidates.filter((o) => strong.has(String(o.number)));
    if (byRef.length) return new Set(byRef.map((o) => o.id));
    const loose = new Set((nfe.additionalInfo.match(/\d{1,7}/g) ?? []).map((x) => x.replace(/^0+(?=\d)/, "")));
    const byLoose = candidates.filter((o) => loose.has(String(o.number)));
    return new Set(byLoose.length === 1 ? [byLoose[0].id] : []);
  }, [nfe, candidates]);
  const ranked = useMemo(() => {
    if (!nfe) return [];
    return candidates
      .map((o) => ({ o, cited: cited.has(o.id), matched: matchItems(nfe.items, o.items).qty.size }))
      .sort((a, b) => Number(b.cited) - Number(a.cited) || b.matched - a.matched || b.o.date.localeCompare(a.o.date));
  }, [nfe, candidates, cited]);
  const term = search.trim().toLowerCase();
  const list = term
    ? ranked.filter(({ o }) => o.label.toLowerCase().includes(term) || String(o.number) === term.replace(/\D/g, ""))
    : ranked;
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
      setSearch("");
      // Já escolhe sozinho: o pedido citado na nota ou, se só houver um do cliente com a representada, esse.
      const mine = orders.filter((o) => samePrincipal(o, n) && sameCustomer(o, n));
      const refs = new Set(n.orderRefs);
      const byRef = mine.filter((o) => refs.has(String(o.number)));
      const best = byRef.length === 1 ? byRef : mine.length === 1 ? mine : [];
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
          {nfe.installments.map((d, i) => (
            <span key={i} className="hidden">
              <input type="hidden" name="inst_number" value={d.number || String(i + 1).padStart(3, "0")} />
              <input type="hidden" name="inst_due" value={d.dueDate} />
              <input type="hidden" name="inst_value" value={priceText(d.value)} />
            </span>
          ))}
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
              {nfe.installments.length
                ? ` · ${nfe.installments.length} ${nfe.installments.length === 1 ? "parcela" : "parcelas"}: ${nfe.installments.map((d) => formatDate(d.dueDate)).join(", ")}`
                : ""}
            </p>
            <p className="mt-1.5 text-xs text-ink-2">
              <span className="text-muted">De:</span> {nfe.emitName || nfe.emitCnpj}
              <span className="mx-1.5 text-faint">→</span>
              <span className="text-muted">Para:</span> {nfe.destName || nfe.destDoc}
            </p>
          </div>

          {/* Pedido a vincular: só os do cliente e da representada da nota */}
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-ink-2">Vincular ao pedido</p>
              {candidates.length > 3 ? (
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nº do pedido"
                  aria-label="Buscar pelo número do pedido"
                  className="h-9 w-44 rounded-md border border-line-strong bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/25 sm:h-8"
                />
              ) : null}
            </div>
            {nfe.orderRefs.length ? (
              <p className="mb-2 text-xs text-muted">
                A nota cita {nfe.orderRefs.length === 1 ? "o pedido" : "os pedidos"} {nfe.orderRefs.join(", ")}.
                {cited.size ? "" : " Nenhum deles está em aberto para este cliente."}
              </p>
            ) : null}
            {candidates.length === 0 ? (
              <p className="rounded-md bg-warn-soft px-3 py-2 text-[13px] text-warn">
                {!anyPrincipal
                  ? `Não achei a representada desta nota (${nfe.emitName || nfe.emitCnpj}). Confira o CNPJ dela no cadastro da representada.`
                  : !anyCustomer
                    ? `Não achei pedido em aberto do cliente ${nfe.destName || nfe.destDoc}. Confira o CNPJ no cadastro do cliente.`
                    : `${nfe.destName || "Este cliente"} não tem pedido em aberto com esta representada.`}
              </p>
            ) : list.length === 0 ? (
              <p className="rounded-md bg-subtle px-3 py-2 text-[13px] text-muted">Nenhum pedido deste cliente com esse número.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                {list.map(({ o, cited: isCited, matched }) => (
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
                      {isCited ? <Badge tone="ok">Citado na nota</Badge> : o.status === "parcial" ? <Badge tone="pen">Parcial</Badge> : null}
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
