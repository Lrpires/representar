"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber } from "@/lib/format";

const PATH = "/representadas";

export async function createPrincipal(formData: FormData) {
  const { supabase, orgId, canManage } = await getContext();
  if (!canManage) fail(PATH, "Só dono e gerente podem cadastrar representadas.");

  const name = text(formData, "name");
  if (!name) fail(PATH, "Informe o nome da representada.");

  const commissionRaw = text(formData, "commission");
  const commission = commissionRaw ? parseNumber(commissionRaw) : null;
  if (commission !== null && (Number.isNaN(commission) || commission < 0 || commission > 100)) {
    fail(PATH, "A comissão deve ser um número entre 0 e 100.");
  }

  const { data: created, error } = await supabase.from("principals").insert({
    org_id: orgId,
    name,
    cnpj: optional(formData, "cnpj"),
    default_commission_pct: commission,
    payment_terms: optional(formData, "terms"),
    contact: optional(formData, "contact"),
  }).select("id").single();
  if (error || !created) fail(PATH, `Não foi possível salvar: ${error?.message ?? "erro desconhecido"}`);

  revalidatePath(PATH);
  // Já abre a ficha completa para preencher o restante (endereço, comissão, contatos).
  redirect(`${PATH}/${created.id}`);
}

// Liga ou desliga a representada. Desligada, ela some das listas de escolha
// (produtos e tabelas), mas nada é apagado.
export async function setPrincipalActive(id: string, active: boolean) {
  const { supabase, canManage } = await getContext();
  if (!canManage) fail(PATH, "Só dono e gerente podem alterar representadas.");

  const { error } = await supabase.from("principals").update({ active }).eq("id", id);
  if (error) fail(PATH, `Não foi possível atualizar: ${error.message}`);

  revalidatePath(PATH);
}
