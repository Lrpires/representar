"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text } from "@/lib/format";
import { todayISO } from "@/lib/format";

const PATH = "/pedidos";

export async function createOrder(formData: FormData) {
  const { supabase, orgId, user, role } = await getContext();
  if (role === "finance") fail(PATH, "O perfil Financeiro não cria pedidos.");

  const principalId = text(formData, "principal_id");
  const customerId = text(formData, "customer_id");
  const date = text(formData, "order_date") || todayISO();
  if (!principalId) fail(PATH, "Escolha a representada.");
  if (!customerId) fail(PATH, "Escolha o cliente.");

  // Tabela de preço vigente mais recente dessa representada.
  const today = todayISO();
  const { data: tables } = await supabase
    .from("price_tables")
    .select("id, valid_from, valid_to")
    .eq("principal_id", principalId)
    .lte("valid_from", today)
    .order("valid_from", { ascending: false });
  const table = (tables ?? []).find((t) => !t.valid_to || t.valid_to >= today);

  const { data: created, error } = await supabase
    .from("orders")
    .insert({
      org_id: orgId,
      principal_id: principalId,
      customer_id: customerId,
      seller_id: user.id,
      price_table_id: table?.id ?? null,
      order_date: date,
      number: 0, // o banco define o número
    })
    .select("id")
    .single();
  if (error || !created) fail(PATH, `Não foi possível criar o pedido: ${error?.message}`);

  revalidatePath(PATH);
  redirect(`${PATH}/${created.id}`);
}
