"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber } from "@/lib/format";
import { round2 } from "@/lib/orders";
import { PAYABLE_CATEGORIES } from "@/lib/payables";

const PATH = "/contas-a-pagar";

function back(formData: FormData, extra = "") {
  const qs = text(formData, "back");
  const base = qs.startsWith("?") && qs.length > 1 ? `${PATH}${qs}` : PATH;
  return extra ? `${base}${base.includes("?") ? "&" : "?"}${extra}` : base;
}

function done(formData: FormData, message: string): never {
  revalidatePath(PATH);
  revalidatePath("/");
  const b = back(formData);
  redirect(`${b}${b.includes("?") ? "&" : "?"}ok=${encodeURIComponent(message)}`);
}

function readPayable(formData: FormData, errPath: string) {
  const description = text(formData, "description");
  if (!description) fail(errPath, "Informe a descrição da conta.");
  const category = text(formData, "category");
  if (!PAYABLE_CATEGORIES.some((c) => c.value === category)) fail(errPath, "Escolha a categoria.");
  const amount = parseNumber(text(formData, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) fail(errPath, "Informe o valor da conta.");
  const due = text(formData, "due_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) fail(errPath, "Informe o vencimento.");
  return { description, category, amount: round2(amount), due_date: due, notes: optional(formData, "notes") };
}

// Soma meses mantendo o dia (31/01 + 1 mês = 28 ou 29/02).
function addMonths(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(y, m - 1 + n, Math.min(d, last)));
  return date.toISOString().slice(0, 10);
}

export async function createPayable(formData: FormData) {
  const { supabase, orgId, isBackOffice } = await getContext();
  const errPath = back(formData, "novo=1");
  if (!isBackOffice) fail(PATH, "Seu perfil não tem acesso às contas a pagar.");
  const fields = readPayable(formData, errPath);
  const repeat = Math.min(Math.max(Number(text(formData, "repeat") || "1"), 1), 24);
  const paidNow = formData.get("paid") === "on";

  const rows = Array.from({ length: repeat }, (_, i) => ({
    org_id: orgId,
    ...fields,
    description: repeat > 1 ? `${fields.description} (${i + 1}/${repeat})` : fields.description,
    due_date: addMonths(fields.due_date, i),
    ...(paidNow && i === 0 ? { status: "paga", paid_at: fields.due_date } : {}),
  }));
  const { error } = await supabase.from("payables").insert(rows);
  if (error) {
    if (error.message.includes("payables")) fail(errPath, "Falta rodar a migração 009 no Supabase.");
    fail(errPath, `Não foi possível salvar: ${error.message}`);
  }
  done(formData, repeat > 1 ? `${repeat} contas lançadas, uma por mês.` : "Conta lançada.");
}

export async function updatePayable(id: string, formData: FormData) {
  const { supabase } = await getContext();
  const fields = readPayable(formData, back(formData, `editar=${id}`));
  const { error } = await supabase.from("payables").update(fields).eq("id", id);
  if (error) fail(back(formData, `editar=${id}`), `Não foi possível salvar: ${error.message}`);
  done(formData, "Conta atualizada.");
}

export async function markPaid(id: string, formData: FormData) {
  const { supabase } = await getContext();
  const date = text(formData, "paid_at");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(back(formData, `pagar=${id}`), "Informe a data do pagamento.");
  const { error } = await supabase.from("payables").update({ status: "paga", paid_at: date }).eq("id", id);
  if (error) fail(back(formData), `Não foi possível salvar: ${error.message}`);
  done(formData, "Conta marcada como paga.");
}

export async function undoPaid(id: string, formData: FormData) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("payables").update({ status: "pendente", paid_at: null }).eq("id", id);
  if (error) fail(back(formData), `Não foi possível desfazer: ${error.message}`);
  done(formData, "Pagamento desfeito.");
}

export async function deletePayable(id: string, formData: FormData) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("payables").delete().eq("id", id);
  if (error) fail(back(formData), `Não foi possível excluir: ${error.message}`);
  done(formData, "Conta excluída.");
}
