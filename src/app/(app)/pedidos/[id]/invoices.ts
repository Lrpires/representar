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

// Recalcula o pedido a partir das notas: data da 1ª, soma dos valores, números e o status
// (parcial enquanto a quantidade faturada for menor que a do pedido; faturado quando completar
// ou quando o pedido foi finalizado à mão).
export async function syncOrder(supabase: Awaited<ReturnType<typeof getContext>>["supabase"], orderId: string) {
  const [{ data: invoices }, { data: o }, { data: items }, { data: done }] = await Promise.all([
    supabase.from("order_invoices").select("number, issued_at, value").eq("order_id", orderId).order("issued_at"),
    supabase.from("orders").select("*").eq("id", orderId).single(),
    supabase.from("order_items").select("qty").eq("order_id", orderId),
    supabase.from("order_invoice_items").select("qty, order_invoices!inner(order_id)").eq("order_invoices.order_id", orderId),
  ]);
  const list = invoices ?? [];
  const ordered = (items ?? []).reduce((s, i) => s + Number(i.qty), 0);
  const invoicedQty = (done ?? []).reduce((s, i) => s + Number(i.qty), 0);
  const closed = !!(o as { closed_at?: string | null } | null)?.closed_at;
  // Nota sem quantidades (só valor) conta como faturamento completo.
  const complete = closed || (list.length > 0 && ((done ?? []).length === 0 || invoicedQty >= ordered - 0.0005));

  const patch: Record<string, unknown> = {
    invoiced_at: list[0]?.issued_at ?? null,
    invoiced_value: list.length ? round2(list.reduce((s, i) => s + Number(i.value), 0)) : null,
    invoice_number: list.map((i) => i.number).filter(Boolean).join(", ") || null,
    updated_at: new Date().toISOString(),
  };
  if (o && ["enviado", "parcial", "faturado"].includes(o.status)) {
    patch.status = list.length === 0 ? "enviado" : complete ? "faturado" : "parcial";
  }
  await supabase.from("orders").update(patch).eq("id", orderId);
}

// Lançamento feito pela área de Faturamento (XML): o pedido escolhido vem no formulário.
export async function registerInvoiceFromBilling(formData: FormData) {
  const orderId = text(formData, "order_id");
  if (!orderId) fail("/faturamento?xml=1", "Escolha o pedido desta nota.");
  return registerInvoice(orderId, formData);
}

export async function registerInvoice(orderId: string, formData: FormData) {
  const ctx = await getContext();
  const { supabase, orgId, user, isBackOffice } = ctx;
  const back = text(formData, "back") === "faturamento" ? "/faturamento?xml=1" : `${here(orderId)}?faturar=1`;

  const { data: o } = await supabase
    .from("orders")
    .select("id, status, seller_id, principal_id, commission_pct, principals(commission_close_mode, commission_close_day, commission_days_after)")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) fail("/pedidos", "Pedido não encontrado.");
  if (!isBackOffice && o.seller_id !== user.id) fail(here(orderId), "Você não pode faturar este pedido.");
  if (o.status !== "enviado" && o.status !== "parcial" && o.status !== "faturado") {
    fail(here(orderId), "Só pedidos enviados ou já faturados recebem notas fiscais.");
  }
  // De onde veio o lançamento (ficha do pedido ou área de Faturamento): para onde voltar.
  const fromBilling = back.startsWith("/faturamento");
  const accessKey = text(formData, "access_key").replace(/\D/g, "");
  if (accessKey && accessKey.length !== 44) fail(back, "A chave de acesso da NF-e precisa ter 44 números.");

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

  const row = {
    org_id: orgId,
    order_id: orderId,
    number: optional(formData, "number"),
    series: optional(formData, "series"),
    issued_at: issuedAt,
    value: round2(value),
    file_path: filePath,
    file_name: fileName,
    notes: optional(formData, "notes"),
  };
  const payload: Record<string, unknown> = accessKey ? { ...row, access_key: accessKey } : row;
  let { data: invoice, error } = await supabase
    .from("order_invoices")
    .insert(payload)
    .select("id")
    .single();
  // Sem a migração 017 ainda não há onde guardar a chave: lança a nota sem ela.
  if (error?.message.includes("access_key")) {
    ({ data: invoice, error } = await supabase.from("order_invoices").insert(row).select("id").single());
  }
  if (error?.code === "23505") {
    if (filePath) await supabase.storage.from("invoices").remove([filePath]);
    fail(back, "Esta nota fiscal já foi lançada (mesma chave de acesso).");
  }
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
  revalidatePath("/faturamento");
  const { canSeeCommissions } = await getContext();
  const msg = canSeeCommissions ? "Faturamento registrado. A comissão ficou a receber." : "Faturamento registrado.";
  redirect(fromBilling ? `/faturamento?ok=${encodeURIComponent(msg)}` : `${here(orderId)}?ok=${encodeURIComponent(msg)}`);
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
  // Quem não vê comissões pergunta ao banco se a desta nota já foi recebida.
  const { data: paidRpc } = await supabase.rpc("invoice_commission_received", { p_invoice: invoiceId });
  if (commission?.status === "recebida" || paidRpc === true) {
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

// Encerra o pedido com saldo não faturado (ex.: a fábrica não vai mandar o restante).
export async function finalizeOrder(orderId: string, formData: FormData) {
  const { supabase, isBackOffice, user } = await getContext();
  const { data: o } = await supabase.from("orders").select("status, seller_id").eq("id", orderId).maybeSingle();
  if (!o) fail("/pedidos", "Pedido não encontrado.");
  if (!isBackOffice && o.seller_id !== user.id) fail(here(orderId), "Você não pode finalizar este pedido.");
  if (o.status !== "parcial") fail(here(orderId), "Só um pedido faturado parcialmente pode ser finalizado.");
  const { error } = await supabase
    .from("orders")
    .update({ status: "faturado", closed_at: new Date().toISOString(), close_note: optional(formData, "close_note"), updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) {
    if (error.message.includes("closed_at")) fail(here(orderId), "Falta rodar a migração 017 no Supabase.");
    fail(here(orderId), `Não foi possível finalizar: ${error.message}`);
  }
  revalidatePath(here(orderId));
  revalidatePath("/pedidos");
  revalidatePath("/faturamento");
  redirect(`${here(orderId)}?ok=${encodeURIComponent("Pedido finalizado. O saldo não faturado foi encerrado.")}`);
}

// Desfaz a finalização: o pedido volta a "Faturado parcial" e pode receber novas notas.
export async function reopenFinalized(orderId: string) {
  const { supabase, isBackOffice, user } = await getContext();
  const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!o) fail("/pedidos", "Pedido não encontrado.");
  if (!isBackOffice && o.seller_id !== user.id) fail(here(orderId), "Você não pode reabrir este pedido.");
  if (!o.closed_at) fail(here(orderId), "Este pedido não foi finalizado à mão.");
  await supabase.from("orders").update({ closed_at: null, close_note: null }).eq("id", orderId);
  await syncOrder(supabase, orderId);
  revalidatePath(here(orderId));
  revalidatePath("/pedidos");
  revalidatePath("/faturamento");
  redirect(`${here(orderId)}?ok=${encodeURIComponent("Pedido reaberto para novas notas.")}`);
}
