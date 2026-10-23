"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber, todayISO } from "@/lib/format";
import { round2 } from "@/lib/orders";

const PATH = "/comissoes";

function back(formData: FormData) {
  const qs = text(formData, "back");
  return qs.startsWith("?") ? `${PATH}${qs}` : PATH;
}

function done(path: string, message: string): never {
  revalidatePath(PATH);
  revalidatePath("/");
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}ok=${encodeURIComponent(message)}`);
}

async function allowed() {
  const ctx = await getContext();
  if (!ctx.canSeeCommissions) throw new Error("Seu perfil não acessa comissões.");
  return ctx;
}

const MIGRATION = "Falta rodar a migração 020 no Supabase.";

// Lança um recebimento (pode ser só uma parte). A soma dos recebimentos fecha a comissão sozinha.
export async function addReceipt(commissionId: string, formData: FormData) {
  const { supabase, orgId } = await allowed();
  const path = back(formData);
  const date = text(formData, "received_at") || todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(path, "Data do recebimento inválida.");
  const raw = text(formData, "amount");
  const amount = raw ? parseNumber(raw) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) fail(path, "Informe o valor recebido.");

  const { data: c } = await supabase.from("commissions").select("status").eq("id", commissionId).maybeSingle();
  if (!c) fail(path, "Comissão não encontrada.");
  if (c.status !== "a_receber") fail(path, "Esta comissão não está em aberto.");

  const { error } = await supabase
    .from("commission_receipts")
    .insert({ org_id: orgId, commission_id: commissionId, amount: round2(amount), received_at: date, notes: optional(formData, "notes") });
  if (error) fail(path, error.message.includes("commission_receipts") ? MIGRATION : `Não foi possível salvar: ${error.message}`);
  done(path, "Recebimento lançado.");
}

// Apaga um recebimento lançado por engano (a comissão volta a ficar em aberto, se faltar valor).
export async function deleteReceipt(receiptId: string, formData: FormData) {
  const { supabase } = await allowed();
  const path = back(formData);
  const { error } = await supabase.from("commission_receipts").delete().eq("id", receiptId);
  if (error) fail(path, `Não foi possível apagar: ${error.message}`);
  done(path, "Recebimento apagado.");
}

// Encerra a comissão com o que já entrou (ex.: devolução parcial da nota, cliente não pagou).
export async function closeCommission(commissionId: string, formData: FormData) {
  const { supabase } = await allowed();
  const path = back(formData);
  const reason = text(formData, "reason");
  const details = optional(formData, "details");
  if (!reason) fail(`${path}${path.includes("?") ? "&" : "?"}encerrar=${commissionId}`, "Escolha o motivo.");
  const { error } = await supabase
    .from("commissions")
    .update({ status: "encerrada", closed_at: todayISO(), close_reason: details ? `${reason}: ${details}` : reason })
    .eq("id", commissionId)
    .eq("status", "a_receber");
  if (error) fail(path, error.message.includes("close_reason") || error.message.includes("status_check") ? MIGRATION : `Não foi possível encerrar: ${error.message}`);
  done(path, "Comissão encerrada.");
}

// Reabre uma comissão encerrada: volta a esperar o que falta (ou fica recebida, se já entrou tudo).
export async function reopenCommission(commissionId: string, formData: FormData) {
  const { supabase } = await allowed();
  const path = back(formData);
  const { data: c } = await supabase.from("commissions").select("value, received_value").eq("id", commissionId).maybeSingle();
  if (!c) fail(path, "Comissão não encontrada.");
  const full = Number(c.received_value ?? 0) >= Number(c.value) - 0.009 && Number(c.value) > 0;
  const { error } = await supabase
    .from("commissions")
    .update({ status: full ? "recebida" : "a_receber", closed_at: null, close_reason: null })
    .eq("id", commissionId)
    .eq("status", "encerrada");
  if (error) fail(path, `Não foi possível reabrir: ${error.message}`);
  done(path, "Comissão reaberta.");
}
