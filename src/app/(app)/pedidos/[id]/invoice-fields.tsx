"use client";

import { useRef, useState } from "react";
import { round2 } from "@/lib/orders";
import { digits } from "@/lib/br";
import { parseNfe, matchItems, type Nfe } from "@/lib/nfe";
import { Field, FormGroup, inputCls } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useNumberFormat } from "@/components/number-format";
import { installmentsFromTerms } from "@/lib/commission-plan";
import { InstallmentsEditor, type InstRow } from "./installments-editor";

export type InvoiceItem = {
  id: string;
  code: string;
  description: string;
  unit: string;
  qty: number;
  unitPrice: number; // já com o desconto do item
  invoiced: number; // quanto já saiu em notas anteriores
};

// Campos do faturamento. Pode ser preenchido à mão ou pelo XML da NF-e,
// que traz número, série, data, valor e as quantidades de cada item.
export function InvoiceFields({
  items,
  discountPct,
  today,
  expected,
  paymentTerms,
}: {
  items: InvoiceItem[];
  discountPct: number;
  today: string;
  expected?: { principalCnpj?: string | null; customerCnpj?: string | null };
  paymentTerms?: string | null; // prazo do pedido ("30/60/90 dias"), para sugerir as parcelas
}) {
  const { brl, num, numText, qtyText, priceText, symbol } = useNumberFormat();
  const left = (i: InvoiceItem) => Math.max(i.qty - i.invoiced, 0);
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, numText(left(i), 3)])),
  );
  const [number, setNumber] = useState("");
  const [series, setSeries] = useState("");
  const [date, setDate] = useState(today);
  const [accessKey, setAccessKey] = useState("");
  const [valueEdited, setValueEdited] = useState(false);
  const calc = round2(items.reduce((s, i) => s + num(qty[i.id]) * i.unitPrice, 0) * (1 - discountPct / 100));
  const [value, setValue] = useState(priceText(calc));
  const shown = valueEdited ? value : priceText(calc);
  const [fileName, setFileName] = useState<string | null>(null);
  const [nfe, setNfe] = useState<Nfe | null>(null);
  const [xmlMsg, setXmlMsg] = useState<{ tone: "ok" | "warn" | "alert"; text: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Parcelas: enquanto a pessoa não mexe, acompanham o prazo do pedido, a data e o valor da nota.
  const [instRows, setInstRows] = useState<InstRow[] | null>(null);
  const noteValue = num(shown);
  const fromTerms = (): InstRow[] =>
    installmentsFromTerms(paymentTerms, date, noteValue).map((x) => ({ number: x.number ?? "", due: x.dueDate, value: priceText(x.value) }));
  const inst = instRows ?? fromTerms();

  async function onFile(file: File | undefined) {
    setFileName(file?.name ?? null);
    setXmlMsg([]);
    setNfe(null);
    if (!file || !/xml/i.test(file.type + file.name)) return;
    try {
      const n = parseNfe(await file.text());
      setNfe(n);
      setNumber(n.number);
      setSeries(n.series);
      if (n.issuedAt) setDate(n.issuedAt);
      if (n.accessKey) setAccessKey(n.accessKey);
      if (n.installments.length) {
        setInstRows(n.installments.map((d, i) => ({ number: d.number || String(i + 1).padStart(3, "0"), due: d.dueDate, value: priceText(d.value) })));
      }
      setValue(priceText(n.total));
      setValueEdited(true);
      const m = matchItems(n.items, items);
      setQty(Object.fromEntries(items.map((i) => [i.id, m.qty.has(i.id) ? numText(m.qty.get(i.id)!, 3) : ""])));

      const msgs: { tone: "ok" | "warn" | "alert"; text: string }[] = [
        { tone: "ok", text: `NF ${n.number} lida: ${n.items.length} ${n.items.length === 1 ? "item" : "itens"}, ${brl(n.total)}.` },
      ];
      if (expected?.principalCnpj && n.emitCnpj && digits(expected.principalCnpj) !== n.emitCnpj) {
        msgs.push({ tone: "alert", text: `Atenção: a nota foi emitida por ${n.emitName || n.emitCnpj}, que não é a representada deste pedido.` });
      }
      if (expected?.customerCnpj && n.destDoc && digits(expected.customerCnpj) !== n.destDoc) {
        msgs.push({ tone: "alert", text: `Atenção: o destinatário da nota (${n.destName || n.destDoc}) não é o cliente deste pedido.` });
      }
      if (m.unmatched.length) {
        msgs.push({
          tone: "warn",
          text: `${m.unmatched.length} ${m.unmatched.length === 1 ? "item da nota não foi encontrado" : "itens da nota não foram encontrados"} no pedido: ${m.unmatched
            .map((u) => u.description)
            .slice(0, 3)
            .join(", ")}. Confira as quantidades abaixo.`,
        });
      }
      const over = items.filter((i) => num(m.qty.get(i.id) ?? 0) > left(i) + 1e-9);
      if (over.length) {
        msgs.push({ tone: "warn", text: `A nota tem mais quantidade do que falta faturar em: ${over.map((i) => i.description).join(", ")}.` });
      }
      setXmlMsg(msgs);
    } catch (e) {
      setXmlMsg([{ tone: "alert", text: e instanceof Error ? e.message : "Não foi possível ler o XML." }]);
    }
  }

  const tone = { ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", alert: "bg-alert-soft text-alert" };

  return (
    <>
      {/* XML (ou PDF) da nota: o XML preenche tudo sozinho */}
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-4 transition hover:border-pen hover:bg-pen-soft/40 sm:col-span-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pen-soft text-pen">
          <Icon name={fileName ? "file" : "upload"} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{fileName ?? "Soltar o XML da NF-e (preenche tudo) ou o PDF"}</span>
          <span className="block text-xs text-muted">{fileName ? "Clique para trocar o arquivo." : "Opcional. Também dá para preencher à mão abaixo."}</span>
        </span>
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept="application/pdf,.pdf,application/xml,text/xml,.xml,image/jpeg,image/png"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      {xmlMsg.length ? (
        <div className="grid gap-1.5 sm:col-span-2">
          {xmlMsg.map((m, i) => (
            <p key={i} className={`rounded-md px-3 py-2 text-[13px] ${tone[m.tone]}`}>
              {m.text}
            </p>
          ))}
        </div>
      ) : null}
      <input type="hidden" name="access_key" value={accessKey} />

      <Field label="Número da NF">
        <input name="number" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ex.: 12345" className={inputCls} />
      </Field>
      <Field label="Série" hint="Opcional.">
        <input name="series" value={series} onChange={(e) => setSeries(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Data do faturamento">
        <input name="issued_at" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      </Field>
      <Field
        label={`Valor faturado (${symbol})`}
        hint={nfe ? "Valor total da NF-e." : valueEdited ? "Valor digitado por você." : "Calculado pelas quantidades abaixo."}
      >
        <input
          name="value"
          inputMode="decimal"
          required
          value={shown}
          onChange={(e) => {
            setValue(e.target.value);
            setValueEdited(true);
          }}
          className={`${inputCls} text-right tabular-nums`}
        />
      </Field>
      {accessKey ? (
        <p className="truncate font-mono text-[11px] text-muted sm:col-span-2" title={accessKey}>
          Chave de acesso: {accessKey}
        </p>
      ) : null}

      <InstallmentsEditor
        rows={inst}
        onChange={setInstRows}
        noteValue={noteValue}
        termsLabel={paymentTerms}
        onRegenerate={() => setInstRows(null)}
        auto={instRows === null}
      />

      <FormGroup title="Quantidades desta nota" />
      <div className="overflow-hidden rounded-lg border border-line sm:col-span-2">
        <ul className="divide-y divide-line">
          {items.map((i) => {
            const l = left(i);
            return (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {i.code ? <span className="mr-1.5 font-mono text-xs text-muted">{i.code}</span> : null}
                    {i.description}
                  </p>
                  <p className="text-xs text-muted">
                    Pedido {qtyText(i.qty)} · já faturado {qtyText(i.invoiced)} · falta{" "}
                    <span className={l ? "font-medium text-ink-2" : ""}>{qtyText(l)}</span>
                  </p>
                </div>
                <input
                  name={`qty_${i.id}`}
                  inputMode="decimal"
                  aria-label={`Quantidade faturada de ${i.description}`}
                  value={qty[i.id] ?? ""}
                  disabled={l === 0}
                  placeholder="0"
                  onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
                  className="h-10 w-24 shrink-0 rounded-md border border-line-strong bg-surface px-2 text-right text-sm tabular-nums outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/25 disabled:bg-subtle disabled:text-faint sm:h-8"
                />
              </li>
            );
          })}
        </ul>
        <p className="flex justify-between border-t border-line bg-subtle px-3 py-2 text-[13px]">
          <span className="text-muted">Valor das quantidades{discountPct ? ` (com ${numText(discountPct, 2)}% de desconto geral)` : ""}</span>
          <span className="font-medium tabular-nums">{brl(calc)}</span>
        </p>
      </div>
      <p className="text-xs text-muted sm:col-span-2">
        Faturou menos do que o pedido? O pedido fica como <span className="font-medium text-ink-2">Faturado parcial</span> e
        recebe as próximas notas. Se o saldo não vier, use “Finalizar pedido”.
      </p>

      <Field label="Observações" className="sm:col-span-2">
        <input name="notes" placeholder="Ex.: faturamento parcial, restante em 15 dias" className={inputCls} />
      </Field>
    </>
  );
}
