"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber } from "@/lib/format";
import { round2 } from "@/lib/orders";
import { planCommissions, type InstallmentIn, type PlanRule } from "@/lib/commission-plan";

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
  const manual = text(formData, "back") === "faturamento-manual";
  if (!orderId) fail(manual ? "/faturamento?manual=1" : "/faturamento?xml=1", "Escolha o pedido desta nota.");
  return registerInvoice(orderId, formData);
}

export async function registerInvoice(orderId: string, formData: FormData) {
  const ctx = await getContext();
  const { supabase, orgId, user, isBackOffice } = ctx;
  // De onde veio o lançamento: XML ou à mão na área de Faturamento, ou a ficha do pedido.
  const from = text(formData, "back");
  const back =
    from === "faturamento"
      ? "/faturamento?xml=1"
      : from === "faturamento-manual"
        ? `/faturamento?manual=1&pedido=${orderId}`
        : `${here(orderId)}?faturar=1`;

  const { data: o } = await supabase
    .from("orders")
    .select("id, status, seller_id, principal_id, commission_pct, principals(commission_trigger, commission_release, commission_close_mode, commission_close_day, commission_days_after)")
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
    supabase.from("order_items").select("id, code, description, unit, qty, unit_price").eq("order_id", orderId),
    supabase.from("order_invoice_items").select("order_item_id, qty, order_invoices!inner(order_id)").eq("order_invoices.order_id", orderId),
  ]);
  const already = new Map<string, number>();
  for (const d of done ?? []) already.set(d.order_item_id, (already.get(d.order_item_id) ?? 0) + Number(d.qty));
  const lines: { order_item_id: string; qty: number }[] = [];
  // Itens da nota como vieram na NF (do XML: nf_*). Cada um pode estar ligado a um item do pedido (nf_item).
  const nfDesc = formData.getAll("nf_desc").map(String);
  const nfItem = formData.getAll("nf_item").map(String);
  const nfCode = formData.getAll("nf_code").map(String);
  const nfUnit = formData.getAll("nf_unit").map(String);
  const nfQty = formData.getAll("nf_qty").map(String);
  const nfPrice = formData.getAll("nf_price").map(String);
  const nfTotal = formData.getAll("nf_total").map(String);
  const orderItemIds = new Set((items ?? []).map((i) => i.id));
  const nfLines = nfDesc.map((d, i) => ({
    position: i,
    code: nfCode[i]?.trim() || null,
    description: d.trim() || "Item",
    unit: nfUnit[i]?.trim() || null,
    qty: Math.max(parseNumber(nfQty[i] ?? "") || 0, 0),
    unit_price: Math.max(parseNumber(nfPrice[i] ?? "") || 0, 0),
    total: round2(Math.max(parseNumber(nfTotal[i] ?? "") || 0, 0)),
    order_item_id: orderItemIds.has(nfItem[i]) ? nfItem[i] : null,
  }));
  if (nfLines.length) {
    // Do XML: a quantidade faturada de cada item do pedido é a soma dos itens da nota ligados a ele.
    // A nota manda: pode passar do que faltava (a fábrica às vezes entrega a mais).
    const sum = new Map<string, number>();
    for (const l of nfLines) if (l.order_item_id && l.qty > 0) sum.set(l.order_item_id, (sum.get(l.order_item_id) ?? 0) + l.qty);
    for (const [order_item_id, qty] of sum) lines.push({ order_item_id, qty: Math.round(qty * 1000) / 1000 });
  }
  for (const it of nfLines.length ? [] : items ?? []) {
    const raw = text(formData, `qty_${it.id}`);
    if (!raw) continue;
    const q = parseNumber(raw);
    if (!Number.isFinite(q) || q < 0) fail(back, `${it.description}: quantidade inválida.`);
    if (q === 0) continue;
    const left = Number(it.qty) - (already.get(it.id) ?? 0);
    if (q > left + 1e-9) fail(back, `${it.description}: só faltam ${String(left).replace(".", ",")} para faturar.`);
    lines.push({ order_item_id: it.id, qty: q });
    // Lançada à mão: os itens da nota são os do pedido, com a quantidade informada.
    nfLines.push({
      position: nfLines.length,
      code: it.code ?? null,
      description: it.description,
      unit: it.unit ?? null,
      qty: q,
      unit_price: Number(it.unit_price ?? 0),
      total: round2(q * Number(it.unit_price ?? 0)),
      order_item_id: it.id,
    });
  }

  // Parcelas (duplicatas): vencimento e valor de cada uma (do XML ou digitadas).
  const instDue = formData.getAll("inst_due").map(String);
  const instValue = formData.getAll("inst_value").map(String);
  const instNumber = formData.getAll("inst_number").map(String);
  const installments: InstallmentIn[] = [];
  instDue.forEach((due, i) => {
    const raw = (instValue[i] ?? "").trim();
    if (!due && !raw) return; // linha vazia
    const v = parseNumber(raw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) fail(back, `Parcela ${i + 1}: informe o vencimento.`);
    if (!Number.isFinite(v) || v <= 0) fail(back, `Parcela ${i + 1}: informe o valor.`);
    installments.push({ number: instNumber[i]?.trim() || null, dueDate: due, value: round2(v) });
  });

  // Nota repetida: mesma chave de acesso, ou mesmo número (e série) da mesma representada.
  const number = optional(formData, "number");
  const series = optional(formData, "series");
  const dup = await findDuplicateInvoice(supabase, { principalId: o.principal_id, number, series, accessKey });
  if (dup) fail(back, dup);

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
    number,
    series,
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
  // (Só quando a coluna não existe. Nota repetida também cita "access_key" na mensagem, e essa tem de ser barrada.)
  if (error && error.code !== "23505" && /access_key/.test(error.message) && /column|schema cache/i.test(error.message)) {
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
  // Itens da nota (migração 025). Sem a tabela, a nota fica só com as quantidades ligadas ao pedido.
  if (nfLines.length) {
    await supabase.from("order_invoice_lines").insert(nfLines.map((l) => ({ org_id: orgId, invoice_id: invoice.id, ...l })));
  }

  // Parcelas da nota (migração 021). Sem a tabela, a nota fica sem parcelas e a comissão sai inteira.
  let instIds: string[] = [];
  if (installments.length) {
    const { data: inst, error: instErr } = await supabase
      .from("order_invoice_installments")
      .insert(
        installments.map((x, n) => ({
          org_id: orgId,
          invoice_id: invoice.id,
          position: n + 1,
          number: x.number,
          due_date: x.dueDate,
          value: x.value,
        })),
      )
      .select("id, position");
    if (!instErr && inst) instIds = [...inst].sort((a, b) => a.position - b.position).map((x) => x.id);
  }

  // Comissões desta nota: no faturamento, o valor completo; na liquidez, uma por parcela,
  // vencendo pela regra da representada aplicada ao vencimento de cada parcela.
  const pct = Number(o.commission_pct ?? 0);
  const rule = (o.principals ?? {}) as unknown as PlanRule;
  const plan = planCommissions({
    issuedAt,
    invoiceValue: round2(value),
    pct,
    installments: instIds.length ? installments : [],
    rule,
  });
  const rows = plan.map((c) => ({
    org_id: orgId,
    order_id: orderId,
    invoice_id: invoice.id,
    installment_id: c.installmentIndex != null ? instIds[c.installmentIndex] : null,
    principal_id: o.principal_id,
    seller_id: o.seller_id,
    base_value: c.base,
    pct,
    value: c.value,
    due_date: c.dueDate,
  }));
  const { error: commErr } = await supabase.from("commissions").insert(rows);
  // Sem a migração 021 (comissão por parcela), grava a comissão do jeito antigo: uma por nota.
  if (commErr && /installment_id/.test(commErr.message)) {
    const total = plan.reduce((t, c) => t + c.value, 0);
    const { installment_id: _drop, ...first } = rows[0];
    void _drop;
    await supabase.from("commissions").insert({
      ...first,
      base_value: round2(value),
      value: round2(total),
      due_date: plan[0].dueDate,
    });
  }

  await syncOrder(supabase, orderId);
  revalidatePath(here(orderId));
  revalidatePath("/pedidos");
  revalidatePath("/comissoes");
  revalidatePath("/faturamento");
  const { canSeeCommissions } = await getContext();
  const msg = canSeeCommissions ? "Faturamento registrado. A comissão ficou a receber." : "Faturamento registrado.";
  redirect(fromBilling ? `/faturamento?ok=${encodeURIComponent(msg)}` : `${here(orderId)}?ok=${encodeURIComponent(msg)}`);
}

// Exclui uma nota fiscal (só pela área de Faturamento). As comissões dela são apagadas junto.
// A nota cuja comissão já foi recebida não pode ser excluída: o recebimento precisa ser desfeito antes.
export async function deleteInvoice(invoiceId: string) {
  const { supabase, isBackOffice, user } = await getContext();
  const BILLING = "/faturamento";
  const detail = `${BILLING}?nota=${invoiceId}`;
  const { data: inv } = await supabase
    .from("order_invoices")
    .select("id, number, order_id, file_path, orders(seller_id), commissions(status)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) fail(BILLING, "Nota não encontrada.");
  const sellerId = (inv.orders as unknown as { seller_id: string } | null)?.seller_id;
  if (!isBackOffice && sellerId !== user.id) fail(detail, "Você não pode excluir esta nota.");
  const commission = (inv.commissions as unknown as { status: string }[] | null)?.[0];
  // Quem não vê comissões pergunta ao banco se a desta nota já foi recebida.
  const { data: paidRpc } = await supabase.rpc("invoice_commission_received", { p_invoice: invoiceId });
  if (commission?.status === "recebida" || paidRpc === true) {
    fail(detail, "A comissão desta nota já teve recebimento. Apague os recebimentos em Comissões antes de excluir a nota.");
  }

  // Apaga a nota; as comissões dela saem junto (ligação "em cascata" no banco).
  const { error } = await supabase.from("order_invoices").delete().eq("id", invoiceId);
  if (error) fail(detail, `Não foi possível excluir: ${error.message}`);
  if (inv.file_path) await supabase.storage.from("invoices").remove([inv.file_path]);

  await syncOrder(supabase, inv.order_id);
  revalidatePath(here(inv.order_id));
  revalidatePath(BILLING);
  revalidatePath("/comissoes");
  revalidatePath("/");
  redirect(`${BILLING}?ok=${encodeURIComponent(`NF ${inv.number ?? ""} excluída, junto com a comissão dela. O pedido voltou a esperar essa quantidade.`)}`);
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

const stripZeros = (n: string) => n.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

// Procura uma nota já lançada igual a esta. Devolve a mensagem de erro, ou null se não houver.
async function findDuplicateInvoice(
  supabase: Awaited<ReturnType<typeof getContext>>["supabase"],
  { principalId, number, series, accessKey }: { principalId: string; number: string | null; series: string | null; accessKey: string },
): Promise<string | null> {
  const label = (r: { number: string | null; orders: unknown }) => {
    const n = (r.orders as { number: number } | null)?.number;
    return `A NF ${r.number ?? ""} já foi lançada${n ? ` no pedido nº ${n}` : ""}.`;
  };
  if (accessKey) {
    const { data, error } = await supabase
      .from("order_invoices")
      .select("number, orders(number)")
      .eq("access_key", accessKey)
      .limit(1);
    if (!error && data?.length) return `${label(data[0])} (mesma chave de acesso)`;
  }
  if (!number || !stripZeros(number)) return null;
  // Mesmo número da mesma representada (zeros à esquerda e pontos não importam: "000.045.871" = "45871").
  const n = stripZeros(number);
  const { data } = await supabase
    .from("order_invoices")
    .select("number, series, orders!inner(number, principal_id)")
    .eq("orders.principal_id", principalId)
    .ilike("number", `%${n}%`)
    .limit(50);
  const same = (data ?? []).find(
    (r) => r.number && stripZeros(r.number) === n && (!series || !r.series || stripZeros(r.series) === stripZeros(series)),
  );
  return same ? label(same) : null;
}
