"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber } from "@/lib/format";
import { round2 } from "@/lib/orders";
import { commissionDueDate } from "@/lib/commission-due";

const here = (id: string) => `/pedidos/${id}`;

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/xml": "xml",
  "text/xml": "xml",
  "image/jpeg": "jpg",
  "image/png": "png",
};

// Recalcula o resumo do pedido a partir das notas (data da 1ª, soma dos valores, nº da última).
async function syncOrder(supabase: Awaited<ReturnType<typeof getContext>>["supabase"], orderId: string) {
  const { data: invoices } = await supabase
    .from("order_invoices")
    .select("number, issued_at, value")
    .eq("order_id", orderId)
    .order("issued_at");
  const list = invoices ?? [];
  const { data: o } = await supabase.from("orders").select("status").eq("id", orderId).single();
  const patch: Record<string, unknown> = {
    invoiced_at: list[0]?.issued_at ?? null,
    invoiced_value: list.length ? round2(list.reduce((s, i) => s + Number(i.value), 0)) : null,
    invoice_number: list.map((i) => i.number).filter(Boolean).join(", ") || null,
    updated_at: new Date().toISOString(),
  };
  if (o?.status === "enviado" && list.length) patch.status = "faturado";
  if (o?.status === "faturado" && !list.length) patch.status = "enviado";
  await supabase.from("orders").update(patch).eq("id", orderId);
}

export async function registerInvoice(orderId: string, formData: FormData) {
  const ctx = await getContext();
  const { supabase, orgId, user, isBackOffice } = ctx;
  const back = `${here(orderId)}?faturar=1`;

  const { data: o } = await supabase
    .from("orders")
    .select("id, status, seller_id, principal_id, commission_pct, principals(commission_close_mode, commission_close_day, commission_days_after)")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) fail("/pedidos", "Pedido não encontrado.");
  if (!isBackOffice && o.seller_id !== user.id) fail(here(orderId), "Você não pode faturar este pedido.");
  if (o.status !== "enviado" && o.status !== "faturado") {
    fail(here(orderId), "Só pedidos enviados ou já faturados recebem notas fiscais.");
  }

  // RN3: data e valor faturado são obrigatórios.
  const issuedAt = text(formData, "issued_at");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedAt)) fail(back, "Informe a data do faturamento.");
  const valueRaw = text(formData, "value");
  const value = valueRaw ? parseNumber(valueRaw) : NaN;
  if (!Number.isFinite(value) || value <= 0) fail(back, "Informe o valor faturado.");

  // Quantidades por item (não pode passar do que falta faturar).
  const [{ data: items }, { data: done }] = await Promise.all([
    supabase.from("order_items").select("id, description, qty").eq("order_id", orderId),
    supabase.from("order_invoice_items").select("order_item_id, qty, order_invoices!inner(order_id)").eq("order_invoices.order_id", orderId),
  ]);
  const already = new Map<string, number>();
  for (const d of done ?? []) already.set(d.order_item_id, (already.get(d.order_item_id) ?? 0) + Number(d.qty));
  const lines: { order_item_id: string; qty: number }[] = [];
  for (const it of items ?? []) {
    const raw = text(formData, `qty_${it.id}`);
    if (!raw) continue;
    const q = parseNumber(raw);
    if (!Number.isFinite(q) || q < 0) fail(back, `${it.description}: quantidade inválida.`);
    if (q === 0) continue;
    const left = Number(it.qty) - (already.get(it.id) ?? 0);
    if (q > left + 1e-9) fail(back, `${it.description}: só faltam ${String(left).replace(".", ",")} para faturar.`);
    lines.push({ order_item_id: it.id, qty: q });
  }

  // Arquivo da nota (opcional).
  let filePath: string | null = null;
  let fileName: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const ext = EXT[file.type];
    if (!ext) fail(back, "Envie o arquivo da nota em PDF, XML, JPG ou PNG.");
    if (file.size > 10 * 1024 * 1024) fail(back, "O arquivo da nota pode ter no máximo 10 MB.");
    filePath = `${orgId}/${orderId}/${crypto.randomUUID()}.${ext}`;
    fileName = file.name.slice(0, 120);
    const { error } = await supabase.storage.from("invoices").upload(filePath, file, { contentType: file.type });
    if (error) fail(back, `Não foi possível enviar o arquivo: ${error.message}`);
  }

  const { data: invoice, error } = await supabase
    .from("order_invoices")
    .insert({
      org_id: orgId,
      order_id: orderId,
      number: optional(formData, "number"),
      series: optional(formData, "series"),
      issued_at: issuedAt,
      value: round2(value),
      file_path: filePath,
      file_name: fileName,
      notes: optional(formData, "notes"),
    })
    .select("id")
    .single();
  if (error || !invoice) {
    if (filePath) await supabase.storage.from("invoices").remove([filePath]);
    if (error?.message.includes("order_invoices")) fail(back, "Falta rodar a migração 009 no Supabase.");
    fail(back, `Não foi possível registrar a nota: ${error?.message}`);
  }

  if (lines.length) {
    await supabase.from("order_invoice_items").insert(lines.map((l) => ({ invoice_id: invoice.id, ...l })));
  }

  // Comissão desta nota: valor faturado × % do pedido, vencendo pela regra da representada.
  const pct = Number(o.commission_pct ?? 0);
  const rule = o.principals as unknown as Parameters<typeof commissionDueDate>[1];
  await supabase.from("commissions").insert({
    org_id: orgId,
    order_id: orderId,
    invoice_id: invoice.id,
    principal_id: o.principal_id,
    seller_id: o.seller_id,
    base_value: round2(value),
    pct,
    value: round2((value * pct) / 100),
    due_date: commissionDueDate(issuedAt, rule ?? {}),
  });

  await syncOrder(supabase, orderId);
  revalidatePath(here(orderId));
  revalidatePath("/pedidos");
  revalidatePath("/comissoes");
  redirect(`${here(orderId)}?ok=${encodeURIComponent("Faturamento registrado. A comissão ficou a receber.")}`);
}

export async function deleteInvoice(orderId: string, invoiceId: string) {
  const { supabase, isBackOffice, user } = await getContext();
  const { data: inv } = await supabase
    .from("order_invoices")
    .select("id, file_path, orders(seller_id), commissions(status)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) fail(here(orderId), "Nota não encontrada.");
  const sellerId = (inv.orders as unknown as { seller_id: string } | null)?.seller_id;
  if (!isBackOffice && sellerId !== user.id) fail(here(orderId), "Você não pode excluir esta nota.");
  const commission = (inv.commissions as unknown as { status: string }[] | null)?.[0];
  if (commission?.status === "recebida") {
    fail(here(orderId), "A comissão desta nota já foi recebida. Desmarque o recebimento em Comissões antes de excluir.");
  }

  const { error } = await supabase.from("order_invoices").delete().eq("id", invoiceId);
  if (error) fail(here(orderId), `Não foi possível excluir: ${error.message}`);
  if (inv.file_path) await supabase.storage.from("invoices").remove([inv.file_path]);

  await syncOrder(supabase, orderId);
  revalidatePath(here(orderId));
  revalidatePath("/comissoes");
  redirect(`${here(orderId)}?ok=${encodeURIComponent("Nota excluída.")}`);
}
