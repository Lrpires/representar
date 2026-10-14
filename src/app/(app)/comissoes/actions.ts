"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, parseNumber, todayISO } from "@/lib/format";
import { round2 } from "@/lib/orders";

const PATH = "/comissoes";

function back(formData: FormData) {
  const qs = text(formData, "back");
  return qs.startsWith("?") ? `${PATH}${qs}` : PATH;
}

export async function markReceived(id: string, formData: FormData) {
  const { supabase } = await getContext();
  const path = back(formData);
  // Sem data informada, vale o dia de hoje.
  const date = text(formData, "received_at") || todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(path, "Data do recebimento inválida.");
  const raw = text(formData, "received_value");
  const value = raw ? parseNumber(raw) : NaN;
  if (!Number.isFinite(value) || value < 0) fail(path, "Informe o valor recebido.");

  const { error } = await supabase
    .from("commissions")
    .update({ status: "recebida", received_at: date, received_value: round2(value) })
    .eq("id", id)
    .eq("status", "a_receber");
  if (error) fail(path, `Não foi possível salvar: ${error.message}`);
  revalidatePath(PATH);
  revalidatePath("/");
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}ok=${encodeURIComponent("Comissão marcada como recebida.")}`);
}

export async function undoReceived(id: string, formData: FormData) {
  const { supabase } = await getContext();
  const path = back(formData);
  const { error } = await supabase
    .from("commissions")
    .update({ status: "a_receber", received_at: null, received_value: null })
    .eq("id", id)
    .eq("status", "recebida");
  if (error) fail(path, `Não foi possível desfazer: ${error.message}`);
  revalidatePath(PATH);
  revalidatePath("/");
  redirect(path);
}
