"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Badge, inputCls } from "@/components/ui";
import { InvoiceFields, type InvoiceItem } from "../pedidos/[id]/invoice-fields";
import { useNumberFormat } from "@/components/number-format";

export type ManualOrder = {
  id: string;
  label: string;
  date: string;
  status: string;
  total: number;
  discountPct: number;
  customerName: string;
  customerCnpj: string | null;
  principalName: string;
  principalCnpj: string | null;
  items: InvoiceItem[];
};

// Lançar nota à mão pela área de Faturamento: escolhe o pedido e preenche os dados da nota.
// (O XML também pode ser solto no campo de arquivo, que preenche tudo sozinho.)
export function ManualInvoice({ orders, today, initialOrderId }: { orders: ManualOrder[]; today: string; initialOrderId?: string }) {
  const { brl } = useNumberFormat();
  const [orderId, setOrderId] = useState(orders.some((o) => o.id === initialOrderId) ? initialOrderId! : "");
  const [q, setQ] = useState("");
  const chosen = orders.find((o) => o.id === orderId) ?? null;

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return orders;
    return orders.filter((o) => `${o.label} ${o.customerName} ${o.principalName}`.toLowerCase().includes(t));
  }, [orders, q]);

  return (
    <>
      <input type="hidden" name="back" value="faturamento-manual" />
      <input type="hidden" name="order_id" value={orderId} />

      {chosen ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-subtle p-3 sm:col-span-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted">
            <Icon name="receipt" size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              <span className="font-mono">{chosen.label}</span> · {chosen.customerName}
            </span>
            <span className="block truncate text-xs text-muted">
              {chosen.principalName} · {formatDate(chosen.date)} · {brl(chosen.total)}
            </span>
          </span>
          <button type="button" onClick={() => setOrderId("")} className="text-xs font-medium text-ink-2 underline-offset-2 hover:underline">
            Trocar
          </button>
        </div>
      ) : (
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">De qual pedido é esta nota?</p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pedido, cliente ou representada"
            className={`${inputCls} mb-2`}
          />
          {list.length === 0 ? (
            <p className="text-[13px] text-muted">{orders.length ? "Nenhum pedido encontrado." : "Não há pedidos enviados esperando nota."}</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {list.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => setOrderId(o.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-subtle">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        <span className="mr-1.5 font-mono text-xs text-muted">{o.label}</span>
                        {o.customerName}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {o.principalName} · {formatDate(o.date)} · {brl(o.total)}
                      </span>
                    </span>
                    {o.status === "parcial" ? <Badge tone="pen">Parcial</Badge> : null}
                    <Icon name="chevron-right" size={15} className="text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {chosen ? (
        <InvoiceFields
          key={chosen.id}
          items={chosen.items}
          discountPct={chosen.discountPct}
          today={today}
          expected={{ principalCnpj: chosen.principalCnpj, customerCnpj: chosen.customerCnpj }}
        />
      ) : null}
    </>
  );
}
