"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { lineTotals, orderTotals, num } from "@/lib/orders";
import { loadSellers } from "@/lib/sellers";
import { syncOrder } from "./[id]/invoices";

// Pedido enviado ou faturado em parte também pode ser alterado (não o faturado nem o cancelado).
const EDITABLE = ["rascunho", "enviado", "parcial"];

export type ItemInput = {
  id?: string; // item já gravado (na edição de pedido enviado, o item é atualizado no lugar, sem perder as notas)
  variant_id: string | null;
  options?: Record<string, string> | null; // opções escolhidas na grade, ex.: {"Cor": "Azul"}
  code: string;
  description: string;
  unit: string;
  qty: string;
  price: string;
  discount: string;
};

export type OrderInput = {
  id?: string;
  seller_id?: string; // vendedor do pedido (vem do cliente; administrador e gerente podem trocar)
  customer_id: string;
  principal_id: string;
  order_date: string;
  expected_delivery: string;
  payment_terms: string;
  freight_mode: string;
  freight_value: string;
  discount_pct: string;
  commission_pct: string;
  notes: string;
  items: ItemInput[];
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// Salva o pedido inteiro (cabeçalho + itens) de uma vez.
// intent "send" já marca como Enviado. Em caso de erro devolve a mensagem.
export async function saveOrder(input: OrderInput, intent: "draft" | "send"): Promise<{ error: string }> {
  const ctx = await getContext();
  const { supabase, orgId, user, role, canManage, canSeeCommissions } = ctx;
  if (role === "finance") return { error: "O perfil Financeiro não cria nem altera pedidos." };

  if (!input.customer_id) return { error: "Escolha o cliente." };
  if (!input.principal_id) return { error: "Escolha a representada." };
  if (!isDate(input.order_date)) return { error: "Informe a data do pedido." };
  if (input.expected_delivery && !isDate(input.expected_delivery)) return { error: "Previsão de entrega inválida." };

  const items = input.items.filter((i) => i.description.trim() || num(i.qty) || num(i.price));
  if (items.length === 0) return { error: "Adicione ao menos um item" };

  for (const [n, i] of items.entries()) {
    const label = `Item ${n + 1}`;
    if (!i.description.trim()) return { error: `${label}: escreva a descrição do produto.` };
    if (num(i.qty) <= 0) return { error: `${label}: informe uma quantidade maior que zero.` };
    if (num(i.price) < 0) return { error: `${label}: o preço não pode ser negativo.` };
    const d = num(i.discount);
    if (d < 0 || d > 100) return { error: `${label}: o desconto deve ficar entre 0 e 100.` };
  }

  const discountPct = num(input.discount_pct);
  const freight = num(input.freight_value);
  // Quem não vê comissão (vendedor, gerente) não escolhe o %: vale o do pedido (na edição) ou o padrão da representada.
  let commissionPct = num(input.commission_pct);
  if (!canSeeCommissions) {
    const { data: prev } = input.id
      ? await supabase.from("orders").select("commission_pct, principal_id").eq("id", input.id).maybeSingle()
      : { data: null };
    if (prev && prev.principal_id === input.principal_id && prev.commission_pct != null) {
      commissionPct = Number(prev.commission_pct);
    } else {
      const { data: pr } = await supabase.from("principals").select("default_commission_pct").eq("id", input.principal_id).maybeSingle();
      commissionPct = Number(pr?.default_commission_pct ?? 0);
    }
  }
  if (discountPct < 0 || discountPct > 100) return { error: "O desconto geral deve ficar entre 0 e 100." };
  if (freight < 0) return { error: "O frete não pode ser negativo." };
  if (commissionPct < 0 || commissionPct > 100) return { error: "Informe um percentual de comissão entre 0 e 100." };

  // Pedido mínimo e múltiplos dos produtos do catálogo.
  const variantIds = items.map((i) => i.variant_id).filter(Boolean) as string[];
  if (variantIds.length) {
    const { data: rules } = await supabase
      .from("product_variants")
      .select("id, products(name, principal_id, min_order_qty, order_multiple)")
      .in("id", variantIds);
    for (const r of rules ?? []) {
      const p = r.products as unknown as {
        name: string; principal_id: string; min_order_qty: number | null; order_multiple: number | null;
      };
      if (p.principal_id !== input.principal_id) {
        return { error: `${p.name} é de outra representada. Um pedido tem produtos de uma representada só.` };
      }
      const qty = items.filter((i) => i.variant_id === r.id).reduce((s, i) => s + num(i.qty), 0);
      const min = Number(p?.min_order_qty ?? 0);
      const mult = Number(p?.order_multiple ?? 0);
      if (min > 0 && qty < min) return { error: `${p.name}: o pedido mínimo é ${String(min).replace(".", ",")}.` };
      if (mult > 0 && Math.abs(qty / mult - Math.round(qty / mult)) > 1e-9) {
        return { error: `${p.name}: só vende em múltiplos de ${String(mult).replace(".", ",")}.` };
      }
    }
  }

  // Vendedor: só administrador e gerente escolhem; os demais lançam no próprio nome.
  let sellerId = user.id;
  if (canManage && input.seller_id && input.seller_id !== user.id) {
    const team = await loadSellers(supabase, orgId);
    if (!team.some((s) => s.id === input.seller_id)) return { error: "Escolha um vendedor da equipe." };
    sellerId = input.seller_id;
  }

  const lines = items.map((i) => ({ qty: num(i.qty), price: num(i.price), discount: num(i.discount) }));
  const t = orderTotals(lines, discountPct, freight, commissionPct);
  const mode = input.freight_mode === "cif" || input.freight_mode === "fob" ? input.freight_mode : null;

  const header = {
    customer_id: input.customer_id,
    principal_id: input.principal_id,
    order_date: input.order_date,
    expected_delivery: input.expected_delivery || null,
    payment_terms: input.payment_terms.trim() || null,
    freight_mode: mode,
    freight_value: freight,
    discount_pct: discountPct,
    commission_pct: commissionPct,
    notes: input.notes.trim() || null,
    subtotal: t.subtotal,
    total: t.total,
    updated_at: new Date().toISOString(),
  };

  let orderId = input.id;
  let oldItemIds: string[] = [];
  let sentEdit = false; // alteração de pedido já enviado

  if (orderId) {
    const { data: o } = await supabase.from("orders").select("status, seller_id, principal_id").eq("id", orderId).maybeSingle();
    if (!o) return { error: "Pedido não encontrado." };
    if (!EDITABLE.includes(o.status)) return { error: "Pedido faturado ou cancelado não pode ser alterado." };
    if (!canManage && o.seller_id !== user.id) return { error: "Você não pode alterar este pedido." };
    sentEdit = o.status !== "rascunho";
    if (sentEdit) {
      const done = await invoicedByItem(supabase, orderId);
      if (done.size && input.principal_id !== o.principal_id) {
        return { error: "Este pedido já tem nota fiscal: não dá para trocar a representada." };
      }
      // Item já faturado não pode sair nem ficar com menos do que já foi faturado.
      const kept = new Map(items.filter((i) => i.id).map((i) => [i.id!, num(i.qty)] as const));
      const { data: current } = await supabase.from("order_items").select("id, description").eq("order_id", orderId);
      for (const it of current ?? []) {
        const inv = done.get(it.id) ?? 0;
        if (inv <= 0) continue;
        if (!kept.has(it.id)) return { error: `${it.description}: já foi faturado, não pode sair do pedido.` };
        if (kept.get(it.id)! < inv - 0.0005) {
          return { error: `${it.description}: já foram faturados ${String(inv).replace(".", ",")}; a quantidade não pode ser menor.` };
        }
      }
    }

    const { data: old } = await supabase.from("order_items").select("id").eq("order_id", orderId);
    oldItemIds = (old ?? []).map((i) => i.id);
    const { error } = await supabase
      .from("orders")
      .update({
        ...header,
        ...(intent === "send" && !sentEdit ? { status: "enviado" as const, sent_at: new Date().toISOString() } : {}),
        ...(canManage && input.seller_id ? { seller_id: sellerId } : {}),
      })
      .eq("id", orderId);
    if (error) return { error: friendly(error.message) };
  } else {
    const { data, error } = await supabase
      .from("orders")
      .insert({
        ...header,
        ...(intent === "send" ? { status: "enviado" as const, sent_at: new Date().toISOString() } : {}),
        org_id: orgId,
        seller_id: sellerId,
        number: 0,
      })
      .select("id")
      .single();
    if (error || !data) return { error: friendly(error?.message ?? "erro desconhecido") };
    orderId = data.id;
  }

  // Grava os itens novos antes de apagar os antigos: se algo falhar, nada se perde.
  const rowsToInsert = items.map((i, position) => {
      const l = lineTotals(lines[position]);
      return {
        org_id: orgId,
        order_id: orderId,
        variant_id: i.variant_id,
        position,
        code: i.code.trim(),
        description: i.description.trim(),
        unit: i.unit || "unidade",
        qty: lines[position].qty,
        list_price: lines[position].price,
        discount_pct: lines[position].discount,
        unit_price: l.unit,
        line_total: l.total,
        options: i.variant_id && i.options && Object.keys(i.options).length ? i.options : null,
      };
  });
  if (sentEdit && orderId) {
    // Pedido enviado: atualiza os itens no lugar (as notas continuam ligadas a eles), cria os novos e tira os removidos.
    const keepIds = new Set(items.map((i) => i.id).filter((x): x is string => !!x && oldItemIds.includes(x)));
    for (const [n, i] of items.entries()) {
      const row = rowsToInsert[n];
      if (i.id && keepIds.has(i.id)) {
        const { error } = await supabase.from("order_items").update(row).eq("id", i.id);
        if (error) return { error: friendly(error.message) };
      } else {
        const { error } = await supabase.from("order_items").insert(row);
        if (error) return { error: friendly(error.message) };
      }
    }
    const removed = oldItemIds.filter((x) => !keepIds.has(x));
    if (removed.length) await supabase.from("order_items").delete().in("id", removed);
    await syncOrder(supabase, orderId);
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${orderId}`);
    revalidatePath("/faturamento");
    revalidatePath("/");
    redirect(`/pedidos/${orderId}?ok=${encodeURIComponent("Alterações salvas.")}`);
  }

  let { error: itemsError } = await supabase.from("order_items").insert(rowsToInsert);
  // Sem a migração 022 (coluna options), grava sem as opções (elas já estão na descrição).
  if (itemsError?.message.includes("options")) {
    ({ error: itemsError } = await supabase.from("order_items").insert(rowsToInsert.map(({ options: _o, ...r }) => r)));
  }
  if (itemsError) return { error: friendly(itemsError.message) };
  if (oldItemIds.length) await supabase.from("order_items").delete().in("id", oldItemIds);

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/");
  const msg = intent === "send" ? "Pedido salvo e marcado como enviado." : "Pedido salvo.";
  redirect(`/pedidos/${orderId}?ok=${encodeURIComponent(msg)}`);
}

function friendly(message: string): string {
  if (message.includes("commission_pct") || message.includes("variant_id")) {
    return "Falta rodar a migração 008 no Supabase para salvar pedidos no formato novo.";
  }
  return `Não foi possível salvar: ${message}`;
}

// Quanto de cada item do pedido já saiu em nota fiscal.
async function invoicedByItem(supabase: Awaited<ReturnType<typeof getContext>>["supabase"], orderId: string) {
  const { data } = await supabase
    .from("order_invoice_items")
    .select("order_item_id, qty, order_invoices!inner(order_id)")
    .eq("order_invoices.order_id", orderId);
  const m = new Map<string, number>();
  for (const d of data ?? []) m.set(d.order_item_id, (m.get(d.order_item_id) ?? 0) + Number(d.qty));
  return m;
}
