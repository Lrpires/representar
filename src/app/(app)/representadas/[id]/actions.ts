"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber } from "@/lib/format";
import { baseOptions, triggerOptions, releaseOptions, closeOptions, payOptions, valid } from "@/lib/commission";

const here = (id: string) => `/representadas/${id}`;

function done(id: string, message: string): never {
  revalidatePath(here(id));
  revalidatePath("/representadas");
  redirect(`${here(id)}?ok=${encodeURIComponent(message)}`);
}

// "12,5" -> 12.5 ; vazio -> null ; inválido -> NaN
function num(fd: FormData, key: string): number | null {
  const raw = text(fd, key);
  return raw ? parseNumber(raw) : null;
}

function inRange(n: number | null, min: number, max: number) {
  return n === null || (!Number.isNaN(n) && n >= min && n <= max);
}

export async function updatePrincipal(id: string, formData: FormData) {
  const { supabase, canManage } = await getContext();
  const path = here(id);
  if (!canManage) fail(path, "Só dono e gerente podem alterar representadas.");

  const name = text(formData, "name");
  if (!name) fail(path, "Informe o nome da representada.");

  const commission = num(formData, "commission");
  if (!inRange(commission, 0, 100)) fail(path, "A comissão deve ser um número entre 0 e 100.");

  const base = text(formData, "commission_base");
  const trigger = text(formData, "commission_trigger");
  const release = text(formData, "commission_release");
  const closeMode = text(formData, "commission_close_mode");
  const pay = text(formData, "commission_pay_method");
  if (!valid(baseOptions, base) || !valid(triggerOptions, trigger) || !valid(releaseOptions, release) ||
      !valid(closeOptions, closeMode) || !valid(payOptions, pay)) {
    fail(path, "Alguma opção da comissão é inválida. Escolha de novo e salve.");
  }

  let closeDay: number | null = null;
  let daysAfter: number | null = null;
  if (closeMode === "dia_fixo") {
    closeDay = num(formData, "commission_close_day");
    if (closeDay === null || !inRange(closeDay, 1, 31)) fail(path, "Informe o dia do mês do acerto (de 1 a 31).");
  }
  if (closeMode === "dias_apos_evento") {
    daysAfter = num(formData, "commission_days_after");
    if (daysAfter === null || !inRange(daysAfter, 0, 365)) fail(path, "Informe quantos dias depois (de 0 a 365).");
  }

  const chargeback = formData.get("commission_chargeback") === "on";
  let chargebackDays: number | null = null;
  if (chargeback) {
    chargebackDays = num(formData, "commission_chargeback_days");
    if (!inRange(chargebackDays, 0, 730)) fail(path, "Os dias de estorno devem ficar entre 0 e 730.");
  }

  const stateRaw = text(formData, "state").toUpperCase();
  if (stateRaw && !/^[A-Z]{2}$/.test(stateRaw)) fail(path, "Use a sigla do estado com 2 letras (ex.: PE).");

  const start = optional(formData, "contract_start");
  const end = optional(formData, "contract_end");
  if (start && end && end < start) fail(path, "O fim do contrato não pode ser antes do início.");

  const { error } = await supabase
    .from("principals")
    .update({
      name,
      legal_name: optional(formData, "legal_name"),
      cnpj: optional(formData, "cnpj"),
      state_reg: optional(formData, "state_reg"),
      email: optional(formData, "email"),
      phone: optional(formData, "phone"),
      website: optional(formData, "website"),
      order_email: optional(formData, "order_email"),
      zip: optional(formData, "zip"),
      street: optional(formData, "street"),
      street_number: optional(formData, "street_number"),
      complement: optional(formData, "complement"),
      district: optional(formData, "district"),
      city: optional(formData, "city"),
      state: stateRaw || null,
      contract_start: start,
      contract_end: end,
      territory: optional(formData, "territory"),
      payment_terms: optional(formData, "payment_terms"),
      contact: optional(formData, "contact"),
      notes: optional(formData, "notes"),
      default_commission_pct: commission,
      commission_base: base,
      commission_trigger: trigger,
      commission_release: release,
      commission_close_mode: closeMode,
      commission_close_day: closeDay,
      commission_days_after: daysAfter,
      commission_pay_method: pay,
      commission_needs_invoice: formData.get("commission_needs_invoice") === "on",
      commission_chargeback: chargeback,
      commission_chargeback_days: chargebackDays,
      commission_notes: optional(formData, "commission_notes"),
    })
    .eq("id", id);
  if (error) fail(path, `Não foi possível salvar: ${error.message}`);

  done(id, "Alterações salvas.");
}

// ---------- Contatos ----------

// Aceita "25/12" ou "25/12/1980". Sem ano, guarda 2000 (o ano não é mostrado).
function parseBirthday(raw: string): string | null | "invalid" {
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!m) return "invalid";
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = m[3] ? Number(m[3]) : 2000;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return "invalid";
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export async function addContact(principalId: string, formData: FormData) {
  const { supabase, orgId, canManage } = await getContext();
  const path = here(principalId);
  if (!canManage) fail(path, "Só dono e gerente podem alterar contatos.");

  const name = text(formData, "name");
  if (!name) fail(path, "Informe o nome do contato.");

  const birthday = parseBirthday(text(formData, "birthday"));
  if (birthday === "invalid") fail(path, "Aniversário inválido. Use dia/mês, por exemplo 25/12.");

  const isMain = formData.get("is_main") === "on";
  if (isMain) {
    await supabase.from("principal_contacts").update({ is_main: false }).eq("principal_id", principalId);
  }

  const { error } = await supabase.from("principal_contacts").insert({
    org_id: orgId,
    principal_id: principalId,
    name,
    role: optional(formData, "role"),
    phone: optional(formData, "phone"),
    email: optional(formData, "email"),
    birthday,
    is_main: isMain,
  });
  if (error) fail(path, `Não foi possível salvar o contato: ${error.message}`);

  done(principalId, "Contato adicionado.");
}

export async function deleteContact(principalId: string, contactId: string) {
  const { supabase, canManage } = await getContext();
  if (!canManage) fail(here(principalId), "Só dono e gerente podem alterar contatos.");
  const { error } = await supabase.from("principal_contacts").delete().eq("id", contactId);
  if (error) fail(here(principalId), `Não foi possível remover: ${error.message}`);
  done(principalId, "Contato removido.");
}

// ---------- Faixas de comissão por desconto ----------

export async function addTier(principalId: string, formData: FormData) {
  const { supabase, orgId, canManage } = await getContext();
  const path = here(principalId);
  if (!canManage) fail(path, "Só dono e gerente podem alterar as faixas.");

  const from = num(formData, "discount_from") ?? 0;
  const to = num(formData, "discount_to");
  const rate = num(formData, "commission_pct");
  if (!inRange(from, 0, 100) || !inRange(to, 0, 100)) fail(path, "O desconto deve ficar entre 0 e 100.");
  if (to !== null && to < from) fail(path, "O desconto final não pode ser menor que o inicial.");
  if (rate === null || !inRange(rate, 0, 100)) fail(path, "Informe a comissão da faixa (entre 0 e 100).");

  const { error } = await supabase.from("principal_commission_tiers").insert({
    org_id: orgId,
    principal_id: principalId,
    discount_from: from,
    discount_to: to,
    commission_pct: rate,
  });
  if (error) fail(path, `Não foi possível salvar a faixa: ${error.message}`);

  done(principalId, "Faixa adicionada.");
}

export async function deleteTier(principalId: string, tierId: string) {
  const { supabase, canManage } = await getContext();
  if (!canManage) fail(here(principalId), "Só dono e gerente podem alterar as faixas.");
  const { error } = await supabase.from("principal_commission_tiers").delete().eq("id", tierId);
  if (error) fail(here(principalId), `Não foi possível remover: ${error.message}`);
  done(principalId, "Faixa removida.");
}
