"use client";

import { useState } from "react";
import { num, numText, priceText, round2 } from "@/lib/orders";
import { brl } from "@/lib/format";
import { Field, FormGroup, inputCls } from "@/components/ui";
import { Icon } from "@/components/icons";

export type InvoiceItem = {
  id: string;
  code: string;
  description: string;
  unit: string;
  qty: number;
  unitPrice: number; // já com o desconto do item
  invoiced: number; // quanto já saiu em notas anteriores
};

// Campos do faturamento: quantidades por item (padrão = o que falta) e valor calculado.
export function InvoiceFields({
  items,
  discountPct,
  today,
}: {
  items: InvoiceItem[];
  discountPct: number;
  today: string;
}) {
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, numText(Math.max(i.qty - i.invoiced, 0), 3)])),
  );
  const [valueEdited, setValueEdited] = useState(false);
  const calc = round2(
    items.reduce((s, i) => s + num(qty[i.id]) * i.unitPrice, 0) * (1 - discountPct / 100),
  );
  const [value, setValue] = useState(priceText(calc));
  const shown = valueEdited ? value : priceText(calc);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <>
      <Field label="Número da NF">
        <input name="number" inputMode="numeric" placeholder="Ex.: 12345" className={inputCls} />
      </Field>
      <Field label="Série" hint="Opcional.">
        <input name="series" className={inputCls} />
      </Field>
      <Field label="Data do faturamento">
        <input name="issued_at" type="date" required defaultValue={today} className={inputCls} />
      </Field>
      <Field label="Valor faturado (R$)" hint={valueEdited ? "Valor digitado por você." : "Calculado pelas quantidades abaixo."}>
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

      <FormGroup title="Quantidades desta nota" />
      <div className="overflow-hidden rounded-lg border border-line sm:col-span-2">
        <ul className="divide-y divide-line">
          {items.map((i) => {
            const left = Math.max(i.qty - i.invoiced, 0);
            return (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.description}</p>
                  <p className="text-xs text-muted">
                    Pedido {numText(i.qty, 3)} · já faturado {numText(i.invoiced, 3)} · falta{" "}
                    <span className={left ? "font-medium text-ink-2" : ""}>{numText(left, 3)}</span>
                  </p>
                </div>
                <input
                  name={`qty_${i.id}`}
                  inputMode="decimal"
                  aria-label={`Quantidade faturada de ${i.description}`}
                  value={qty[i.id] ?? ""}
                  disabled={left === 0}
                  onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
                  className="h-10 w-24 shrink-0 rounded-md border border-line-strong bg-white px-2 text-right text-sm tabular-nums outline-none focus:border-pen focus:ring-[3px] focus:ring-pen/15 disabled:bg-subtle disabled:text-faint sm:h-8"
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

      <FormGroup title="Arquivo da nota" />
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-4 transition hover:border-pen hover:bg-pen-soft/40 sm:col-span-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pen-soft text-pen">
          <Icon name={fileName ? "file" : "upload"} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{fileName ?? "Anexar PDF ou XML da NF"}</span>
          <span className="block text-xs text-muted">{fileName ? "Clique para trocar o arquivo." : "Opcional. Até 10 MB."}</span>
        </span>
        <input
          type="file"
          name="file"
          accept="application/pdf,.pdf,application/xml,text/xml,.xml,image/jpeg,image/png"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>
      <Field label="Observações" className="sm:col-span-2">
        <input name="notes" placeholder="Ex.: faturamento parcial, restante em 15 dias" className={inputCls} />
      </Field>
    </>
  );
}
