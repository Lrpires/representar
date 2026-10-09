"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber, todayISO } from "@/lib/format";
import { round2, round4 } from "@/lib/orders";

const here = (id: string) => `/pedidos/${id}`;

function done(id: string, message: string): never {
  revalidatePath(here(id));
  revalidatePath("/pedidos");
  redirect(`${here(id)}?ok=${encodeURIComponent(message)}`);
}

type Ctx = Awaited<ReturnType<typeof getContext>>;

async function loadOrder(ctx: Ctx, id: string) {
  const { data: o } = await ctx.supabase
    .from("orders")
    .select("id, status, seller_id, price_table_id, discount_pct, freight_value")
    .eq("id", id)
    .maybeSingle();
  if (!o) fail("/pedidos", "Pedido não encontrado.");
  const mine = o.seller_id === ctx.user.id;
  return { o, mine, canEditDraft: o.status === "rascunho" && (ctx.canManage || mine), canOwn: ctx.canManage || mine };
}

async function recalc(ctx: Ctx, id: string) {
  const [{ data: items }, { data: o }] = await Promise.all([
    ctx.supabase.from("order_items").select("line_total").eq("order_id", id),
    ctx.supabase.from("orders").select("discount_pct, freight_value").eq("id", id).single(),
  ]);
  const sub = round2((items ?? []).reduce((s, i) => s + Number(i.line_total), 0));
  const disc = Number(o?.discount_pct ?? 0);
  const freight = Number(o?.freight_value ?? 0);
  const total = round2(sub * (1 - disc / 100) + freight);
  await ctx.supabase
    .from("orders")
    .update({ subtotal: sub, total, updated_at: new Date().toISOString() })
    .eq("id", id);
}

function num(fd: FormData, key: string): number | null {
  const raw = text(fd, key);
  return raw ? parseNumber(raw) : null;
}

type VariantInfo = {
  products: { min_order_qty: number | null; order_multiple: number | null; name: string };
};

async function checkQty(ctx: Ctx, path: string, variantId: string, qty: number) {
  const { data } = await ctx.supabase
    .from("product_variants")
    .select("products(name, min_order_qty, order_multiple)")
    .eq("id", variantId)
    .maybeSingle();
  const p = (data as unknown as VariantInfo | null)?.products;
  if (!p) return;
  const min = p.min_order_qty == null ? 0 : Number(p.min_order_qty);
  const mult = p.order_multiple == null ? 0 : Number(p.order_multiple);
  if (min > 0 && qty < min) fail(path, `${p.name}: o pedido mínimo é ${String(min).replace(".", ",")}.`);
  if (mult > 0 && Math.abs(qty / mult - Math.round(qty / mult)) > 1e-9) {
    fail(path, `${p.name}: só vende em múltiplos de ${String(mult).replace(".", ",")}.`);
  }
}

function checkNumbers(path: string, qty: number | null, disc: number | null) {
  if (qty === null || Number.isNaN(qty) || qty <= 0) fail(path, "Informe uma quantidade maior que zero.");
  if (disc !== null && (Number.isNaN(disc) || disc < 0 || disc > 100)) {
    fail(path, "O desconto deve estar entre 0 e 100.");
  }
}

/* ---------- Cabeçalho ---------- */

export async function updateOrder(id: string, formData: FormData) {
  const ctx = await getContext();
  const path = here(id);
  const { canEditDraft } = await loadOrder(ctx, id);
  if (!canEditDraft) fail(path, "Só é possível alterar um pedido em rascunho.");

  const disc = num(formData, "discount_pct");
  const freight = num(formData, "freight_value");
  if (disc !== null && (Number.isNaN(disc) || disc < 0 || disc > 100)) fail(path, "O desconto geral deve estar entre 0 e 100.");
  if (freight !== null && (Number.isNaN(freight) || freight < 0)) fail(path, "Informe um valor de frete válido.");
  const mode = text(formData, "freight_mode");

  const { error } = await ctx.supabase
    .from("orders")
    .update({
      price_table_id: optional(formData, "price_table_id"),
      order_date: text(formData, "order_date") || todayISO(),
      expected_delivery: optional(formData, "expected_delivery"),
      payment_terms: optional(formData, "payment_terms"),
      freight_mode: mode === "cif" || mode === "fob" ? mode : null,
      freight_value: freight ?? 0,
      discount_pct: disc ?? 0,
      notes: optional(formData, "notes"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) fail(path, `Não foi possível salvar: ${error.message}`);
  await recalc(ctx, id);
  done(id, "Pedido salvo.");
}

/* ---------- Itens ---------- */

export async function addItem(id: string, formData: FormData) {
  const ctx = await getContext();
  const path = here(id);
  const { o, canEditDraft } = await loadOrder(ctx, id);
  if (!canEditDraft) fail(path, "Só é possível alterar itens de um pedido em rascunho.");
  if (!o.price_table_id) fail(path, "Escolha a tabela de preço do pedido e salve antes de lançar itens.");

  const variantId = text(formData, "variant_id");
  const qty = num(formData, "qty");
  const disc = num(formData, "discount_pct");
  if (!variantId) fail(path, "Escolha o produto.");
  checkNumbers(path, qty, disc);
  await checkQty(ctx, path, variantId, qty as number);

  const { data: pi } = await ctx.supabase
    .from("price_items")
    .select("price, product_variants(code, attributes, products(name, unit))")
    .eq("price_table_id", o.price_table_id)
    .eq("variant_id", variantId)
    .maybeSingle();
  if (!pi) fail(path, "Esse produto não tem preço na tabela escolhida.");

  const v = pi.product_variants as unknown as {
    code: string; attributes: Record<string, unknown> | null; products: { name: string; unit: string };
  };
  const extra = Object.values(v.attributes ?? {}).filter(Boolean).join(", ");
  const list = Number(pi.price);
  const d = disc ?? 0;
  const unitPrice = round4(list * (1 - d / 100));

  const { count } = await ctx.supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", id);

  const { error } = await ctx.supabase.from("order_items").insert({
    org_id: ctx.orgId,
    order_id: id,
    variant_id: variantId,
    position: count ?? 0,
    code: v.code,
    description: `${v.products.name}${extra ? ` — ${extra}` : ""}`,
    unit: v.products.unit,
    qty,
    list_price: list,
    discount_pct: d,
    unit_price: unitPrice,
    line_total: round2((qty as number) * unitPrice),
  });
  if (error) {
    if (error.code === "23505") fail(path, "Esse item já está no pedido. Altere a quantidade na lista.");
    fail(path, `Não foi possível adicionar: ${error.message}`);
  }
  await recalc(ctx, id);
  done(id, "Item adicionado.");
}

export async function updateItem(id: string, itemId: string, formData: FormData) {
  const ctx = await getContext();
  const path = here(id);
  const { canEditDraft } = await loadOrder(ctx, id);
  if (!canEditDraft) fail(path, "Só é possível alterar itens de um pedido em rascunho.");

  const qty = num(formData, "qty");
  const disc = num(formData, "discount_pct");
  checkNumbers(path, qty, disc);

  const { data: it } = await ctx.supabase
    .from("order_items")
    .select("variant_id, list_price")
    .eq("id", itemId)
    .eq("order_id", id)
    .maybeSingle();
  if (!it) fail(path, "Item não encontrado.");
  await checkQty(ctx, path, it.variant_id, qty as number);

  const d = disc ?? 0;
  const unitPrice = round4(Number(it.list_price) * (1 - d / 100));
  const { error } = await ctx.supabase
    .from("order_items")
    .update({ qty, discount_pct: d, unit_price: unitPrice, line_total: round2((qty as number) * unitPrice) })
    .eq("id", itemId)
    .eq("order_id", id);
  if (error) fail(path, `Não foi possível salvar o item: ${error.message}`);
  await recalc(ctx, id);
  done(id, "Item atualizado.");
}

export async function deleteItem(id: string, itemId: string) {
  const ctx = await getContext();
  const path = here(id);
  const { canEditDraft } = await loadOrder(ctx, id);
  if (!canEditDraft) fail(path, "Só é possível alterar itens de um pedido em rascunho.");
  const { error } = await ctx.supabase.from("order_items").delete().eq("id", itemId).eq("order_id", id);
  if (error) fail(path, `Não foi possível excluir: ${error.message}`);
  await recalc(ctx, id);
  done(id, "Item removido.");
}

/* ---------- Andamento ---------- */

async function setStatus(id: string, patch: Record<string, unknown>) {
  const ctx = await getContext();
  const { error } = await ctx.supabase
    .from("orders")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail(here(id), `Não foi possível atualizar o pedido: ${error.message}`);
}

export async function sendOrder(id: string) {
  const ctx = await getContext();
  const path = here(id);
  const { o, canEditDraft } = await loadOrder(ctx, id);
  if (!canEditDraft || o.status !== "rascunho") fail(path, "Só um rascunho pode ser enviado.");
  const { count } = await ctx.supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", id);
  if (!count) fail(path, "Lance ao menos um item antes de enviar.");
  await setStatus(id, { status: "enviado", sent_at: new Date().toISOString() });
  done(id, "Pedido marcado como enviado.");
}

export async function reopenOrder(id: string) {
  const ctx = await getContext();
  const { o, canOwn } = await loadOrder(ctx, id);
  if (!canOwn || o.status !== "enviado") fail(here(id), "Só um pedido enviado pode voltar para rascunho.");
  await setStatus(id, { status: "rascunho", sent_at: null });
  done(id, "Pedido voltou para rascunho.");
}

export async function markInvoiced(id: string, formData: FormData) {
  const ctx = await getContext();
  const { o } = await loadOrder(ctx, id);
  if (!ctx.isBackOffice || o.status !== "enviado") fail(here(id), "Só um pedido enviado pode ser faturado (por administrador, gerente ou financeiro).");
  await setStatus(id, {
    status: "faturado",
    invoice_number: optional(formData, "invoice_number"),
    invoiced_at: text(formData, "invoiced_at") || todayISO(),
  });
  done(id, "Pedido faturado.");
}

export async function markDelivered(id: string, formData: FormData) {
  const ctx = await getContext();
  const { o } = await loadOrder(ctx, id);
  if (!ctx.isBackOffice || o.status !== "faturado") fail(here(id), "Só um pedido faturado pode ser entregue (por administrador, gerente ou financeiro).");
  await setStatus(id, { status: "entregue", delivered_at: text(formData, "delivered_at") || todayISO() });
  done(id, "Pedido entregue.");
}

export async function cancelOrder(id: string, formData: FormData) {
  const ctx = await getContext();
  const { o, canOwn } = await loadOrder(ctx, id);
  if (o.status === "entregue" || o.status === "cancelado") fail(here(id), "Este pedido não pode mais ser cancelado.");
  const allowed = ctx.canManage || (canOwn && (o.status === "rascunho" || o.status === "enviado"));
  if (!allowed) fail(here(id), "Você não pode cancelar este pedido.");
  await setStatus(id, { status: "cancelado", cancel_reason: optional(formData, "reason") });
  done(id, "Pedido cancelado.");
}

export async function deleteDraft(id: string) {
  const ctx = await getContext();
  const { o, canEditDraft } = await loadOrder(ctx, id);
  if (!canEditDraft || o.status !== "rascunho") fail(here(id), "Só um rascunho pode ser excluído.");
  const { error } = await ctx.supabase.from("orders").delete().eq("id", id);
  if (error) fail(here(id), `Não foi possível excluir: ${error.message}`);
  revalidatePath("/pedidos");
  redirect("/pedidos");
}
