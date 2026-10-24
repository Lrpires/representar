"use client";

import { useEffect, useState, type ReactNode } from "react";
import { parseNfe, type Nfe, type NfeParty } from "@/lib/nfe";
import { formatCnpj } from "@/lib/br";
import { formatDate } from "@/lib/format";
import { useNumberFormat } from "@/components/number-format";

// Espelho da nota fiscal, lido do XML guardado: tudo o que está na NF, no jeito de uma DANFE.
// Sem XML (nota lançada à mão ou com PDF), mostra o que o sistema tem da nota (fallback).
export function NfeMirror({ invoiceId, hasXml, fallback }: { invoiceId: string; hasXml: boolean; fallback: ReactNode }) {
  const [nfe, setNfe] = useState<Nfe | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "none">(hasXml ? "loading" : "none");

  useEffect(() => {
    if (!hasXml) return;
    let alive = true;
    fetch(`/nf/${invoiceId}?xml=1`)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((xml) => {
        if (!alive) return;
        setNfe(parseNfe(xml));
        setState("ok");
      })
      .catch(() => alive && setState("none"));
    return () => {
      alive = false;
    };
  }, [invoiceId, hasXml]);

  if (state === "none") return <>{fallback}</>;
  if (state === "loading" || !nfe) return <p className="py-6 text-center text-sm text-muted">Lendo o XML da nota…</p>;
  return <Mirror nfe={nfe} />;
}

const doc = (d: string) => (d.length === 14 || d.length === 11 ? formatCnpj(d) : d);
const key = (k: string | null) => (k ? k.replace(/(\d{4})(?=\d)/g, "$1 ") : "");

function Block({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-lg border border-line ${className}`}>
      <p className="border-b border-line bg-subtle px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="px-3 py-2.5">{children}</div>
    </section>
  );
}

function Info({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  if (children === "" || children == null) return null;
  return (
    <div className={wide ? "col-span-full" : ""}>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-[13px] text-ink">{children}</dd>
    </div>
  );
}

function Party({ title, p }: { title: string; p: NfeParty }) {
  return (
    <Block title={title}>
      <p className="text-sm font-semibold leading-snug">{p.name || "—"}</p>
      {p.fantasy ? <p className="text-xs text-muted">{p.fantasy}</p> : null}
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <Info label={p.doc.length === 11 ? "CPF" : "CNPJ"}>{doc(p.doc)}</Info>
        <Info label="Inscrição estadual">{p.ie}</Info>
        <Info label="Endereço" wide>
          {p.address}
        </Info>
        <Info label="Cidade / UF">{[p.city, p.uf].filter(Boolean).join(" / ")}</Info>
        <Info label="CEP">{p.zip ? p.zip.replace(/^(\d{5})(\d{3})$/, "$1-$2") : ""}</Info>
        <Info label="Telefone">{p.phone}</Info>
      </dl>
    </Block>
  );
}

export function Mirror({ nfe }: { nfe: Nfe }) {
  const { brl, numText, qtyText, priceText } = useNumberFormat();
  const t = nfe.totals;
  const totals: [string, number, boolean?][] = [
    ["Produtos", t.products],
    ["Frete", t.freight],
    ["Seguro", t.insurance],
    ["Desconto", t.discount],
    ["Outras despesas", t.other],
    ["IPI", t.ipi],
    ["Base do ICMS", t.icmsBase],
    ["ICMS", t.icms],
    ["ICMS ST", t.icmsSt],
    ["Total da nota", t.total, true],
  ];
  const tr = nfe.transport;

  return (
    <div className="grid gap-3">
      {/* Identificação */}
      <Block title="Nota fiscal eletrônica">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Info label="Número / série">
            <span className="font-semibold">
              {nfe.number}
              {nfe.series ? ` / ${nfe.series}` : ""}
            </span>
          </Info>
          <Info label="Emissão">{formatDate(nfe.issuedAt)}</Info>
          <Info label="Saída">{nfe.departure ? formatDate(nfe.departure) : ""}</Info>
          <Info label="Valor total">
            <span className="font-mono font-semibold tabular-nums">{brl(t.total)}</span>
          </Info>
          <Info label="Natureza da operação" wide>
            {nfe.nature}
          </Info>
          <Info label="Chave de acesso" wide>
            <span className="break-all font-mono text-xs">{key(nfe.accessKey)}</span>
          </Info>
          <Info label="Protocolo de autorização">{nfe.protocol}</Info>
        </dl>
      </Block>

      <div className="grid gap-3 md:grid-cols-2">
        <Party title="Emitente" p={nfe.emit} />
        <Party title="Destinatário" p={nfe.dest} />
      </div>

      {/* Itens */}
      <section className="overflow-hidden rounded-lg border border-line">
        <p className="border-b border-line bg-subtle px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Produtos ({nfe.items.length})
        </p>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[40rem] text-[12.5px]">
            <thead className="text-[11px] text-muted">
              <tr className="border-b border-line">
                <th className="px-3 py-1.5 text-left font-medium">Código</th>
                <th className="px-2 py-1.5 text-left font-medium">Descrição</th>
                <th className="px-2 py-1.5 text-left font-medium">NCM</th>
                <th className="px-2 py-1.5 text-left font-medium">CFOP</th>
                <th className="px-2 py-1.5 text-left font-medium">Un.</th>
                <th className="px-2 py-1.5 text-right font-medium">Qtd.</th>
                <th className="px-2 py-1.5 text-right font-medium">Valor un.</th>
                <th className="px-3 py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {nfe.items.map((it, n) => (
                <tr key={n} className="align-top">
                  <td className="px-3 py-2 font-mono text-[11.5px] text-muted">{it.code}</td>
                  <td className="px-2 py-2">
                    {it.description}
                    {it.orderRef ? <span className="block text-[11px] text-muted">Pedido {it.orderRef}</span> : null}
                  </td>
                  <td className="px-2 py-2 font-mono text-[11.5px] text-muted">{it.ncm}</td>
                  <td className="px-2 py-2 font-mono text-[11.5px] text-muted">{it.cfop}</td>
                  <td className="px-2 py-2 text-muted">{it.unit}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{qtyText(it.qty)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums">{priceText(it.unitPrice)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{brl(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Totais */}
        <Block title="Totais">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            {totals
              .filter(([, v, strong]) => strong || v)
              .map(([label, v, strong]) => (
                <div key={label} className={`flex justify-between gap-2 text-[13px] ${strong ? "col-span-2 mt-1 border-t border-line pt-1.5" : ""}`}>
                  <dt className={strong ? "font-medium" : "text-muted"}>{label}</dt>
                  <dd className={`font-mono tabular-nums ${strong ? "font-semibold" : ""}`}>{brl(v)}</dd>
                </div>
              ))}
          </dl>
        </Block>

        {/* Parcelas: só número, vencimento e valor */}
        <Block title="Parcelas">
          {nfe.installments.length ? (
            <table className="w-full text-[13px]">
              <thead className="text-[11px] text-muted">
                <tr>
                  <th className="pb-1 text-left font-medium">Parcela</th>
                  <th className="pb-1 text-left font-medium">Vencimento</th>
                  <th className="pb-1 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {nfe.installments.map((d, i) => (
                  <tr key={i}>
                    <td className="py-0.5 font-mono">{d.number || String(i + 1).padStart(2, "0")}</td>
                    <td className="py-0.5 tabular-nums">{formatDate(d.dueDate)}</td>
                    <td className="py-0.5 text-right font-mono tabular-nums">{brl(d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[13px] text-muted">A nota não tem duplicatas.</p>
          )}
        </Block>
      </div>

      {/* Transporte */}
      {tr.mode || tr.carrier || tr.volumes || tr.grossWeight ? (
        <Block title="Transporte">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            <Info label="Frete">{tr.mode}</Info>
            <Info label="Transportadora">{tr.carrier}</Info>
            <Info label="CNPJ da transportadora">{tr.carrierDoc ? doc(tr.carrierDoc) : ""}</Info>
            <Info label="Volumes">{tr.volumes ? `${numText(tr.volumes, 0)}${tr.kind ? ` ${tr.kind.toLowerCase()}` : ""}` : ""}</Info>
            <Info label="Peso líquido">{tr.netWeight ? `${qtyText(tr.netWeight)} kg` : ""}</Info>
            <Info label="Peso bruto">{tr.grossWeight ? `${qtyText(tr.grossWeight)} kg` : ""}</Info>
          </dl>
        </Block>
      ) : null}

      {nfe.additionalInfo ? (
        <Block title="Informações complementares">
          <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink-2">{nfe.additionalInfo}</p>
        </Block>
      ) : null}
    </div>
  );
}
