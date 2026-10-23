"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, parseNumber } from "@/lib/format";
import { MAX_LISTS_PER_PRODUCT } from "@/lib/options";

const PATH = "/produtos/opcoes";
const here = (id: string) => `${PATH}/${id}`;

function done(path: string, message: string): never {
  revalidatePath(PATH);
  revalidatePath(path);
  revalidatePath("/pedidos", "layout");
  redirect(`${path}?ok=${encodeURIComponent(message)}`);
}

async function manager(path: string) {
  const ctx = await getContext();
  if (!ctx.canManage) fail(path, "Só administrador e gerente podem alterar as listas de opções.");
  return ctx;
}

// Uma opção por linha. Aceita "0412 Azul Marinho" ou "0412 - Azul Marinho" (código da fábrica na frente).
function parseLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\d[\w.]*)\s*[-–—:]?\s+(.+)$/);
      return m ? { code: m[1], name: m[2].trim() } : { code: null, name: l };
    })
    .filter((v) => v.name.length <= 80);
}

export async function createOptionList(formData: FormData) {
  const { supabase, orgId } = await manager(PATH);
  const kind = text(formData, "kind");
  const name = text(formData, "name");
  const principalId = text(formData, "principal_id") || null;
  if (!kind) fail(PATH, "Diga o tipo da lista (ex.: Cor, Tamanho).");
  if (!name) fail(PATH, "Dê um nome para a lista (ex.: Cartela Verão 26).");

  const { data, error } = await supabase
    .from("option_lists")
    .insert({ org_id: orgId, kind, name, principal_id: principalId })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.message.includes("option_lists")) fail(PATH, "Falta rodar a migração 022 no Supabase.");
    fail(PATH, `Não foi possível salvar: ${error?.message}`);
  }

  const values = parseLines(text(formData, "values"));
  if (values.length) {
    await supabase
      .from("option_values")
      .insert(values.map((v, position) => ({ org_id: orgId, list_id: data.id, position, ...v })));
  }
  done(here(data.id), "Lista criada. Agora escolha os produtos que usam essa lista.");
}

export async function updateOptionList(id: string, formData: FormData) {
  const { supabase } = await manager(here(id));
  const kind = text(formData, "kind");
  const name = text(formData, "name");
  if (!kind || !name) fail(here(id), "Informe o tipo e o nome da lista.");
  const { error } = await supabase
    .from("option_lists")
    .update({ kind, name, principal_id: text(formData, "principal_id") || null })
    .eq("id", id);
  if (error) fail(here(id), `Não foi possível salvar: ${error.message}`);
  done(here(id), "Lista salva.");
}

export async function deleteOptionList(id: string) {
  const { supabase } = await manager(here(id));
  const { error } = await supabase.from("option_lists").delete().eq("id", id);
  if (error) fail(here(id), `Não foi possível excluir: ${error.message}`);
  revalidatePath(PATH);
  redirect(`${PATH}?ok=${encodeURIComponent("Lista excluída. Os pedidos antigos não mudam.")}`);
}

export async function addOptionValues(listId: string, formData: FormData) {
  const { supabase, orgId } = await manager(here(listId));
  const values = parseLines(text(formData, "values"));
  if (!values.length) fail(here(listId), "Escreva ao menos uma opção (uma por linha).");

  const { data: last } = await supabase
    .from("option_values")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.position ?? -1) + 1;
  const { error } = await supabase
    .from("option_values")
    .insert(values.map((v, n) => ({ org_id: orgId, list_id: listId, position: start + n, ...v })));
  if (error) fail(here(listId), `Não foi possível salvar: ${error.message}`);
  done(here(listId), values.length === 1 ? "Opção adicionada." : `${values.length} opções adicionadas.`);
}

// Salva todas as opções da lista de uma vez (nome, código, acréscimo e se está ativa).
export async function saveOptionValues(listId: string, formData: FormData) {
  const { supabase } = await manager(here(listId));
  const ids = formData.getAll("value_id").map(String);
  for (const id of ids) {
    const name = text(formData, `name_${id}`);
    if (!name) fail(here(listId), "Toda opção precisa de um nome.");
    const rawAdjust = text(formData, `adjust_${id}`);
    const adjust = rawAdjust ? parseNumber(rawAdjust) : null;
    if (adjust != null && Number.isNaN(adjust)) fail(here(listId), `${name}: acréscimo inválido. Ex.: 2,50 ou 10.`);
    const type = text(formData, `type_${id}`) === "pct" ? "pct" : "valor";
    if (type === "pct" && adjust != null && (adjust < -100 || adjust > 1000)) {
      fail(here(listId), `${name}: o acréscimo em % deve ficar entre -100 e 1000.`);
    }
    const { error } = await supabase
      .from("option_values")
      .update({
        name,
        code: text(formData, `code_${id}`) || null,
        price_adjust: adjust || null,
        adjust_type: type,
        active: formData.get(`active_${id}`) === "on",
      })
      .eq("id", id)
      .eq("list_id", listId);
    if (error) fail(here(listId), `Não foi possível salvar: ${error.message}`);
  }
  done(here(listId), "Opções salvas.");
}

export async function deleteOptionValue(listId: string, valueId: string) {
  const { supabase } = await manager(here(listId));
  const { error } = await supabase.from("option_values").delete().eq("id", valueId).eq("list_id", listId);
  if (error) fail(here(listId), `Não foi possível excluir: ${error.message}`);
  done(here(listId), "Opção excluída. Os pedidos antigos não mudam.");
}

// Liga a lista aos produtos marcados (e desliga dos desmarcados que estavam na tela).
export async function setListProducts(listId: string, formData: FormData) {
  const { supabase, orgId } = await manager(here(listId));
  const shown = formData.getAll("shown_id").map(String);
  const checked = new Set(formData.getAll("product_id").map(String));

  const { data: current } = await supabase.from("product_option_lists").select("product_id").eq("list_id", listId);
  const had = new Set((current ?? []).map((r) => r.product_id as string));

  const add = shown.filter((id) => checked.has(id) && !had.has(id));
  const remove = shown.filter((id) => !checked.has(id) && had.has(id));

  if (add.length) {
    // Cada produto usa no máximo duas listas (a grade do pedido é linhas × colunas).
    const { data: counts } = await supabase.from("product_option_lists").select("product_id").in("product_id", add);
    const used = new Map<string, number>();
    for (const r of counts ?? []) used.set(r.product_id, (used.get(r.product_id) ?? 0) + 1);
    const full = add.filter((id) => (used.get(id) ?? 0) >= MAX_LISTS_PER_PRODUCT);
    if (full.length) {
      const { data: names } = await supabase.from("products").select("name").in("id", full).limit(3);
      fail(
        here(listId),
        `Cada produto usa no máximo ${MAX_LISTS_PER_PRODUCT} listas. Já estão cheios: ${(names ?? []).map((n) => n.name).join(", ")}${full.length > 3 ? "…" : ""}.`,
      );
    }
    const { error } = await supabase
      .from("product_option_lists")
      .insert(add.map((product_id) => ({ org_id: orgId, product_id, list_id: listId, position: used.get(product_id) ?? 0 })));
    if (error) fail(here(listId), `Não foi possível salvar: ${error.message}`);
  }
  if (remove.length) {
    await supabase.from("product_option_lists").delete().eq("list_id", listId).in("product_id", remove);
  }
  done(here(listId), `Produtos atualizados: ${add.length} ligados, ${remove.length} desligados.`);
}
