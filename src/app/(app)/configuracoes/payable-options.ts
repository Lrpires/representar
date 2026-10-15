"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text } from "@/lib/format";
import type { PayableOptionKind } from "@/lib/payables";

const PATH = "/configuracoes";
const KINDS: PayableOptionKind[] = ["tipo", "centro", "forma"];

function done(message: string): never {
  revalidatePath(PATH);
  revalidatePath("/contas-a-pagar");
  redirect(`${PATH}?ok=${encodeURIComponent(message)}#contas`);
}

async function ownerOnly() {
  const ctx = await getContext();
  if (!ctx.isOwner) fail(PATH, "Só o administrador pode alterar os cadastros das contas a pagar.");
  return ctx;
}

export async function addPayableOption(kind: PayableOptionKind, formData: FormData) {
  const { supabase, orgId } = await ownerOnly();
  if (!KINDS.includes(kind)) fail(PATH, "Cadastro inválido.");
  const name = text(formData, "name");
  if (!name) fail(PATH, "Digite o nome antes de adicionar.");
  const { data: last } = await supabase
    .from("payable_options")
    .select("sort")
    .eq("kind", kind)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("payable_options").insert({ org_id: orgId, kind, name, sort: (last?.sort ?? 0) + 1 });
  if (error?.code === "23505") fail(PATH, `"${name}" já existe nesta lista.`);
  if (error?.message.includes("payable_options")) fail(PATH, "Falta rodar a migração 018 no Supabase.");
  if (error) fail(PATH, `Não foi possível adicionar: ${error.message}`);
  done(`"${name}" adicionado.`);
}

export async function togglePayableOption(id: string, active: boolean) {
  const { supabase } = await ownerOnly();
  const { error } = await supabase.from("payable_options").update({ active }).eq("id", id);
  if (error) fail(PATH, `Não foi possível salvar: ${error.message}`);
  done(active ? "Item reativado." : "Item arquivado: some das opções, mas as contas antigas continuam com ele.");
}

export async function deletePayableOption(id: string) {
  const { supabase } = await ownerOnly();
  const { error } = await supabase.from("payable_options").delete().eq("id", id);
  if (error) fail(PATH, `Não foi possível excluir: ${error.message}`);
  done("Item excluído.");
}

// Recria a lista pronta (só o que estiver faltando).
export async function restorePayableDefaults() {
  const { supabase, orgId } = await ownerOnly();
  const { error } = await supabase.rpc("restore_payable_options", { p_org: orgId });
  if (error) fail(PATH, "Falta rodar a migração 018 no Supabase.");
  done("Lista pronta restaurada.");
}
