"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional } from "@/lib/format";
import { loadPayouts } from "@/lib/reports";

const PATH = "/relatorios/repasse";
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// Registra o pagamento do repasse de um vendedor: soma o que está pendente no período e marca esses recebimentos.
export async function registerPayout(formData: FormData) {
  const { supabase, orgId, canSeeCommissions } = await getContext();
  const back = text(formData, "back") || PATH;
  if (!canSeeCommissions) fail(back, "Sem permissão.");
  const key = text(formData, "key");
  const start = text(formData, "start");
  const end = text(formData, "end");
  const paidAt = text(formData, "paid_at") || new Date().toISOString().slice(0, 10);
  if (!key || !isDate(start) || !isDate(end) || !isDate(paidAt)) fail(back, "Dados do repasse incompletos.");

  // Recalcula aqui (não confia no valor da tela).
  const { rows, error } = await loadPayouts({ start, end });
  if (error) fail(back, "Falta rodar a migração 029 no Supabase.");
  const row = rows.find((r) => r.key === key);
  const pending = (row?.items ?? []).filter((i) => !i.paid);
  if (!row || !pending.length) fail(back, "Não há repasse pendente para este vendedor no período.");
  if (!row.rule) fail(back, `Defina antes a regra de comissão de ${row.name} (Equipe → Comissão dos vendedores).`);
  const amount = Math.round(pending.reduce((s, i) => s + i.payout, 0) * 100) / 100;

  const { data: payout, error: e1 } = await supabase
    .from("seller_payouts")
    .insert({
      org_id: orgId,
      seller_id: key.startsWith("id:") ? key.slice(3) : null,
      seller_name: key.startsWith("nome:") ? row.name : null,
      period_start: start,
      period_end: end,
      amount,
      paid_at: paidAt,
      notes: optional(formData, "notes"),
    })
    .select("id")
    .single();
  if (e1 || !payout) fail(back, `Não foi possível registrar: ${e1?.message}`);

  const ids = pending.map((i) => i.receiptId);
  for (let i = 0; i < ids.length; i += 200) {
    await supabase.from("commission_receipts").update({ seller_payout_id: payout.id }).in("id", ids.slice(i, i + 200));
  }
  revalidatePath(PATH);
  redirect(`${back}${back.includes("?") ? "&" : "?"}ok=${encodeURIComponent(`Repasse de ${row.name} registrado.`)}`);
}

// Desfaz um pagamento de repasse: os recebimentos voltam a ficar pendentes.
export async function undoPayout(id: string, back: string) {
  const { supabase, canSeeCommissions } = await getContext();
  if (!canSeeCommissions) fail(back, "Sem permissão.");
  await supabase.from("commission_receipts").update({ seller_payout_id: null }).eq("seller_payout_id", id);
  const { error } = await supabase.from("seller_payouts").delete().eq("id", id);
  if (error) fail(back, `Não foi possível desfazer: ${error.message}`);
  revalidatePath(PATH);
  redirect(`${back}${back.includes("?") ? "&" : "?"}ok=${encodeURIComponent("Pagamento do repasse desfeito.")}`);
}
