"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text } from "@/lib/format";
import { UNITS } from "@/lib/units";
import { CURRENCIES } from "@/lib/number-format";

const PATH = "/configuracoes";

export async function saveSettings(formData: FormData) {
  const { supabase, orgId, isOwner } = await getContext();
  if (!isOwner) fail(PATH, "Só o administrador pode alterar as configurações.");

  const name = text(formData, "name");
  if (!name) fail(PATH, "Informe o nome do escritório.");

  const color = text(formData, "brand_color").toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(color)) fail(PATH, "Escolha uma cor válida.");

  const valid = new Set(UNITS.map((u) => u.value));
  const units = formData.getAll("units").map(String).filter((u) => valid.has(u));
  if (units.length === 0) fail(PATH, "Deixe pelo menos uma unidade de venda marcada.");
  // Todas marcadas = sem filtro (novas unidades aparecem automaticamente).
  const enabled = units.length === valid.size ? null : units;

  const start = Number(text(formData, "order_number_start") || "1");
  if (!Number.isInteger(start) || start < 1 || start > 99999999) {
    fail(PATH, "O número inicial do pedido deve ser um número inteiro a partir de 1.");
  }
  const prefix = text(formData, "order_prefix");
  const suffix = text(formData, "order_suffix");
  if (prefix.length > 12 || suffix.length > 12) fail(PATH, "Prefixo e sufixo podem ter até 12 caracteres.");

  const warn = Number(text(formData, "order_warn_days") || "7");
  const critical = Number(text(formData, "order_critical_days") || "15");
  if (!Number.isInteger(warn) || warn < 1 || warn > 365) fail(PATH, "O prazo de aviso deve ser de 1 a 365 dias.");
  if (!Number.isInteger(critical) || critical <= warn || critical > 730) {
    fail(PATH, "O prazo crítico precisa ser maior que o prazo de aviso.");
  }

  // Moeda e formato dos números (migração 020).
  const currency = text(formData, "currency") || "BRL";
  if (!CURRENCIES.some((c) => c.code === currency)) fail(PATH, "Escolha uma moeda da lista.");
  const numberStyle = text(formData, "number_style") === "us" ? "us" : "br";
  const numberGroup = formData.get("number_group") === "on";
  const numbers = { currency, number_style: numberStyle, number_group: numberGroup };

  const base = {
      name,
      brand_color: color,
      enabled_units: enabled,
      order_number_start: start,
      order_prefix: prefix || null,
      order_suffix: suffix || null,
  };
  // Os prazos dependem da migração 017; sem ela, salva o resto normalmente.
  let { error } = await supabase
    .from("organizations")
    .update({ ...base, ...numbers, order_warn_days: warn, order_critical_days: critical })
    .eq("id", orgId);
  // Sem a migração 020 (moeda e números), salva o resto.
  if (error && /currency|number_style|number_group/.test(error.message)) {
    ({ error } = await supabase
      .from("organizations")
      .update({ ...base, order_warn_days: warn, order_critical_days: critical })
      .eq("id", orgId));
  }
  if (error?.message.includes("order_warn_days") || error?.message.includes("order_critical_days")) {
    ({ error } = await supabase.from("organizations").update(base).eq("id", orgId));
  }
  if (error) {
    if (error.message.includes("column")) {
      fail(PATH, "Falta rodar a migração 008 no Supabase para salvar as configurações.");
    }
    fail(PATH, `Não foi possível salvar: ${error.message}`);
  }

  // Tabelas de preço ligadas ou não (migração 022); sem ela, fica como está.
  await supabase.from("organizations").update({ use_price_tables: formData.get("use_price_tables") === "on" }).eq("id", orgId);

  revalidatePath("/", "layout");
  redirect(`${PATH}?ok=${encodeURIComponent("Configurações salvas.")}`);
}

// Chamado pelo envio da logo (o arquivo já foi para o armazenamento pelo navegador).
export async function setLogo(path: string): Promise<{ error?: string }> {
  const { supabase, orgId, isOwner } = await getContext();
  if (!isOwner) return { error: "Só o administrador pode trocar a logo." };
  if (!path.startsWith(`${orgId}/marca/`)) return { error: "Arquivo inválido." };

  const { data: before } = await supabase.from("organizations").select("logo_path").eq("id", orgId).maybeSingle();
  const { error } = await supabase.from("organizations").update({ logo_path: path }).eq("id", orgId);
  if (error) return { error: error.message };

  // Apaga a logo antiga para não acumular arquivos.
  if (before?.logo_path && before.logo_path !== path) {
    await supabase.storage.from("product-images").remove([before.logo_path]);
  }
  revalidatePath("/", "layout");
  return {};
}

export async function removeLogo() {
  const { supabase, orgId, isOwner } = await getContext();
  if (!isOwner) fail(PATH, "Só o administrador pode remover a logo.");
  const { data } = await supabase.from("organizations").select("logo_path").eq("id", orgId).maybeSingle();
  await supabase.from("organizations").update({ logo_path: null }).eq("id", orgId);
  if (data?.logo_path) await supabase.storage.from("product-images").remove([data.logo_path]);
  revalidatePath("/", "layout");
  redirect(`${PATH}?ok=${encodeURIComponent("Logo removida.")}`);
}

// LGPD: apaga o escritório inteiro (todos os dados) e encerra a sessão.
export async function deleteOrganization(formData: FormData) {
  const { supabase, orgId, orgName, isOwner } = await getContext();
  if (!isOwner) fail(PATH, "Só o administrador pode excluir o escritório.");
  if (text(formData, "confirm") !== orgName) {
    fail(PATH, "Para excluir, digite o nome do escritório exatamente como aparece.");
  }

  // Arquivos guardados (logo, fotos de produtos, notas fiscais).
  for (const bucket of ["product-images", "invoices"]) {
    const { data: folders } = await supabase.storage.from(bucket).list(orgId, { limit: 1000 });
    for (const f of folders ?? []) {
      const { data: files } = await supabase.storage.from(bucket).list(`${orgId}/${f.name}`, { limit: 1000 });
      const paths = (files ?? []).map((x) => `${orgId}/${f.name}/${x.name}`);
      if (paths.length) await supabase.storage.from(bucket).remove(paths);
    }
  }

  const { data: deleted, error } = await supabase.from("organizations").delete().eq("id", orgId).select("id");
  // Sem a regra da migração 009 o banco não apaga (e não avisa): conferimos.
  if (error || !deleted?.length) {
    fail(PATH, `Não foi possível excluir${error ? `: ${error.message}` : ""}. Confira se a migração 009 foi rodada.`);
  }

  await supabase.auth.signOut();
  redirect(`/login?ok=${encodeURIComponent("Escritório e dados excluídos.")}`);
}
