"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text } from "@/lib/format";
import { UNITS } from "@/lib/units";

const PATH = "/produtos";

export async function createProduct(formData: FormData) {
  const { supabase, orgId, canManage } = await getContext();
  if (!canManage) fail(PATH, "Só dono e gerente podem cadastrar produtos.");

  const principalId = text(formData, "principal_id");
  const code = text(formData, "code");
  const name = text(formData, "name");
  const unit = text(formData, "unit");

  if (!principalId) fail(PATH, "Escolha a representada.");
  if (!code) fail(PATH, "Informe o código do produto.");
  if (!name) fail(PATH, "Informe o nome do produto.");
  if (!UNITS.some((u) => u.value === unit)) fail(PATH, "Escolha uma unidade de venda válida.");

  const { error } = await supabase.from("products").insert({
    org_id: orgId,
    principal_id: principalId,
    code,
    name,
    unit,
  });
  if (error) {
    if (error.code === "23505") {
      fail(PATH, "Já existe um produto com esse código nessa representada.");
    }
    fail(PATH, `Não foi possível salvar: ${error.message}`);
  }

  revalidatePath(PATH);
  redirect(PATH);
}
