"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional } from "@/lib/format";

const PATH = "/clientes";

export async function createCustomer(formData: FormData) {
  const { supabase, orgId, user } = await getContext();

  const name = text(formData, "name");
  if (!name) fail(PATH, "Informe o nome do cliente.");

  const { error } = await supabase.from("customers").insert({
    org_id: orgId,
    seller_id: user.id,
    name,
    cnpj: optional(formData, "cnpj"),
    address: optional(formData, "address"),
  });
  if (error) fail(PATH, `Não foi possível salvar: ${error.message}`);

  revalidatePath(PATH);
  redirect(PATH);
}
