import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import {
  sendOrder, reopenOrder, cancelOrder, deleteDraft, duplicateOrder,
} from "./actions";
import { registerInvoice, finalizeOrder, reopenFinalized } from "./invoices";
import { orderAging } from "@/lib/aging";
import { InvoiceFields } from "./invoice-fields";
import { formatOrderNumber, numText, orderTotals, priceText, statusInfo } from "@/lib/orders";
import { brl, formatDate, todayISO } from "@/lib/format";
import { unitLabel } from "@/lib/units";
import { loadEditorData } from "../data";
import { OrderEditor } from "../editor";
import { InvoicePanel } from "../../faturamento/invoice-panel";
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
  searchParams: Promise<{ erro?: string; ok?: string; faturar?: string; finalizar?: string; nota?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, canManage, isBackOffice, role, canSeeCommissions } = await getContext();
  const settings = await getSettings();

  const { data: o } = await supabase
    .from("orders")
    .select("*, customers(id, name, cnpj), principals(name, cnpj, commission_close_mode, commission_days_after)")
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
  const customer = o.customers as unknown as { id: string; name: string; cnpj: string | null } | null;
  const principal = o.principals as unknown as {
    name: string; cnpj: string | null; commission_close_mode: string; commission_days_after: number | null;
  } | null;
  // Pedido importado: o vendedor do sistema antigo vem pelo nome até ele ter login.
  const sellerName = (o.seller_name as string | null) || seller?.full_name || seller?.email || "";
  const label = formatOrderNumber(o.number, settings);
  const commissionPct = Number(o.commission_pct ?? 0);

  // Notas fiscais do pedido (antes da migração 009, a lista vem vazia).
  // Com os itens da nota (025) e as parcelas (021); sem essas migrações, carrega com o que houver.
  const invBase =
    "id, number, series, issued_at, value, file_path, file_name, notes, order_invoice_items(order_item_id, qty), commissions(value, pct, due_date, status, received_at)";
  const full = await supabase
    .from("order_invoices")
    .select(`${invBase}, order_invoice_lines(qty, unit), order_invoice_installments(due_date, position)`)
    .eq("order_id", id)
    .order("issued_at");
  const invData: unknown[] | null = full.error
    ? (await supabase.from("order_invoices").select(invBase).eq("order_id", id).order("issued_at")).data
    : full.data;
  type Inv = {
    id: string; number: string | null; series: string | null; issued_at: string; value: number;
    file_path: string | null; file_name: string | null; notes: string | null;
    order_invoice_items: { order_item_id: string; qty: number }[];
    commissions: { value: number; pct: number; due_date: string; status: string; received_at: string | null }[];
    order_invoice_lines?: { qty: number; unit: string | null }[];
    order_invoice_installments?: { due_date: string; position: number }[];
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
  const canInvoice = (o.status === "enviado" || (o.status === "parcial" && !fullyInvoiced)) && (isBackOffice || mine);
  const aging = orderAging(o, settings.warnDays, settings.criticalDays, todayISO());
  const leftQty = Math.max(totalQty - doneQty, 0);

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
            <a href={`/pedidos/${id}/pdf`} download className={ghostBtn} title="Baixar o pedido em PDF">
              <Icon name="download" size={15} />
              <span className="hidden sm:inline">Baixar PDF</span>
            </a>
            <Link href={`/imprimir/pedido/${id}`} target="_blank" className={ghostBtn} title="Imprimir">
              <Icon name="printer" size={15} />
              <span className="hidden sm:inline">Imprimir</span>
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

      {/* ---------- Aviso de atraso ---------- */}
      {aging && aging.level !== "ok" ? (
        <div
          className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            aging.level === "critico" ? "border-alert/30 bg-alert-soft text-alert" : "border-warn-dot/40 bg-warn-soft text-warn"
          }`}
        >
          <Icon name="alert" size={18} />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">Pedido atrasado:</span> a entrega estava prevista para{" "}
            {formatDate(o.expected_delivery)}, há <span className="font-semibold">{aging.days} dias</span>.
          </span>
        </div>
      ) : null}

      {/* ---------- Andamento ---------- */}
      <section className="mb-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Stepper
            status={o.status}
            steps={[
              { label: "Rascunho", date: String(o.created_at).slice(0, 10), icon: "edit" },
              { label: "Enviado", date: o.sent_at ? String(o.sent_at).slice(0, 10) : null, icon: "send" },
              { label: o.status === "parcial" ? "Faturado parcial" : "Faturado", date: o.invoiced_at, icon: "check" },
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

            {o.status === "enviado" || o.status === "parcial" ? (
              <>
                {canInvoice ? (
                  <Link href={`${here}?faturar=1`} scroll={false} className={primaryBtn}>
                    <Icon name="receipt" size={15} />
                    {o.status === "parcial" ? "Lançar nova nota" : "Marcar como faturado"}
                  </Link>
                ) : null}
                {o.status === "parcial" && (isBackOffice || mine) ? (
                  <Link href={`${here}?finalizar=1`} scroll={false} className={ghostBtn}>
                    <Icon name="check" size={15} strokeWidth={2} />
                    Finalizar pedido
                  </Link>
                ) : null}
                {canOwn && o.status === "enviado" ? (
                  <form action={reopenOrder.bind(null, id)}>
                    <SubmitButton className={ghostBtn} pending="Voltando…">Voltar para rascunho</SubmitButton>
                  </form>
                ) : null}
              </>
            ) : null}

            {(o.status === "enviado" || o.status === "parcial" || o.status === "faturado") && canOwn ? (
              <form action={cancelOrder.bind(null, id)}>
                <ConfirmButton
                  message={
                    o.status !== "enviado"
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

        {o.closed_at && o.status === "faturado" ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-subtle px-3 py-2.5 text-[13px] text-ink-2">
            <Icon name="info" size={15} className="text-muted" />
            <span className="min-w-0 flex-1">
              Finalizado manualmente em {formatDate(String(o.closed_at).slice(0, 10))}
              {leftQty > 0 ? ` com saldo de ${numText(leftQty, 3)} un. não faturado` : ""}
              {o.close_note ? ` · ${o.close_note}` : "."}
            </span>
            {isBackOffice || mine ? (
              <form action={reopenFinalized.bind(null, id)}>
                <SubmitButton className={ghostBtn} pending="Reabrindo…">Reabrir</SubmitButton>
              </form>
            ) : null}
          </div>
        ) : null}

        {o.status === "cancelado" ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-alert-soft px-3 py-2.5 text-[13px] text-alert">
            <Icon name="alert" size={15} />
            Pedido cancelado{o.cancel_reason ? `: ${o.cancel_reason}` : "."}
            {o.invoiced_at ? " A comissão deste pedido foi cancelada." : ""}
          </p>
        ) : null}
      </section>


      {editable && editor ? (
        <OrderEditor
          showCommission={canSeeCommissions}
          initial={{
            id,
            seller_id: o.seller_id,
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
              options: (i.options as Record<string, string> | null) ?? null,
            })),
          }}
          customers={editor.customers}
          principals={editor.principals}
          products={editor.products}
          sellers={editor.sellers}
          priceHistory={editor.priceHistory}
          principalLists={editor.principalLists}
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

      {/* Faturamento por último: aqui só se consulta; editar ou excluir a nota é na área de Faturamento. */}
      {invoices.length > 0 || canInvoice ? (
        <Billing
          invoices={invoices}
          items={items ?? []}
          invoicedQty={invoicedQty}
          total={Number(o.total)}
          invoicedTotal={invoicedTotal}
          progress={totalQty ? Math.min(doneQty / totalQty, 1) : 0}
          canInvoice={canInvoice}
          newHref={`${here}?faturar=1`}
          noteHref={(nid) => `${here}?nota=${nid}`}
          unit={items?.[0]?.unit ?? "unidade"}
        />
      ) : null}

      {/* A nota abre aqui mesmo, por cima do pedido (só para consulta; excluir é no Faturamento). */}
      {sp.nota ? <InvoicePanel invoiceId={sp.nota} closeHref={here} fromOrder /> : null}

      <Sheet
        open={sp.faturar === "1" && canInvoice}
        title={invoices.length ? "Registrar nova nota fiscal" : "Marcar como faturado"}
        description="Informe a nota emitida pela representada."
        closeHref={here}
      >
        <SheetForm action={registerInvoice.bind(null, id)} closeHref={here} submitLabel="Registrar faturamento">
          <ErrorNote message={sp.erro} />
          <InvoiceFields
            paymentTerms={o.payment_terms}
            expected={{ principalCnpj: principal?.cnpj ?? null, customerCnpj: customer?.cnpj ?? null }}
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
        </SheetForm>
      </Sheet>

      <Sheet
        open={sp.finalizar === "1" && o.status === "parcial"}
        title="Finalizar pedido"
        description={`O saldo de ${numText(leftQty, 3)} un. não será mais faturado e o pedido passa a "Faturado".`}
        closeHref={here}
      >
        <SheetForm action={finalizeOrder.bind(null, id)} closeHref={here} submitLabel="Finalizar pedido">
          <Field label="Motivo (opcional)" className="sm:col-span-2" hint="Ex.: fábrica sem estoque do restante, cliente desistiu do saldo.">
            <input name="close_note" className={inputCls} />
          </Field>
          <p className="rounded-lg bg-subtle px-3 py-2.5 text-[13px] text-ink-2 sm:col-span-2">
            As comissões das notas já lançadas continuam valendo. Se mudar de ideia, dá para reabrir depois.
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
                        ? "bg-pen text-on-pen ring-4 ring-pen/15"
                        : "bg-pen text-on-pen"
                      : "border border-line-strong bg-surface text-faint"
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

// Faturamento do pedido: as notas numa tabela (NF, emissão, quantidade, valor, vencimentos, arquivo).
// Clicar numa nota abre o painel dela aqui mesmo.
function Billing({
  invoices,
  total,
  invoicedTotal,
  canInvoice,
  newHref,
  noteHref,
  unit,
}: {
  invoices: {
    id: string; number: string | null; series: string | null; issued_at: string; value: number;
    file_path: string | null; file_name: string | null; notes: string | null;
    order_invoice_items: { order_item_id: string; qty: number }[];
    order_invoice_lines?: { qty: number; unit: string | null }[];
    order_invoice_installments?: { due_date: string; position: number }[];
  }[];
  items: { id: string; description: string; unit: string; qty: number }[];
  invoicedQty: Map<string, number>;
  total: number;
  invoicedTotal: number;
  progress: number;
  canInvoice: boolean;
  newHref: string;
  noteHref: (id: string) => string;
  unit: string;
}) {
  // Quantidade da nota: a soma dos itens da NF (025); nas notas antigas, a soma ligada aos itens do pedido.
  const qtyOf = (inv: (typeof invoices)[number]) =>
    inv.order_invoice_lines?.length
      ? inv.order_invoice_lines.reduce((s, l) => s + Number(l.qty), 0)
      : inv.order_invoice_items.reduce((s, l) => s + Number(l.qty), 0);
  const dues = (inv: (typeof invoices)[number]) =>
    [...(inv.order_invoice_installments ?? [])].sort((a, b) => a.position - b.position).map((x) => formatDate(x.due_date));
  const totalQty = invoices.reduce((s, i) => s + qtyOf(i), 0);
  const pct = total ? Math.min(invoicedTotal / total, 1) : 0;
  const left = Math.max(total - invoicedTotal, 0);
  const u = unitLabel(unit).toLowerCase();

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">
          Faturamento <span className="ml-1 font-normal text-muted">{invoices.length} {invoices.length === 1 ? "nota" : "notas"}</span>
        </h2>
      </header>

      {invoices.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted sm:px-5">
          Nenhuma nota fiscal ainda. Quando a representada faturar, use <span className="font-medium text-ink-2">Marcar como faturado</span>.
        </p>
      ) : (
        <>
          {/* Resumo: quanto já foi faturado e quanto falta */}
          <dl className="grid grid-cols-2 border-b border-line sm:grid-cols-4 [&>div]:px-4 [&>div]:py-3 sm:[&>div]:px-5">
            <div>
              <dt className="text-xs text-muted">Faturado</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums">{brl(invoicedTotal)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Do pedido</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums">{brl(total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Falta faturar</dt>
              <dd className={`mt-0.5 text-base font-semibold tabular-nums ${left > 0.005 ? "" : "text-ok"}`}>{left > 0.005 ? brl(left) : "Nada"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Quantidade nas notas</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums">
                {numText(totalQty, 3) || "0"} <span className="text-xs font-normal text-muted">{u}</span>
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-4 !pt-0">
              <span className="flex items-center gap-2.5">
                <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-active">
                  <span className="block h-full rounded-full bg-ok" style={{ width: `${pct * 100}%` }} />
                </span>
                <span className="text-xs tabular-nums text-muted">{Math.round((invoicedTotal / (total || 1)) * 100)}% do valor</span>
              </span>
            </div>
          </dl>

          {/* Computador: tabela */}
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-subtle text-xs text-muted">
              <tr>
                <th className="py-2 pl-5 text-left font-medium">Nota fiscal</th>
                <th className="px-3 py-2 text-left font-medium">Emissão</th>
                <th className="px-3 py-2 text-right font-medium">Quantidade</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-left font-medium">Vencimentos</th>
                <th className="w-24 pr-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoices.map((inv) => {
                const q = qtyOf(inv);
                const d = dues(inv);
                return (
                  <tr key={inv.id} className="group relative transition-colors hover:bg-subtle">
                    <td className="py-2.5 pl-5">
                      <Link href={noteHref(inv.id)} scroll={false} className="font-medium after:absolute after:inset-0 group-hover:text-accent-ink">
                        NF {inv.number || "sem número"}
                      </Link>
                      {inv.notes ? <span className="block max-w-[16rem] truncate text-xs text-muted">{inv.notes}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-ink-2">{formatDate(inv.issued_at)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{q ? `${numText(q, 3)} ${u}` : <span className="text-faint">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{brl(Number(inv.value))}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-ink-2">{d.length ? d.join(" · ") : <span className="text-faint">—</span>}</td>
                    <td className="relative z-10 pr-5 text-right">
                      <span className="inline-flex items-center">
                        {inv.file_path ? (
                          <a href={`/nf/${inv.id}?baixar=1`} className={iconBtn} title={`Baixar ${inv.file_name ?? "arquivo da nota"}`}>
                            <Icon name="download" size={15} />
                            <span className="sr-only">Baixar arquivo da nota</span>
                          </a>
                        ) : null}
                        <Icon name="chevron-right" size={16} className="ml-1 text-faint group-hover:text-ink" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-line-strong bg-subtle text-sm">
              <tr>
                <td className="py-2.5 pl-5 font-medium" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">{numText(totalQty, 3)} {u}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{brl(invoicedTotal)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>

          {/* Celular: uma linha por nota */}
          <ul className="divide-y divide-line md:hidden">
            {invoices.map((inv) => {
              const q = qtyOf(inv);
              const d = dues(inv);
              return (
                <li key={inv.id}>
                  <Link href={noteHref(inv.id)} scroll={false} className="flex items-center gap-3 px-4 py-3 active:bg-hover">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium">NF {inv.number || "sem número"}</span>
                        <span className="text-sm font-semibold tabular-nums">{brl(Number(inv.value))}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {formatDate(inv.issued_at)}
                        {q ? ` · ${numText(q, 3)} ${u}` : ""}
                        {d.length ? ` · vence ${d.join(", ")}` : ""}
                      </span>
                    </span>
                    <Icon name="chevron-right" size={16} className="text-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
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
      <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
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

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
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
                <td className="px-2 py-3 text-right tabular-nums">
                  {brl(Number(i.list_price))}
                  {/* Desconto do item, quando houver, junto do preço */}
                  {Number(i.discount_pct) ? <span className="block text-xs text-muted">−{numText(Number(i.discount_pct), 2)}%</span> : null}
                </td>
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
              </div>
              <p className="shrink-0 font-semibold tabular-nums">{brl(Number(i.line_total))}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-semibold">Observações</h2>
          {o.notes ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{o.notes}</p>
          ) : (
            <p className="text-sm text-faint">Nenhuma observação.</p>
          )}
        </section>
        <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
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
        </section>
      </div>
    </div>
  );
}

