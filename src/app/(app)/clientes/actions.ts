"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional } from "@/lib/format";
import { formatCnpj, formatPhone, isValidCnpj, isValidPhone } from "@/lib/br";

const PATH = "/clientes";
const detail = (id: string) => `${PATH}/${id}`;

// Lê e valida os campos do formulário de cliente (cadastro e edição).
function readCustomer(formData: FormData, back: string) {
  const name = text(formData, "name");
  if (!name) fail(back, "Informe a razão social do cliente.");

  const cnpj = text(formData, "cnpj");
  if (cnpj && !isValidCnpj(cnpj)) fail(back, "CNPJ inválido");

  const phone = text(formData, "phone");
  if (phone && !isValidPhone(phone)) fail(back, "Telefone incompleto. Inclua o DDD.");

  const state = text(formData, "state").toUpperCase();
  if (state && !/^[A-Z]{2}$/.test(state)) fail(back, "Use a sigla do estado com 2 letras (ex.: PE).");

  const zip = text(formData, "zip").replace(/\D/g, "");
  if (zip && zip.length !== 8) fail(back, "O CEP precisa ter 8 números.");

  return {
    name,
    cnpj: cnpj ? formatCnpj(cnpj) : null,
    contact_name: optional(formData, "contact_name"),
    phone: phone ? formatPhone(phone) : null,
    city: optional(formData, "city"),
    state: state || null,
    zip: zip ? `${zip.slice(0, 5)}-${zip.slice(5)}` : null,
    street: optional(formData, "street"),
    street_number: optional(formData, "street_number"),
    complement: optional(formData, "complement"),
    district: optional(formData, "district"),
    notes: optional(formData, "notes"),
  };
}

export async function createCustomer(formData: FormData) {
  const { supabase, orgId, user } = await getContext();
  const back = `${PATH}?novo=1`;
  const fields = readCustomer(formData, back);

  const { data, error } = await supabase
    .from("customers")
    .insert({ org_id: orgId, seller_id: user.id, ...fields })
    .select("id")
    .single();
  if (error || !data) fail(back, `Não foi possível salvar: ${error?.message ?? "erro desconhecido"}`);

  revalidatePath(PATH);
  redirect(`${detail(data.id)}?ok=${encodeURIComponent("Cliente cadastrado.")}`);
}

export async function updateCustomer(id: string, formData: FormData) {
  const { supabase } = await getContext();
  const back = `${detail(id)}?editar=1`;
  const fields = readCustomer(formData, back);

  // Endereço mudou: a posição no mapa precisa ser recalculada.
  const { data: before } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  const addressKeys = ["zip", "street", "street_number", "district", "city", "state"] as const;
  const moved = before && addressKeys.some((k) => (before[k] ?? null) !== (fields[k] ?? null));
  const geoReset = moved && "latitude" in before ? { latitude: null, longitude: null, geo_quality: null, geocoded_at: null } : {};

  const { error } = await supabase.from("customers").update({ ...fields, ...geoReset }).eq("id", id);
  if (error) fail(back, `Não foi possível salvar: ${error.message}`);

  revalidatePath(PATH);
  revalidatePath(detail(id));
  redirect(`${detail(id)}?ok=${encodeURIComponent("Alterações salvas.")}`);
}

export async function deleteCustomer(id: string) {
  const { supabase, canManage } = await getContext();
  const back = `${detail(id)}?editar=1`;
  if (!canManage) fail(back, "Só administrador e gerente podem excluir clientes.");

  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", id);
  if ((count ?? 0) > 0) {
    fail(back, "Este cliente tem pedidos e não pode ser excluído. Você pode marcá-lo como inativo.");
  }

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) fail(back, `Não foi possível excluir: ${error.message}`);

  revalidatePath(PATH);
  redirect(`${PATH}?ok=${encodeURIComponent("Cliente excluído.")}`);
}

export async function addInteraction(customerId: string, formData: FormData) {
  const { supabase, orgId } = await getContext();
  const back = `${detail(customerId)}?aba=interacoes`;

  const note = text(formData, "note");
  if (!note) fail(back, "Escreva o que foi conversado.");

  // "2026-10-13T14:30" vindo do campo de data e hora, no fuso do Brasil.
  const when = text(formData, "happened_at");
  const happened_at = when ? new Date(`${when}:00-03:00`).toISOString() : new Date().toISOString();

  const { error } = await supabase
    .from("interactions")
    .insert({ org_id: orgId, customer_id: customerId, note, happened_at });
  if (error) fail(back, `Não foi possível registrar: ${error.message}`);

  // Próximo contato com o cliente (entra nos follow-ups do Painel).
  const next = text(formData, "next_contact");
  if (formData.has("next_contact")) {
    await supabase.from("customers").update({ next_contact: next || null }).eq("id", customerId);
  }

  revalidatePath(detail(customerId));
  redirect(`${back}&ok=${encodeURIComponent("Interação registrada.")}`);
}

export async function deleteInteraction(customerId: string, interactionId: string) {
  const { supabase } = await getContext();
  const back = `${detail(customerId)}?aba=interacoes`;
  const { error } = await supabase.from("interactions").delete().eq("id", interactionId);
  if (error) fail(back, `Não foi possível excluir: ${error.message}`);
  revalidatePath(detail(customerId));
  redirect(back);
}

// Guarda a posição do cliente no mapa (calculada no navegador a partir do endereço).
export async function saveLocation(
  id: string,
  lat: number,
  lng: number,
  quality: "endereco" | "rua" | "bairro" | "cidade" | "manual",
): Promise<{ error?: string }> {
  const { supabase } = await getContext();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: "Posição inválida." };
  // geo_version 2 = posição feita pela busca nova (a migração 014 não apaga essas).
  const patch = { latitude: lat, longitude: lng, geo_quality: quality, geocoded_at: new Date().toISOString() };
  let { error } = await supabase.from("customers").update({ ...patch, geo_version: 2 }).eq("id", id);
  if (error?.message.includes("geo_version")) ({ error } = await supabase.from("customers").update(patch).eq("id", id));
  if (error) {
    if (error.message.includes("geo_quality")) return { error: "Falta rodar a migração 014 no Supabase." };
    return { error: error.message.includes("latitude") ? "Falta rodar a migração de mapa no Supabase." : error.message };
  }
  return {};
}

// Marca que o endereço não foi encontrado (para não tentar de novo a cada visita ao mapa).
export async function markNotFound(id: string): Promise<void> {
  const { supabase } = await getContext();
  await supabase.from("customers").update({ geocoded_at: new Date().toISOString() }).eq("id", id);
}

export async function refreshClientes() {
  revalidatePath(PATH);
}
