"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber } from "@/lib/format";
import { formatCnpj, isValidCnpj } from "@/lib/br";

const PATH = "/representadas";

export async function createPrincipal(formData: FormData) {
  const { supabase, orgId, canManage } = await getContext();
  if (!canManage) fail(PATH, "Só administrador e gerente podem cadastrar representadas.");

  const name = text(formData, "name");
  if (!name) fail(PATH, "Informe o nome da representada.");

  const cnpj = text(formData, "cnpj");
  if (cnpj && !isValidCnpj(cnpj)) fail(PATH, "CNPJ inválido");

  const commissionRaw = text(formData, "commission");
  const commission = commissionRaw ? parseNumber(commissionRaw) : null;
  if (commission !== null && (Number.isNaN(commission) || commission < 0 || commission > 100)) {
    fail(PATH, "Informe um percentual entre 0 e 100");
  }

  const daysRaw = text(formData, "days");
  const days = daysRaw ? Number(daysRaw) : null;
  if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365)) {
    fail(PATH, "Os dias para pagamento da comissão devem ficar entre 0 e 365.");
  }

  const state = text(formData, "state").toUpperCase();
  if (state && !/^[A-Z]{2}$/.test(state)) fail(PATH, "Use a sigla do estado com 2 letras (ex.: PE).");
  const zip = text(formData, "zip").replace(/\D/g, "");

  const { error } = await supabase.from("principals").insert({
    org_id: orgId,
    name,
    legal_name: optional(formData, "legal_name"),
    cnpj: cnpj ? formatCnpj(cnpj) : null,
    zip: zip.length === 8 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : null,
    street: optional(formData, "street"),
    street_number: optional(formData, "street_number"),
    complement: optional(formData, "complement"),
    district: optional(formData, "district"),
    city: optional(formData, "city"),
    state: state || null,
    default_commission_pct: commission,
    contact: optional(formData, "contact"),
    // "Dias para pagamento": a comissão vence N dias depois do faturamento.
    ...(days !== null
      ? { commission_trigger: "faturamento", commission_close_mode: "dias_apos_evento", commission_days_after: days }
      : {}),
  });
  if (error) fail(PATH, `Não foi possível salvar: ${error.message}`);

  revalidatePath(PATH);
  redirect(`${PATH}?ok=${encodeURIComponent(`${name} cadastrada.`)}`);
}

// Liga ou desliga a representada. Desligada, ela some das listas de escolha
// (produtos e tabelas), mas nada é apagado.
export async function setPrincipalActive(id: string, active: boolean) {
  const { supabase, canManage } = await getContext();
  if (!canManage) fail(PATH, "Só administrador e gerente podem alterar representadas.");

  const { error } = await supabase.from("principals").update({ active }).eq("id", id);
  if (error) fail(PATH, `Não foi possível atualizar: ${error.message}`);

  revalidatePath(PATH);
}
