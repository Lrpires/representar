"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber } from "@/lib/format";
import { formatPhone, isValidPhone } from "@/lib/br";
import { round2 } from "@/lib/orders";
import { LEAD_STAGES, type LeadStage } from "@/lib/leads";

const PATH = "/leads";
const isStage = (s: string): s is LeadStage => LEAD_STAGES.some((x) => x.value === s);

function readLead(formData: FormData, back: string) {
  const name = text(formData, "name");
  if (!name) fail(back, "Informe o nome do prospecto.");
  const phone = text(formData, "phone");
  if (phone && !isValidPhone(phone)) fail(back, "Telefone incompleto. Inclua o DDD.");
  const next = text(formData, "next_contact");
  if (next && !/^\d{4}-\d{2}-\d{2}$/.test(next)) fail(back, "Data do próximo contato inválida.");
  const valueRaw = text(formData, "estimated_value");
  const value = valueRaw ? parseNumber(valueRaw) : null;
  if (value !== null && (!Number.isFinite(value) || value < 0)) fail(back, "Valor estimado inválido.");
  const state = text(formData, "state").toUpperCase();
  if (state && !/^[A-Z]{2}$/.test(state)) fail(back, "Use a sigla do estado com 2 letras (ex.: PE).");
  const zip = text(formData, "zip").replace(/\D/g, "");
  if (zip && zip.length !== 8) fail(back, "O CEP precisa ter 8 números.");

  return {
    name,
    zip: zip ? `${zip.slice(0, 5)}-${zip.slice(5)}` : null,
    street: optional(formData, "street"),
    street_number: optional(formData, "street_number"),
    complement: optional(formData, "complement"),
    district: optional(formData, "district"),
    state: state || null,
    company: optional(formData, "company"),
    phone: phone ? formatPhone(phone) : null,
    email: optional(formData, "email"),
    city: optional(formData, "city"),
    source: optional(formData, "source"),
    next_contact: next || null,
    estimated_value: value === null ? null : round2(value),
    notes: optional(formData, "notes"),
  };
}

export async function createLead(formData: FormData) {
  const { supabase, orgId } = await getContext();
  const back = `${PATH}?novo=1`;
  const fields = readLead(formData, back);
  const stage = text(formData, "stage");
  const { error } = await supabase
    .from("leads")
    .insert({ org_id: orgId, ...fields, stage: isStage(stage) ? stage : "novo", position: Date.now() });
  if (error) {
    if (error.message.includes("leads")) fail(back, "Falta rodar a migração 009 no Supabase.");
    fail(back, `Não foi possível salvar: ${error.message}`);
  }
  revalidatePath(PATH);
  redirect(`${PATH}?ok=${encodeURIComponent("Prospecto cadastrado.")}`);
}

export async function updateLead(id: string, formData: FormData) {
  const { supabase } = await getContext();
  const back = `${PATH}?lead=${id}&editar=1`;
  const fields = readLead(formData, back);

  // Endereço mudou: a posição no mapa precisa ser recalculada.
  const { data: before } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  const keys = ["zip", "street", "street_number", "district", "city", "state"] as const;
  const moved = before && keys.some((k) => (before[k] ?? null) !== (fields[k] ?? null));
  const geoReset = moved ? { latitude: null, longitude: null, geo_quality: null, geocoded_at: null } : {};

  const { error } = await supabase
    .from("leads")
    .update({ ...fields, ...geoReset, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail(back, `Não foi possível salvar: ${error.message}`);
  revalidatePath(PATH);
  revalidatePath("/");
  redirect(`${PATH}?lead=${id}&ok=${encodeURIComponent("Prospecto atualizado.")}`);
}

// Muda a etapa (arrastar no quadro ou escolher na ficha). Não redireciona: o quadro já mudou na tela.
export async function moveLead(id: string, stage: string, lostReason?: string): Promise<{ error?: string }> {
  const { supabase } = await getContext();
  if (!isStage(stage)) return { error: "Etapa inválida." };
  const { error } = await supabase
    .from("leads")
    .update({
      stage,
      position: Date.now(),
      ...(stage === "perdido" && lostReason ? { lost_reason: lostReason } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return {};
}

export async function setLeadStage(id: string, formData: FormData) {
  const stage = text(formData, "stage");
  const r = await moveLead(id, stage, optional(formData, "lost_reason") ?? undefined);
  if (r.error) fail(`${PATH}?lead=${id}`, r.error);
  redirect(`${PATH}?lead=${id}`);
}

// Registra a conversa e já agenda o próximo contato.
export async function addLeadInteraction(id: string, formData: FormData) {
  const { supabase, orgId } = await getContext();
  const back = `${PATH}?lead=${id}`;
  const note = text(formData, "note");
  if (!note) fail(back, "Escreva o que foi conversado.");
  const next = text(formData, "next_contact");
  const when = text(formData, "happened_at");
  const happened_at = when ? new Date(`${when}:00-03:00`).toISOString() : new Date().toISOString();

  const { error } = await supabase.from("interactions").insert({ org_id: orgId, lead_id: id, note, happened_at });
  if (error) fail(back, `Não foi possível registrar: ${error.message}`);

  const patch: Record<string, unknown> = { next_contact: next || null, updated_at: new Date().toISOString() };
  // Primeiro contato registrado num lead novo move para "Contato feito".
  const { data: lead } = await supabase.from("leads").select("stage").eq("id", id).single();
  if (lead?.stage === "novo") patch.stage = "contato_feito";
  await supabase.from("leads").update(patch).eq("id", id);

  revalidatePath(PATH);
  revalidatePath("/");
  redirect(`${back}&ok=${encodeURIComponent("Interação registrada.")}`);
}

// RN6: lead ganho vira cliente com nome e telefone já preenchidos.
export async function convertLead(id: string) {
  const { supabase, orgId, user } = await getContext();
  const back = `${PATH}?lead=${id}`;
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!lead) fail(PATH, "Prospecto não encontrado.");
  if (lead.customer_id) redirect(`/clientes/${lead.customer_id}`);

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      org_id: orgId,
      seller_id: user.id,
      name: lead.company || lead.name,
      contact_name: lead.company ? lead.name : null,
      phone: lead.phone,
      city: lead.city,
      notes: lead.notes,
      // Endereço e posição no mapa vão junto para o cliente.
      zip: lead.zip ?? null,
      street: lead.street ?? null,
      street_number: lead.street_number ?? null,
      complement: lead.complement ?? null,
      district: lead.district ?? null,
      state: lead.state ?? null,
      ...(lead.latitude != null
        ? { latitude: lead.latitude, longitude: lead.longitude, geo_quality: lead.geo_quality, geocoded_at: lead.geocoded_at }
        : {}),
    })
    .select("id")
    .single();
  if (error || !customer) fail(back, `Não foi possível criar o cliente: ${error?.message}`);

  // As conversas do lead passam a aparecer também na ficha do cliente.
  await supabase.from("interactions").update({ customer_id: customer.id }).eq("lead_id", id);
  await supabase
    .from("leads")
    .update({ customer_id: customer.id, stage: "ganho", updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(PATH);
  revalidatePath("/clientes");
  redirect(`/clientes/${customer.id}?editar=1&ok=${encodeURIComponent("Prospecto convertido em cliente. Complete o cadastro.")}`);
}

export async function deleteLead(id: string) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) fail(`${PATH}?lead=${id}`, `Não foi possível excluir: ${error.message}`);
  revalidatePath(PATH);
  redirect(`${PATH}?ok=${encodeURIComponent("Prospecto excluído.")}`);
}

/* ---------- Mapa ---------- */

export async function saveLeadLocation(
  id: string,
  lat: number,
  lng: number,
  quality: "endereco" | "rua" | "bairro" | "cidade" | "manual",
): Promise<{ error?: string }> {
  const { supabase } = await getContext();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: "Posição inválida." };
  // geo_version 2 = posição feita pela busca nova (a migração 014 não apaga essas).
  const patch = { latitude: lat, longitude: lng, geo_quality: quality, geocoded_at: new Date().toISOString() };
  let { error } = await supabase.from("leads").update({ ...patch, geo_version: 2 }).eq("id", id);
  if (error?.message.includes("geo_version")) ({ error } = await supabase.from("leads").update(patch).eq("id", id));
  if (error) {
    if (error.message.includes("geo_quality")) return { error: "Falta rodar a migração 014 no Supabase." };
    return { error: error.message.includes("latitude") ? "Falta rodar a migração de mapa no Supabase." : error.message };
  }
  return {};
}

export async function markLeadNotFound(id: string): Promise<void> {
  const { supabase } = await getContext();
  await supabase.from("leads").update({ geocoded_at: new Date().toISOString() }).eq("id", id);
}

export async function refreshLeads() {
  revalidatePath(PATH);
}
