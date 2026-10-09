import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import {
  updateOrder, addItem, updateItem, deleteItem, sendOrder, reopenOrder, markInvoiced,
  markDelivered, cancelOrder, deleteDraft,
} from "./actions";
import { statusInfo } from "@/lib/orders";
import { brl, formatDate, todayISO } from "@/lib/format";
import { unitLabel } from "@/lib/units";
import { Icon, type IconName } from "@/components/icons";
import {
  PageHeader, Field, ErrorNote, OkNote, Badge, inputCls, primaryBtn, ghostBtn,
} from "@/components/ui";
import type { ReactNode } from "react";

const PATH = "/pedidos";
const grid = "grid gap-4 sm:grid-cols-2";

function Section({ icon, title, hint, children }: { icon: IconName; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-subtle text-pen">
          <Icon name={icon} size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {hint ? <p className="mt-0.5 text-[13px] leading-snug text-muted">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

const pct = (n: number) => `${String(n).replace(".", ",")}%`;
const qtyFmt = (n: number) => String(n).replace(".", ",");

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getContext();
  const { supabase, user, canManage, isBackOffice } = ctx;

  const { data: o } = await supabase
    .from("orders")
    .select("*, customers(name), principals(name)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();

  const [{ data: items }, { data: tables }, { data: priceItems }, { data: seller }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).order("position"),
    supabase.from("price_tables").select("id, name, valid_from, valid_to").eq("principal_id", o.principal_id).order("valid_from", { ascending: false }),
    o.price_table_id
      ? supabase
          .from("price_items")
          .select("variant_id, price, product_variants(code, attributes, products(name, unit, min_order_qty, order_multiple))")
          .eq("price_table_id", o.price_table_id)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("members").select("full_name, email").eq("user_id", o.seller_id).eq("org_id", o.org_id).maybeSingle(),
  ]);

  const st = statusInfo(o.status);
  const mine = o.seller_id === user.id;
  const editable = o.status === "rascunho" && (canManage || mine);
  const canOwn = canManage || mine;
  const customer = (o.customers as unknown as { name: string } | null)?.name ?? "";
  const principal = (o.principals as unknown as { name: string } | null)?.name ?? "";
  const sellerName = seller?.full_name || seller?.email || "";

  const used = new Set((items ?? []).map((i) => i.variant_id));
  type PI = {
    variant_id: string; price: number;
    product_variants: { code: string; attributes: Record<string, unknown> | null; products: { name: string; unit: string; min_order_qty: number | null; order_multiple: number | null } };
  };
  const options = ((priceItems ?? []) as unknown as PI[])
    .filter((p) => !used.has(p.variant_id))
    .map((p) => {
      const v = p.product_variants;
      const extra = Object.values(v.attributes ?? {}).filter(Boolean).join(", ");
      return {
        id: p.variant_id,
        label: `${v.products.name} · ${v.code}${extra ? ` (${extra})` : ""} — ${brl(Number(p.price))}/${unitLabel(v.products.unit)}`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  const today = todayISO();
  const subtotal = Number(o.subtotal);
  const discValue = subtotal * (Number(o.discount_pct) / 100);
  const v = (x: string | number | null | undefined) => (x == null ? "" : String(x));

  return (
    <>
      <PageHeader
        title={`Pedido #${o.number}`}
        hint={[customer, principal].filter(Boolean).join(" · ")}
        back={{ href: PATH, label: "Pedidos" }}
        action={<Badge tone={st.tone}>{st.label}</Badge>}
      />

      <div className="mb-4 max-w-3xl empty:hidden [&>*]:mb-3">
        <ErrorNote message={sp.erro} />
        <OkNote message={sp.ok} />
      </div>

      <div className="grid max-w-3xl gap-4 lg:gap-5">
        {/* ---------- Andamento ---------- */}
        <Section icon="check" title="Andamento" hint={sellerName ? `Vendedor: ${sellerName}` : undefined}>
          <div className="grid gap-3">
            <ol className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
              <li>Criado em {formatDate(o.order_date)}</li>
              {o.sent_at ? <li>Enviado em {formatDate(String(o.sent_at).slice(0, 10))}</li> : null}
              {o.invoiced_at ? <li>Faturado em {formatDate(o.invoiced_at)}{o.invoice_number ? ` · NF ${o.invoice_number}` : ""}</li> : null}
              {o.delivered_at ? <li>Entregue em {formatDate(o.delivered_at)}</li> : null}
              {o.status === "cancelado" ? <li className="text-alert">Cancelado{o.cancel_reason ? `: ${o.cancel_reason}` : ""}</li> : null}
            </ol>

            {o.status === "rascunho" && editable ? (
              <div className="flex flex-wrap gap-2">
                <form action={sendOrder.bind(null, id)}><button className={primaryBtn}>Enviar pedido</button></form>
                <form action={deleteDraft.bind(null, id)}><button className={ghostBtn}>Excluir rascunho</button></form>
              </div>
            ) : null}

            {o.status === "enviado" ? (
              <div className="grid gap-3">
                {isBackOffice ? (
                  <form action={markInvoiced.bind(null, id)} className="grid gap-3 rounded-2xl bg-subtle p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field label="Nota fiscal (opcional)"><input name="invoice_number" className={inputCls} /></Field>
                    <Field label="Data do faturamento"><input name="invoiced_at" type="date" defaultValue={today} className={inputCls} /></Field>
                    <button className={primaryBtn}>Marcar faturado</button>
                  </form>
                ) : null}
                {canOwn ? (
                  <form action={reopenOrder.bind(null, id)}><button className={ghostBtn}>Voltar para rascunho</button></form>
                ) : null}
              </div>
            ) : null}

            {o.status === "faturado" && isBackOffice ? (
              <form action={markDelivered.bind(null, id)} className="grid gap-3 rounded-2xl bg-subtle p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Data da entrega"><input name="delivered_at" type="date" defaultValue={today} className={inputCls} /></Field>
                <button className={primaryBtn}>Marcar entregue</button>
              </form>
            ) : null}

            {o.status !== "entregue" && o.status !== "cancelado" && (canManage || (canOwn && o.status !== "faturado")) ? (
              <form action={cancelOrder.bind(null, id)} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input name="reason" placeholder="Motivo do cancelamento (opcional)" className={inputCls} />
                <button className="h-12 rounded-xl px-4 text-sm text-alert hover:bg-subtle">Cancelar pedido</button>
              </form>
            ) : null}
          </div>
        </Section>

        {/* ---------- Dados do pedido ---------- */}
        <form action={updateOrder.bind(null, id)} className="grid gap-4">
          <fieldset disabled={!editable} className="m-0 min-w-0 border-0 p-0">
            <Section icon="file" title="Dados do pedido">
              <div className={grid}>
                <Field label="Cliente"><input value={customer} readOnly disabled className={inputCls} /></Field>
                <Field label="Representada"><input value={principal} readOnly disabled className={inputCls} /></Field>
                <div className="sm:col-span-2">
                  <Field label="Tabela de preço" hint="Trocar a tabela não muda o preço dos itens que já estão lançados.">
                    <select name="price_table_id" defaultValue={o.price_table_id ?? ""} className={inputCls}>
                      <option value="">Escolha</option>
                      {(tables ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({formatDate(t.valid_from)}{t.valid_to ? ` a ${formatDate(t.valid_to)}` : " em diante"})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Data do pedido"><input name="order_date" type="date" defaultValue={o.order_date} className={inputCls} /></Field>
                <Field label="Previsão de entrega"><input name="expected_delivery" type="date" defaultValue={v(o.expected_delivery)} className={inputCls} /></Field>
                <div className="sm:col-span-2">
                  <Field label="Condição de pagamento" hint="Ex.: à vista, 30 dias, 30/60/90 dias.">
                    <input name="payment_terms" list="pay-terms" defaultValue={v(o.payment_terms)} className={inputCls} />
                    <datalist id="pay-terms">
                      {["À vista", "28 dias", "30 dias", "30/60 dias", "30/60/90 dias", "28/35/42 dias", "Boleto 15 dias"].map((t) => (<option key={t} value={t} />))}
                    </datalist>
                  </Field>
                </div>
                <Field label="Frete">
                  <select name="freight_mode" defaultValue={o.freight_mode ?? ""} className={inputCls}>
                    <option value="">Não informado</option>
                    <option value="cif">CIF (fábrica paga)</option>
                    <option value="fob">FOB (cliente paga)</option>
                  </select>
                </Field>
                <Field label="Valor do frete (R$)" hint="Somado ao total.">
                  <input name="freight_value" inputMode="decimal" defaultValue={o.freight_value ? String(o.freight_value).replace(".", ",") : ""} className={inputCls} />
                </Field>
                <Field label="Desconto geral (%)" hint="Aplicado sobre o total dos itens.">
                  <input name="discount_pct" inputMode="decimal" defaultValue={o.discount_pct ? String(o.discount_pct).replace(".", ",") : ""} className={inputCls} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Observações">
                    <textarea name="notes" rows={3} defaultValue={v(o.notes)} className={`${inputCls} h-auto py-3`} />
                  </Field>
                </div>
              </div>
            </Section>
          </fieldset>
          {editable ? <div className="flex justify-end"><button className={`${primaryBtn} w-full sm:w-auto sm:px-8`}>Salvar dados</button></div> : null}
        </form>

        {/* ---------- Itens ---------- */}
        <Section icon="box" title={`Itens (${(items ?? []).length})`} hint={o.price_table_id ? "Preço vem da tabela escolhida. O desconto é por item." : "Escolha a tabela de preço acima e salve para lançar itens."}>
          {(items ?? []).length > 0 ? (
            <ul className="divide-y divide-line">
              {(items ?? []).map((i) => (
                <li key={i.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{i.description}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        <span className="font-mono text-xs">{i.code}</span> · {brl(Number(i.list_price))}/{unitLabel(i.unit)}
                        {Number(i.discount_pct) > 0 ? ` · −${pct(Number(i.discount_pct))} = ${brl(Number(i.unit_price))}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{brl(Number(i.line_total))}</p>
                  </div>
                  {editable ? (
                    <form action={updateItem.bind(null, id, i.id)} className="mt-3 grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
                      <input name="qty" inputMode="decimal" defaultValue={qtyFmt(Number(i.qty))} aria-label="Quantidade" className={inputCls} />
                      <input name="discount_pct" inputMode="decimal" placeholder="Desc. %" defaultValue={Number(i.discount_pct) ? qtyFmt(Number(i.discount_pct)) : ""} aria-label="Desconto %" className={inputCls} />
                      <button className={ghostBtn}>Salvar</button>
                      <button formAction={deleteItem.bind(null, id, i.id)} className="h-12 rounded-xl px-3 text-sm text-alert hover:bg-subtle">Excluir</button>
                    </form>
                  ) : (
                    <p className="mt-1 text-sm text-ink-2">{qtyFmt(Number(i.qty))} {unitLabel(i.unit)}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhum item lançado.</p>
          )}

          {editable && o.price_table_id ? (
            options.length > 0 ? (
              <form action={addItem.bind(null, id)} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_7rem_7rem]">
                <div className="sm:col-span-3">
                  <Field label="Adicionar produto">
                    <select name="variant_id" required defaultValue="" className={inputCls}>
                      <option value="" disabled>Escolha o produto</option>
                      {options.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
                    </select>
                  </Field>
                </div>
                <div className="sm:col-span-1 sm:col-start-1">
                  <Field label="Quantidade"><input name="qty" required inputMode="decimal" className={inputCls} /></Field>
                </div>
                <Field label="Desc. %"><input name="discount_pct" inputMode="decimal" className={inputCls} /></Field>
                <div className="sm:col-span-3"><button className={ghostBtn}>+ Adicionar item</button></div>
              </form>
            ) : (
              <p className="mt-4 rounded-2xl bg-subtle p-4 text-sm text-ink-2">
                Todos os produtos dessa tabela já estão no pedido, ou a tabela ainda não tem preços lançados.
              </p>
            )
          ) : null}
        </Section>

        {/* ---------- Totais ---------- */}
        <section className="rounded-[1.75rem] border border-line bg-subtle p-5 sm:p-6">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-2">Itens</dt><dd className="tabular-nums">{brl(subtotal)}</dd></div>
            {Number(o.discount_pct) > 0 ? (
              <div className="flex justify-between"><dt className="text-ink-2">Desconto geral ({pct(Number(o.discount_pct))})</dt><dd className="tabular-nums">−{brl(discValue)}</dd></div>
            ) : null}
            {Number(o.freight_value) > 0 ? (
              <div className="flex justify-between"><dt className="text-ink-2">Frete{o.freight_mode ? ` (${String(o.freight_mode).toUpperCase()})` : ""}</dt><dd className="tabular-nums">{brl(Number(o.freight_value))}</dd></div>
            ) : null}
            <div className="mt-1 flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{brl(Number(o.total))}</dd></div>
          </dl>
        </section>
      </div>
    </>
  );
}
