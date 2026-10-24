"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber, todayISO } from "@/lib/format";
import { round2 } from "@/lib/orders";

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
    .select("id, status, seller_id")
    .eq("id", id)
    .maybeSingle();
  if (!o) fail("/pedidos", "Pedido não encontrado.");
  const mine = o.seller_id === ctx.user.id;
  return { o, mine, canEditDraft: o.status === "rascunho" && (ctx.canManage || mine), canOwn: ctx.canManage || mine };
}

function num(fd: FormData, key: string): number | null {
  const raw = text(fd, key);
  return raw ? parseNumber(raw) : null;
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

export async function cancelOrder(id: string, formData: FormData) {
  const ctx = await getContext();
  const { o, canOwn } = await loadOrder(ctx, id);
  if (o.status === "entregue" || o.status === "cancelado") fail(here(id), "Este pedido não pode mais ser cancelado.");
  const allowed = ctx.canManage || canOwn;
  if (!allowed) fail(here(id), "Você não pode cancelar este pedido.");
  await setStatus(id, { status: "cancelado", cancel_reason: optional(formData, "reason") });
  // RN4: cancelar o pedido cancela as comissões que ainda não foram recebidas.
  await ctx.supabase.from("commissions").update({ status: "cancelada" }).eq("order_id", id).eq("status", "a_receber");
  revalidatePath("/comissoes");
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

// Cria um rascunho novo com o mesmo cliente, representada, condições e itens.
export async function duplicateOrder(id: string) {
  const ctx = await getContext();
  if (ctx.role === "finance") fail(here(id), "O perfil Financeiro não cria pedidos.");
  const [{ data: o }, { data: items }] = await Promise.all([
    ctx.supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    ctx.supabase.from("order_items").select("*").eq("order_id", id).order("position"),
  ]);
  if (!o) fail("/pedidos", "Pedido não encontrado.");

  const { data: created, error } = await ctx.supabase
    .from("orders")
    .insert({
      org_id: ctx.orgId,
      number: 0,
      seller_id: ctx.user.id,
      customer_id: o.customer_id,
      principal_id: o.principal_id,
      order_date: todayISO(),
      payment_terms: o.payment_terms,
      freight_mode: o.freight_mode,
      freight_value: o.freight_value,
      discount_pct: o.discount_pct,
      commission_pct: o.commission_pct,
      notes: o.notes,
      subtotal: o.subtotal,
      total: o.total,
    })
    .select("id")
    .single();
  if (error || !created) fail(here(id), `Não foi possível duplicar: ${error?.message}`);

  if ((items ?? []).length) {
    await ctx.supabase.from("order_items").insert(
      (items ?? []).map((i) => ({
        org_id: ctx.orgId,
        order_id: created.id,
        variant_id: i.variant_id,
        position: i.position,
        code: i.code,
        description: i.description,
        unit: i.unit,
        qty: i.qty,
        list_price: i.list_price,
        discount_pct: i.discount_pct,
        unit_price: i.unit_price,
        line_total: i.line_total,
      })),
    );
  }
  revalidatePath("/pedidos");
  redirect(`${here(created.id)}?ok=${encodeURIComponent("Pedido duplicado. Confira e salve.")}`);
}

// Observação no histórico do pedido (migração 026): o que mudou entre o pedido e o faturamento.
export async function addOrderNote(id: string, formData: FormData) {
  const { supabase, orgId, user } = await getContext();
  const body = text(formData, "body");
  if (!body) fail(here(id), "Escreva a observação.");
  if (body.length > 4000) fail(here(id), "A observação pode ter até 4.000 caracteres.");
  const { data: me } = await supabase.from("members").select("full_name, email").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
  const { error } = await supabase.from("order_notes").insert({
    org_id: orgId,
    order_id: id,
    author_id: user.id,
    author_name: me?.full_name || me?.email || user.email,
    body,
  });
  if (error) {
    if (error.message.includes("order_notes")) fail(here(id), "Falta rodar a migração 026 no Supabase.");
    fail(here(id), `Não foi possível salvar: ${error.message}`);
  }
  revalidatePath(here(id));
  redirect(`${here(id)}?ok=${encodeURIComponent("Observação registrada.")}#observacoes`);
}

export async function deleteOrderNote(id: string, noteId: string) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("order_notes").delete().eq("id", noteId).eq("order_id", id);
  if (error) fail(here(id), `Não foi possível apagar: ${error.message}`);
  revalidatePath(here(id));
  redirect(`${here(id)}?ok=${encodeURIComponent("Observação apagada.")}#observacoes`);
}
