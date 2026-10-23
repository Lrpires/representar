import { currencySymbol } from "@/lib/number-format";
import Link from "next/link";
import { addReceipt, deleteReceipt, reopenCommission } from "./actions";
import { numText, priceText, round2 } from "@/lib/orders";
import { brl, formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/submit";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, primaryBtn, quietBtn } from "@/components/ui";

export type Receipt = { id: string; amount: number; received_at: string; notes: string | null };

export type Row = {
  id: string; order_id: string; value: number; due_date: string; status: string;
  received_at: string | null; received_value: number | null; principal_id: string;
  closed_at?: string | null; close_reason?: string | null;
  commission_receipts?: Receipt[];
  orders: { number: number; commission_pct: number | null; customers: { name: string } | null } | null;
  order_invoices: { id: string; number: string | null; series: string | null; issued_at: string; value: number; file_path: string | null } | null;
  principals: { name: string } | null;
};

// A comissão é sobre a nota: valor da NF × % de comissão do pedido daquela nota.
export const pctOf = (r: Row) => Number(r.orders?.commission_pct ?? 0);
export const nfValue = (r: Row) => Number(r.order_invoices?.value ?? 0);
export const expected = (r: Row) => round2(Number(r.value));
// Recebido = soma dos recebimentos lançados (antes da migração 020, o valor único gravado).
export const receivedOf = (r: Row) =>
  r.commission_receipts ? round2(r.commission_receipts.reduce((s, x) => s + Number(x.amount), 0)) : Number(r.received_value ?? 0);
export const missingOf = (r: Row) => Math.max(round2(expected(r) - receivedOf(r)), 0);

// Uma nota fiscal com a comissão dela: recebimentos (um ou vários), encerrar ou reabrir.
export function CommissionRow({
  r,
  late,
  backQs,
  label,
  today,
  closeHref,
}: {
  r: Row;
  late: boolean;
  backQs: string;
  label: string;
  today: string;
  closeHref: string;
}) {
  const nf = r.order_invoices;
  const exp = expected(r);
  const got = receivedOf(r);
  const missing = missingOf(r);
  const receipts = [...(r.commission_receipts ?? [])].sort((a, b) => a.received_at.localeCompare(b.received_at));
  const open = r.status === "a_receber";
  const tone =
    r.status === "recebida" ? "bg-ok-soft text-ok" : r.status === "encerrada" ? "bg-active text-muted" : late ? "bg-alert-soft text-alert" : "bg-hover text-muted";

  return (
    <li
      className={`grid gap-3 px-4 py-3.5 sm:px-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_7rem_6rem_minmax(16rem,1.3fr)] lg:items-start lg:gap-4 ${
        late && open ? "bg-alert-soft/40" : ""
      }`}
    >
      {/* Nota fiscal */}
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon name="receipt" size={17} />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            <Link href={nf ? `/faturamento?nota=${nf.id}` : "#"} className="hover:text-accent-ink hover:underline">
              NF {nf?.number || "sem número"}
            </Link>
            {nf?.file_path ? (
              <a href={`/nf/${nf.id}`} target="_blank" rel="noopener noreferrer" className="text-faint hover:text-ink" title="Ver nota fiscal">
                <Icon name="file" size={14} />
              </a>
            ) : null}
          </p>
          <p className="truncate text-xs text-muted">
            {nf ? `Emitida em ${formatDate(nf.issued_at)}` : ""} · {r.principals?.name}
          </p>
        </div>
      </div>

      {/* Pedido */}
      <div className="min-w-0 pl-12 lg:pl-0">
        <Link href={`/pedidos/${r.order_id}`} className="font-mono text-[13px] font-medium hover:text-accent-ink">
          {label}
        </Link>
        <p className="truncate text-xs text-muted">{r.orders?.customers?.name}</p>
      </div>

      {/* Valores (no celular, em linha) */}
      <div className="flex items-center justify-between gap-3 pl-12 text-sm lg:block lg:pl-0 lg:text-right">
        <span className="text-xs text-muted lg:hidden">Comissão</span>
        <span className="tabular-nums">
          <span className="font-medium">{brl(exp)}</span>
          <span className="block text-xs text-muted">
            {numText(pctOf(r), 2)}% de {brl(nfValue(r))}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 pl-12 lg:block lg:pl-0">
        <span className="text-xs text-muted lg:hidden">Vencimento</span>
        <span className={`text-sm tabular-nums ${late && open ? "font-medium text-alert" : "text-ink-2"}`}>
          {formatDate(r.due_date)}
          {late && open ? <span className="block text-xs">Atrasada</span> : null}
        </span>
      </div>

      {/* Recebimento */}
      <div className="grid gap-2 pl-12 lg:pl-0">
        {open ? (
          <>
            {got > 0 ? (
              <div className="lg:text-right">
                <p className="text-xs text-muted">
                  Recebido <span className="font-medium tabular-nums text-ok">{brl(got)}</span> de {brl(exp)} · falta{" "}
                  <span className="font-medium tabular-nums text-warn">{brl(missing)}</span>
                </p>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-active lg:ml-auto lg:w-40">
                  <span className="block h-full rounded-full bg-ok" style={{ width: `${exp ? Math.min(got / exp, 1) * 100 : 0}%` }} />
                </span>
              </div>
            ) : null}
            <form action={addReceipt.bind(null, r.id)} className="flex items-center gap-2 lg:justify-end">
              <input type="hidden" name="back" value={backQs} />
              <input type="hidden" name="received_at" value={today} />
              <label className="relative min-w-0 flex-1 lg:max-w-[9rem]">
                <span className="sr-only">Valor recebido da NF {nf?.number}</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">{currencySymbol()}</span>
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={priceText(missing || exp)}
                  className="h-11 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-right text-base font-medium tabular-nums shadow-field outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/25 sm:h-9 sm:text-sm"
                />
              </label>
              <SubmitButton className={`${primaryBtn} shrink-0`} pending="…">
                <Icon name="check" size={15} strokeWidth={2.2} />
                Receber
              </SubmitButton>
            </form>
            <div className="flex lg:justify-end">
              <Link href={closeHref} scroll={false} className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
                Encerrar comissão…
              </Link>
            </div>
          </>
        ) : r.status === "recebida" ? (
          <div className="lg:text-right">
            <span className="block text-sm font-semibold tabular-nums text-ok">{brl(got || exp)}</span>
            <span className="block text-xs text-muted">
              Recebida{r.received_at ? ` em ${formatDate(r.received_at)}` : ""}
              {got > exp + 0.009 ? ` · ${brl(got - exp)} acima do previsto` : ""}
            </span>
          </div>
        ) : r.status === "encerrada" ? (
          <div className="flex items-start justify-between gap-2 lg:justify-end">
            <span className="min-w-0 lg:text-right">
              <span className="flex items-center gap-2 lg:justify-end">
                <span className="text-sm font-semibold tabular-nums">{brl(got)}</span>
                <Badge tone="neutral" dot>
                  Encerrada
                </Badge>
              </span>
              <span className="block text-xs text-muted">
                {brl(missing)} não vai entrar{r.closed_at ? ` · em ${formatDate(r.closed_at)}` : ""}
              </span>
              {r.close_reason ? <span className="block text-xs text-ink-2">{r.close_reason}</span> : null}
            </span>
            <form action={reopenCommission.bind(null, r.id)}>
              <input type="hidden" name="back" value={backQs} />
              <SubmitButton className={quietBtn} pending="…">
                Reabrir
              </SubmitButton>
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 lg:justify-end">
            <span className="text-sm tabular-nums text-faint line-through">{brl(exp)}</span>
            <Badge tone="neutral" dot>
              Cancelada
            </Badge>
          </div>
        )}

        {/* Histórico de recebimentos */}
        {receipts.length ? (
          <details className="group lg:text-right">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-muted hover:text-ink">
              <Icon name="chevron-right" size={12} className="transition group-open:rotate-90" />
              {receipts.length} {receipts.length === 1 ? "recebimento" : "recebimentos"}
            </summary>
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-subtle text-left text-xs">
              {receipts.map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="tabular-nums text-muted">{formatDate(x.received_at)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">{x.notes}</span>
                  <span className="font-medium tabular-nums">{brl(Number(x.amount))}</span>
                  <form action={deleteReceipt.bind(null, x.id)}>
                    <input type="hidden" name="back" value={backQs} />
                    <ConfirmButton message={`Apagar o recebimento de ${brl(Number(x.amount))}?`} className="text-faint hover:text-alert">
                      <Icon name="x" size={13} />
                      <span className="sr-only">Apagar recebimento</span>
                    </ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </li>
  );
}
