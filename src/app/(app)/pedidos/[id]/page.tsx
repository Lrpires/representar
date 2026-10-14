import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import {
  sendOrder, reopenOrder, cancelOrder, deleteDraft, duplicateOrder,
} from "./actions";
import { registerInvoice, deleteInvoice } from "./invoices";
import { InvoiceFields } from "./invoice-fields";
import { formatOrderNumber, numText, orderTotals, priceText, statusInfo } from "@/lib/orders";
import { brl, formatDate, todayISO } from "@/lib/format";
import { unitLabel } from "@/lib/units";
import { loadEditorData } from "../data";
import { OrderEditor } from "../editor";
import { Sheet } from "@/components/sheet";
import { Icon, type IconName } from "@/components/icons";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit";
import {
  PageHeader, Badge, ErrorNote, OkNote, Field, SheetForm, Properties, Property, inputCls,
  primaryBtn, ghostBtn, dangerBtn, iconBtn,
} from "@/components/ui";

const PATH = "/pedidos";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string; faturar?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, canManage, isBackOffice, role } = await getContext();
  const settings = await getSettings();

  const { data: o } = await supabase
    .from("orders")
    .select("*, customers(id, name), principals(name, commission_close_mode, commission_days_after)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();

  const [{ data: items }, { data: seller }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).order("position"),
    supabase.from("members").select("full_name, email").eq("user_id", o.seller_id).eq("org_id", o.org_id).maybeSingle(),
  ]);

  const here = `${PATH}/${id}`;
  const st = statusInfo(o.status);
  const mine = o.seller_id === user.id;
  const canOwn = canManage || mine;
  const editable = o.status === "rascunho" && canOwn && role !== "finance";
  const customer = o.customers as unknown as { id: string; name: string } | null;
  const principal = o.principals as unknown as {
    name: string; commission_close_mode: string; commission_days_after: number | null;
  } | null;
  const sellerName = seller?.full_name || seller?.email || "";
  const label = formatOrderNumber(o.number, settings);
  const commissionPct = Number(o.commission_pct ?? 0);

  // Notas fiscais do pedido (antes da migração 009, a lista vem vazia).
  const { data: invData } = await supabase
    .from("order_invoices")
    .select("id, number, series, issued_at, value, file_path, file_name, notes, order_invoice_items(order_item_id, qty), commissions(value, pct, due_date, status, received_at)")
    .eq("order_id", id)
    .order("issued_at");
  type Inv = {
    id: string; number: string | null; series: string | null; issued_at: string; value: number;
    file_path: string | null; file_name: string | null; notes: string | null;
    order_invoice_items: { order_item_id: string; qty: number }[];
    commissions: { value: number; pct: number; due_date: string; status: string; received_at: string | null }[];
  };
  const invoices = (invData ?? []) as unknown as Inv[];
  const invoicedQty = new Map<string, number>();
  for (const inv of invoices) {
    for (const l of inv.order_invoice_items) invoicedQty.set(l.order_item_id, (invoicedQty.get(l.order_item_id) ?? 0) + Number(l.qty));
  }
  const totalQty = (items ?? []).reduce((s, i) => s + Number(i.qty), 0);
  const doneQty = [...invoicedQty.values()].reduce((s, q) => s + q, 0);
  const invoicedTotal = invoices.reduce((s, i) => s + Number(i.value), 0);
  const fullyInvoiced = totalQty > 0 && doneQty >= totalQty - 1e-9;
  const canInvoice =
    (o.status === "enviado" || (o.status === "faturado" && !fullyInvoiced)) && (isBackOffice || mine);

  const editor = editable ? await loadEditorData() : null;

  return (
    <>
      <PageHeader
        back={{ href: PATH, label: "Pedidos" }}
        title={`Pedido ${label}`}
        meta={
          <>
            <Badge tone={st.tone} dot>
              {st.label}
            </Badge>
            {customer ? (
              <Link href={`/clientes/${customer.id}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                <Icon name="users" size={14} className="text-faint" />
                {customer.name}
              </Link>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Icon name="factory" size={14} className="text-faint" />
              {principal?.name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" size={14} className="text-faint" />
              {formatDate(o.order_date)}
            </span>
          </>
        }
        action={
          <>
            <Link href={`/imprimir/pedido/${id}`} target="_blank" className={ghostBtn} title="Imprimir ou salvar em PDF">
              <Icon name="printer" size={15} />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </Link>
            {role !== "finance" ? (
              <form action={duplicateOrder.bind(null, id)}>
                <SubmitButton className={ghostBtn} pending="Duplicando…">
                  <Icon name="copy" size={15} />
                  <span className="hidden sm:inline">Duplicar</span>
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      <div className="mb-4 grid gap-3 empty:hidden">
        {!sp.faturar ? <ErrorNote message={sp.erro} /> : null}
        <OkNote message={sp.ok} />
      </div>

      {/* ---------- Andamento ---------- */}
      <section className="mb-5 rounded-xl border border-line bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Stepper
            status={o.status}
            steps={[
              { label: "Rascunho", date: String(o.created_at).slice(0, 10), icon: "edit" },
              { label: "Enviado", date: o.sent_at ? String(o.sent_at).slice(0, 10) : null, icon: "send" },
              { label: "Faturado", date: o.invoiced_at, icon: "check" },
            ]}
          />

          <div className="flex flex-wrap gap-2">
            {o.status === "rascunho" && canOwn ? (
              <>
                {!editable ? (
                  <form action={sendOrder.bind(null, id)}>
                    <SubmitButton className={primaryBtn} pending="Enviando…">Enviar pedido</SubmitButton>
                  </form>
                ) : null}
                <form action={deleteDraft.bind(null, id)}>
                  <ConfirmButton message="Excluir este rascunho? Essa ação não pode ser desfeita." className={dangerBtn}>
                    <Icon name="trash" size={15} />
                    Excluir rascunho
                  </ConfirmButton>
                </form>
              </>
            ) : null}

            {o.status === "enviado" ? (
              <>
                {canInvoice ? (
                  <Link href={`${here}?faturar=1`} scroll={false} className={primaryBtn}>
                    <Icon name="receipt" size={15} />
                    Marcar como faturado
                  </Link>
                ) : null}
                {canOwn ? (
                  <form action={reopenOrder.bind(null, id)}>
                    <SubmitButton className={ghostBtn} pending="Voltando…">Voltar para rascunho</SubmitButton>
                  </form>
                ) : null}
              </>
            ) : null}

            {(o.status === "enviado" || o.status === "faturado") && canOwn ? (
              <form action={cancelOrder.bind(null, id)}>
                <ConfirmButton
                  message={
                    o.status === "faturado"
                      ? "Cancelar este pedido também cancela a comissão. Continuar?"
                      : "Cancelar este pedido?"
                  }
                  className={dangerBtn}
                >
                  Cancelar pedido
                </ConfirmButton>
              </form>
            ) : null}
          </div>
        </div>

        {o.status === "cancelado" ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-alert-soft px-3 py-2.5 text-[13px] text-alert">
            <Icon name="alert" size={15} />
            Pedido cancelado{o.cancel_reason ? `: ${o.cancel_reason}` : "."}
            {o.invoiced_at ? " A comissão deste pedido foi cancelada." : ""}
          </p>
        ) : null}
      </section>

      {invoices.length > 0 || canInvoice ? (
        <Billing
          invoices={invoices}
          items={items ?? []}
          invoicedQty={invoicedQty}
          total={Number(o.total)}
          invoicedTotal={invoicedTotal}
          progress={totalQty ? Math.min(doneQty / totalQty, 1) : 0}
          canInvoice={canInvoice}
          canDelete={isBackOffice || mine}
          newHref={`${here}?faturar=1`}
          deleteAction={(invoiceId: string) => deleteInvoice.bind(null, id, invoiceId)}
        />
      ) : null}

      {editable && editor ? (
        <OrderEditor
          initial={{
            id,
            customer_id: o.customer_id,
            principal_id: o.principal_id,
            order_date: o.order_date,
            expected_delivery: o.expected_delivery ?? "",
            payment_terms: o.payment_terms ?? "",
            freight_mode: o.freight_mode ?? "",
            freight_value: Number(o.freight_value) ? priceText(Number(o.freight_value)) : "",
            discount_pct: Number(o.discount_pct) ? numText(Number(o.discount_pct), 2) : "",
            commission_pct: o.commission_pct != null ? numText(commissionPct, 2) : "",
            notes: o.notes ?? "",
            items: (items ?? []).map((i) => ({
              variant_id: i.variant_id,
              code: i.code ?? "",
              description: i.description,
              unit: i.unit,
              qty: numText(Number(i.qty), 3),
              price: priceText(Number(i.list_price)),
              discount: Number(i.discount_pct) ? numText(Number(i.discount_pct), 2) : "",
            })),
          }}
          customers={editor.customers}
          principals={editor.principals}
          products={editor.products}
          units={editor.units}
          defaultUnit={editor.defaultUnit}
        />
      ) : (
        <OrderView
          o={o}
          items={items ?? []}
          invoicedQty={o.status === "rascunho" ? null : invoicedQty}
          customer={customer}
          principalName={principal?.name ?? ""}
          sellerName={sellerName}
        />
      )}

      <Sheet
        open={sp.faturar === "1" && canInvoice}
        title={invoices.length ? "Registrar nova nota fiscal" : "Marcar como faturado"}
        description="Informe a nota emitida pela representada. A comissão desta nota fica a receber."
        closeHref={here}
      >
        <SheetForm action={registerInvoice.bind(null, id)} closeHref={here} submitLabel="Registrar faturamento">
          <ErrorNote message={sp.erro} />
          <InvoiceFields
            today={todayISO()}
            discountPct={Number(o.discount_pct)}
            items={(items ?? []).map((i) => ({
              id: i.id,
              code: i.code ?? "",
              description: i.description,
              unit: i.unit,
              qty: Number(i.qty),
              unitPrice: Number(i.unit_price),
              invoiced: invoicedQty.get(i.id) ?? 0,
            }))}
          />
          <p className="rounded-lg bg-ok-soft px-3 py-2.5 text-[13px] text-ok sm:col-span-2">
            Comissão de {numText(commissionPct, 2)}% sobre o valor faturado.
          </p>
        </SheetForm>
      </Sheet>
    </>
  );
}

/* ---------- Partes da tela ---------- */

function Stepper({
  status,
  steps,
}: {
  status: string;
  steps: { label: string; date: string | null; icon: IconName }[];
}) {
  const current = status === "rascunho" ? 0 : status === "enviado" ? 1 : status === "cancelado" ? -1 : 2;
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {steps.map((s, i) => {
        const done = current >= i;
        const active = current === i;
        return (
          <li key={s.label} className="flex items-center gap-2 sm:gap-3">
            {i > 0 ? <span className={`h-px w-4 sm:w-10 ${current >= i ? "bg-pen" : "bg-line-strong"}`} /> : null}
            <span className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  status === "cancelado"
                    ? "bg-hover text-faint"
                    : done
                      ? active
                        ? "bg-pen text-white ring-4 ring-pen/15"
                        : "bg-pen text-white"
                      : "border border-line-strong bg-white text-faint"
                }`}
              >
                <Icon name={done && !active ? "check" : s.icon} size={13} strokeWidth={2.2} />
              </span>
              <span className="leading-tight">
                <span className={`block text-[13px] font-medium ${done && status !== "cancelado" ? "text-ink" : "text-muted"}`}>{s.label}</span>
                <span className="block text-[11px] tabular-nums text-muted">{s.date && done ? formatDate(s.date).slice(0, 5) : "—"}</span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const commissionStatus: Record<string, { label: string; tone: "warn" | "ok" | "alert" }> = {
  a_receber: { label: "A receber", tone: "warn" },
  recebida: { label: "Recebida", tone: "ok" },
  cancelada: { label: "Cancelada", tone: "alert" },
};

// Faturamento do pedido: notas fiscais, quantidades, arquivo e comissão de cada uma.
function Billing({
  invoices,
  items,
  invoicedQty,
  total,
  invoicedTotal,
  progress,
  canInvoice,
  canDelete,
  newHref,
  deleteAction,
}: {
  invoices: {
    id: string; number: string | null; series: string | null; issued_at: string; value: number;
    file_path: string | null; file_name: string | null; notes: string | null;
    order_invoice_items: { order_item_id: string; qty: number }[];
    commissions: { value: number; pct: number; due_date: string; status: string; received_at: string | null }[];
  }[];
  items: { id: string; description: string; unit: string; qty: number }[];
  invoicedQty: Map<string, number>;
  total: number;
  invoicedTotal: number;
  progress: number;
  canInvoice: boolean;
  canDelete: boolean;
  newHref: string;
  deleteAction: (invoiceId: string) => () => Promise<void>;
}) {
  const desc = new Map(items.map((i) => [i.id, i]));
  const today = todayISO();
  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-line bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            Faturamento <span className="ml-1 font-normal text-muted">{invoices.length} {invoices.length === 1 ? "nota" : "notas"}</span>
          </h2>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="block h-1.5 w-32 overflow-hidden rounded-full bg-active sm:w-48">
              <span className="block h-full rounded-full bg-ok" style={{ width: `${progress * 100}%` }} />
            </span>
            <span className="text-xs tabular-nums text-muted">
              {brl(invoicedTotal)} de {brl(total)} · {Math.round(progress * 100)}% das quantidades
            </span>
          </div>
        </div>
        {canInvoice && invoices.length > 0 ? (
          <Link href={newHref} scroll={false} className={ghostBtn}>
            <Icon name="plus" size={15} strokeWidth={2} />
            Nova nota
          </Link>
        ) : null}
      </header>

      {invoices.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted sm:px-5">
          Nenhuma nota fiscal ainda. Quando a representada faturar, use <span className="font-medium text-ink-2">Marcar como faturado</span>.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {invoices.map((inv) => {
            const c = inv.commissions[0];
            const cs = c ? commissionStatus[c.status] : null;
            const late = c?.status === "a_receber" && c.due_date < today;
            const qty = inv.order_invoice_items.reduce((s, l) => s + Number(l.qty), 0);
            return (
              <li key={inv.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ok-soft text-ok">
                    <Icon name="receipt" size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      NF {inv.number || "sem número"}
                      {inv.series ? <span className="font-normal text-muted"> · série {inv.series}</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(inv.issued_at)}
                      {qty ? ` · ${numText(qty, 3)} un. em ${inv.order_invoice_items.length} ${inv.order_invoice_items.length === 1 ? "item" : "itens"}` : ""}
                      {inv.notes ? ` · ${inv.notes}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{brl(Number(inv.value))}</p>
                  {c && cs ? (
                    <span className="flex flex-col items-end">
                      <Badge tone={late ? "alert" : cs.tone} dot>
                        Comissão {brl(Number(c.value))}
                      </Badge>
                      <span className={`mt-0.5 text-[11px] ${late ? "text-alert" : "text-muted"}`}>
                        {c.status === "recebida" && c.received_at
                          ? `Recebida em ${formatDate(c.received_at)}`
                          : c.status === "cancelada"
                            ? "Cancelada"
                            : `${late ? "Atrasada · venceu" : "Vence"} em ${formatDate(c.due_date)}`}
                      </span>
                    </span>
                  ) : null}
                  <div className="flex items-center">
                    {inv.file_path ? (
                      <>
                        <a href={`/nf/${inv.id}`} target="_blank" rel="noopener noreferrer" className={iconBtn} title="Ver nota fiscal">
                          <Icon name="file" size={16} />
                          <span className="sr-only">Ver nota fiscal</span>
                        </a>
                        <a href={`/nf/${inv.id}?baixar=1`} className={iconBtn} title={`Baixar ${inv.file_name ?? "arquivo da nota"}`}>
                          <Icon name="download" size={16} />
                          <span className="sr-only">Baixar arquivo da nota</span>
                        </a>
                      </>
                    ) : (
                      <span className="px-2 text-[11px] text-faint" title="Nenhum arquivo anexado">sem PDF</span>
                    )}
                    {canDelete && c?.status !== "recebida" ? (
                      <form action={deleteAction(inv.id)}>
                        <ConfirmButton
                          message={`Excluir a NF ${inv.number ?? ""}? A comissão dela também será apagada.`}
                          className={`${iconBtn} hover:!text-alert`}
                        >
                          <Icon name="trash" size={15} />
                          <span className="sr-only">Excluir nota</span>
                        </ConfirmButton>
                      </form>
                    ) : null}
                  </div>
                </div>
                {inv.order_invoice_items.length ? (
                  <details className="group mt-2 sm:ml-[3.25rem]">
                    <summary className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-ink">
                      <Icon name="chevron-right" size={12} className="transition group-open:rotate-90" />
                      Ver quantidades
                    </summary>
                    <ul className="mt-2 grid gap-1 rounded-lg bg-subtle p-3 text-[13px]">
                      {inv.order_invoice_items.map((l) => {
                        const it = desc.get(l.order_item_id);
                        return (
                          <li key={l.order_item_id} className="flex justify-between gap-3">
                            <span className="truncate text-ink-2">{it?.description ?? "Item removido"}</span>
                            <span className="shrink-0 tabular-nums">
                              {numText(Number(l.qty), 3)}
                              <span className="text-muted"> / {numText(Number(it?.qty ?? 0), 3)} {it ? unitLabel(it.unit).toLowerCase() : ""}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type OrderRow = Record<string, unknown> & {
  order_date: string; expected_delivery: string | null; payment_terms: string | null; freight_mode: string | null;
  freight_value: number; discount_pct: number; commission_pct: number | null; notes: string | null; invoice_number: string | null;
};
type ItemRow = {
  id: string; code: string | null; description: string; unit: string; qty: number; list_price: number;
  discount_pct: number; line_total: number;
};

// Pedido já enviado: só leitura.
function OrderView({
  o,
  items,
  invoicedQty,
  customer,
  principalName,
  sellerName,
}: {
  o: OrderRow;
  items: ItemRow[];
  invoicedQty: Map<string, number> | null;
  customer: { id: string; name: string } | null;
  principalName: string;
  sellerName: string;
}) {
  const t = orderTotals(
    items.map((i) => ({ qty: Number(i.qty), price: Number(i.list_price), discount: Number(i.discount_pct) })),
    Number(o.discount_pct),
    Number(o.freight_value),
    Number(o.commission_pct ?? 0),
  );
  return (
    <div className="grid gap-5">
      <section className="rounded-xl border border-line bg-white p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold">Dados do pedido</h2>
        <div className="grid gap-x-10 sm:grid-cols-2">
          <Properties>
            <Property label="Cliente">
              {customer ? <Link href={`/clientes/${customer.id}`} className="text-pen hover:underline">{customer.name}</Link> : null}
            </Property>
            <Property label="Representada">{principalName}</Property>
            <Property label="Data">{formatDate(o.order_date)}</Property>
            <Property label="Vendedor">{sellerName}</Property>
          </Properties>
          <Properties>
            <Property label="Pagamento">{o.payment_terms}</Property>
            <Property label="Previsão de entrega">{o.expected_delivery ? formatDate(o.expected_delivery) : null}</Property>
            <Property label="Frete">
              {o.freight_mode ? `${o.freight_mode.toUpperCase()}${Number(o.freight_value) ? ` · ${brl(Number(o.freight_value))}` : ""}` : null}
            </Property>
            <Property label="Nota fiscal">{o.invoice_number}</Property>
          </Properties>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <header className="border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">
            Itens <span className="ml-1 font-normal text-muted">{items.length}</span>
          </h2>
        </header>
        <table className="hidden w-full text-sm md:table">
          <thead className="border-b border-line bg-subtle text-xs text-muted">
            <tr>
              <th className="w-10 py-2 pl-5 text-left font-medium">#</th>
              <th className="w-28 px-2 py-2 text-left font-medium">Código</th>
              <th className="px-2 py-2 text-left font-medium">Produto</th>
              <th className="w-24 px-2 py-2 text-left font-medium">Unid.</th>
              <th className="w-24 px-2 py-2 text-right font-medium">Qtd.</th>
              <th className="w-28 px-2 py-2 text-right font-medium">Preço unit.</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Desc.</th>
              {invoicedQty ? <th className="w-28 px-2 py-2 text-right font-medium">Faturado</th> : null}
              <th className="w-32 py-2 pl-2 pr-5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, n) => (
              <tr key={i.id} className="border-b border-line last:border-b-0">
                <td className="py-3 pl-5 text-xs tabular-nums text-faint">{n + 1}</td>
                <td className="px-2 py-3 font-mono text-[13px] text-muted">{i.code || "—"}</td>
                <td className="px-2 py-3 font-medium">{i.description}</td>
                <td className="px-2 py-3 text-ink-2">{unitLabel(i.unit)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{numText(Number(i.qty), 3)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{brl(Number(i.list_price))}</td>
                <td className="px-2 py-3 text-right tabular-nums text-ink-2">
                  {Number(i.discount_pct) ? `${numText(Number(i.discount_pct), 2)}%` : "—"}
                </td>
                {invoicedQty ? (
                  <td className="px-2 py-3 text-right">
                    <InvoicedCell done={invoicedQty.get(i.id) ?? 0} total={Number(i.qty)} />
                  </td>
                ) : null}
                <td className="py-3 pl-2 pr-5 text-right font-medium tabular-nums">{brl(Number(i.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="divide-y divide-line md:hidden">
          {items.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium leading-snug">{i.description}</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {numText(Number(i.qty), 3)} {unitLabel(i.unit).toLowerCase()} × {brl(Number(i.list_price))}
                  {Number(i.discount_pct) ? ` · −${numText(Number(i.discount_pct), 2)}%` : ""}
                </p>
                {invoicedQty ? (
                  <div className="mt-1">
                    <InvoicedCell done={invoicedQty.get(i.id) ?? 0} total={Number(i.qty)} left />
                  </div>
                ) : null}
              </div>
              <p className="shrink-0 font-semibold tabular-nums">{brl(Number(i.line_total))}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-xl border border-line bg-white p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-semibold">Observações</h2>
          {o.notes ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{o.notes}</p>
          ) : (
            <p className="text-sm text-faint">Nenhuma observação.</p>
          )}
        </section>
        <section className="rounded-xl border border-line bg-white p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold">Resumo</h2>
          <dl className="grid gap-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{brl(t.subtotal)}</dd>
            </div>
            {t.discountValue ? (
              <div className="flex justify-between">
                <dt className="text-muted">Desconto geral ({numText(Number(o.discount_pct), 2)}%)</dt>
                <dd className="tabular-nums">− {brl(t.discountValue)}</dd>
              </div>
            ) : null}
            {Number(o.freight_value) ? (
              <div className="flex justify-between">
                <dt className="text-muted">Frete</dt>
                <dd className="tabular-nums">{brl(Number(o.freight_value))}</dd>
              </div>
            ) : null}
            <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-medium">Total do pedido</dt>
              <dd className="text-xl font-semibold tabular-nums tracking-[-0.02em]">{brl(t.total)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex items-baseline justify-between rounded-lg bg-ok-soft p-3">
            <span className="text-[13px] text-ok">Comissão prevista ({numText(Number(o.commission_pct ?? 0), 2)}%)</span>
            <span className="text-lg font-semibold tabular-nums text-ok">{brl(t.commission)}</span>
          </div>
        </section>
      </div>
    </div>
  );
}

// Quanto do item já foi faturado: "60 / 120" com barrinha.
function InvoicedCell({ done, total, left }: { done: number; total: number; left?: boolean }) {
  const share = total ? Math.min(done / total, 1) : 0;
  return (
    <span className={`inline-flex flex-col gap-1 ${left ? "items-start" : "items-end"}`}>
      <span className={`text-xs tabular-nums ${share >= 1 ? "font-medium text-ok" : share > 0 ? "text-ink-2" : "text-faint"}`}>
        {numText(done, 3)} / {numText(total, 3)}
      </span>
      <span className="block h-1 w-14 overflow-hidden rounded-full bg-active">
        <span className="block h-full rounded-full bg-ok" style={{ width: `${share * 100}%` }} />
      </span>
    </span>
  );
}
