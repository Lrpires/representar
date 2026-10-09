"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber } from "@/lib/format";

const PATH = "/tabelas-de-preco";

export async function createPriceTable(formData: FormData) {
  const { supabase, orgId, canManage } = await getContext();
  if (!canManage) fail(PATH, "Só administrador e gerente podem criar tabelas de preço.");

  const principalId = text(formData, "principal_id");
  const name = text(formData, "name");
  const validFrom = text(formData, "valid_from");
  const validTo = optional(formData, "valid_to");

  if (!principalId) fail(PATH, "Escolha a representada.");
  if (!name) fail(PATH, "Informe o nome da tabela.");
  if (!validFrom) fail(PATH, "Informe o início da vigência.");
  if (validTo && validTo < validFrom) fail(PATH, "O fim da vigência não pode ser antes do início.");

  const { data, error } = await supabase
    .from("price_tables")
    .insert({
      org_id: orgId,
      principal_id: principalId,
      name,
      valid_from: validFrom,
      valid_to: validTo,
    })
    .select("id")
    .single();
  if (error || !data) fail(PATH, `Não foi possível salvar: ${error?.message ?? "erro desconhecido"}`);

  revalidatePath(PATH);
  redirect(`${PATH}/${data.id}?novo=1`);
}

// Cria o preço da variação na tabela ou atualiza se já existir.
// Com "Salvar e lançar outro" (again=1), o painel reabre para o próximo preço.
export async function upsertPriceItem(tableId: string, formData: FormData) {
  const path = `${PATH}/${tableId}`;
  const { supabase, orgId, canManage } = await getContext();
  if (!canManage) fail(path, "Só administrador e gerente podem lançar preços.");

  const variantId = text(formData, "variant_id");
  const price = parseNumber(text(formData, "price"));

  if (!variantId) fail(path, "Escolha o produto.");
  if (Number.isNaN(price) || price < 0) fail(path, "Informe um preço válido, como 12,50.");

  const { error } = await supabase.from("price_items").upsert(
    { org_id: orgId, price_table_id: tableId, variant_id: variantId, price },
    { onConflict: "price_table_id,variant_id" },
  );
  if (error) fail(path, `Não foi possível salvar o preço: ${error.message}`);

  revalidatePath(path);
  redirect(text(formData, "again") === "1" ? `${path}?novo=1` : path);
}
