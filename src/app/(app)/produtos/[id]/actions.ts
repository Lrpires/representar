"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber } from "@/lib/format";
import { UNITS } from "@/lib/units";

const here = (id: string) => `/produtos/${id}`;

function done(id: string, message: string): never {
  revalidatePath(here(id));
  revalidatePath("/produtos");
  redirect(`${here(id)}?ok=${encodeURIComponent(message)}`);
}

function num(fd: FormData, key: string): number | null {
  const raw = text(fd, key);
  return raw ? parseNumber(raw) : null;
}

function check(path: string, label: string, n: number | null, min: number, max: number, int = false) {
  if (n === null) return;
  if (Number.isNaN(n) || n < min || n > max || (int && !Number.isInteger(n))) {
    fail(path, `${label}: informe um número ${int ? "inteiro " : ""}entre ${min} e ${max}.`);
  }
}

export async function updateProduct(id: string, formData: FormData) {
  const { supabase, canManage } = await getContext();
  const path = here(id);
  if (!canManage) fail(path, "Só administrador e gerente podem alterar produtos.");

  const code = text(formData, "code");
  const name = text(formData, "name");
  const unit = text(formData, "unit");
  if (!code) fail(path, "Informe o código do produto.");
  if (!name) fail(path, "Informe o nome do produto.");
  if (!UNITS.some((u) => u.value === unit)) fail(path, "Escolha uma unidade válida.");

  const unitsPerPack = num(formData, "units_per_pack");
  const minOrder = num(formData, "min_order_qty");
  const multiple = num(formData, "order_multiple");
  const lead = num(formData, "lead_time_days");
  const ipi = num(formData, "ipi_pct");
  const commission = num(formData, "commission_pct");
  const weight = num(formData, "weight_kg");
  const length = num(formData, "length_cm");
  const width = num(formData, "width_cm");
  const height = num(formData, "height_cm");
  check(path, "Unidades por embalagem", unitsPerPack, 0, 1000000);
  check(path, "Pedido mínimo", minOrder, 0, 1000000);
  check(path, "Múltiplo de venda", multiple, 0, 1000000);
  check(path, "Prazo de entrega", lead, 0, 365, true);
  check(path, "IPI", ipi, 0, 100);
  check(path, "Comissão", commission, 0, 100);
  check(path, "Peso", weight, 0, 100000000);
  check(path, "Comprimento", length, 0, 100000000);
  check(path, "Largura", width, 0, 100000000);
  check(path, "Altura", height, 0, 100000000);

  // Características: pares spec_name / spec_value
  const names = formData.getAll("spec_name");
  const values = formData.getAll("spec_value");
  const specs: Record<string, string> = {};
  names.forEach((n, i) => {
    const k = typeof n === "string" ? n.trim() : "";
    const val = typeof values[i] === "string" ? (values[i] as string).trim() : "";
    if (k && val) specs[k.slice(0, 60)] = val.slice(0, 300);
  });

  const tags = Array.from(
    new Set(
      text(formData, "tags")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => t.slice(0, 40)),
    ),
  ).slice(0, 20);

  const { error } = await supabase
    .from("products")
    .update({
      code,
      name,
      unit,
      active: formData.get("active") === "on",
      brand: optional(formData, "brand"),
      category: optional(formData, "category"),
      line: optional(formData, "line"),
      short_description: optional(formData, "short_description"),
      description: optional(formData, "description"),
      units_per_pack: unitsPerPack,
      min_order_qty: minOrder,
      order_multiple: multiple,
      lead_time_days: lead,
      ipi_pct: ipi,
      commission_pct: commission,
      weight_kg: weight,
      length_cm: length,
      width_cm: width,
      height_cm: height,
      ean: optional(formData, "ean"),
      ncm: optional(formData, "ncm"),
      specs,
      tags,
      notes: optional(formData, "notes"),
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") fail(path, "Já existe outro produto com esse código nessa representada.");
    fail(path, `Não foi possível salvar: ${error.message}`);
  }
  done(id, "Produto salvo.");
}

export async function addVariant(id: string, formData: FormData) {
  const { supabase, orgId, canManage } = await getContext();
  const path = here(id);
  if (!canManage) fail(path, "Só administrador e gerente podem alterar produtos.");

  const code = text(formData, "v_code");
  if (!code) fail(path, "Informe o código da variação.");

  // "cor=azul, tamanho=M"
  const attributes: Record<string, string> = {};
  for (const part of text(formData, "v_attrs").split(",")) {
    const [k, ...rest] = part.split("=");
    const key = k?.trim();
    const val = rest.join("=").trim();
    if (key && val) attributes[key] = val;
  }

  const { error } = await supabase.from("product_variants").insert({
    org_id: orgId,
    product_id: id,
    code,
    attributes,
    ean: optional(formData, "v_ean"),
  });
  if (error) {
    if (error.code === "23505") fail(path, "Já existe uma variação com esse código neste produto.");
    fail(path, `Não foi possível adicionar: ${error.message}`);
  }
  done(id, "Variação adicionada.");
}

export async function deleteVariant(id: string, variantId: string) {
  const { supabase, canManage } = await getContext();
  const path = here(id);
  if (!canManage) fail(path, "Só administrador e gerente podem alterar produtos.");

  const { count } = await supabase
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);
  if ((count ?? 0) <= 1) fail(path, "O produto precisa ter pelo menos uma variação.");

  const { error } = await supabase.from("product_variants").delete().eq("id", variantId).eq("product_id", id);
  if (error) {
    fail(path, "Não foi possível excluir: esta variação já é usada em tabelas de preço ou pedidos.");
  }
  done(id, "Variação excluída.");
}

/* ---------- Imagens ---------- */

export async function registerImage(id: string, storagePath: string) {
  const { supabase, orgId, canManage } = await getContext();
  if (!canManage) return { error: "Sem permissão." };
  if (!storagePath.startsWith(`${orgId}/${id}/`) || storagePath.includes("..")) {
    return { error: "Caminho de imagem inválido." };
  }

  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);
  const n = count ?? 0;

  const { error } = await supabase.from("product_images").insert({
    org_id: orgId,
    product_id: id,
    path: storagePath,
    position: n,
    is_cover: n === 0,
  });
  if (error) return { error: error.message };
  revalidatePath(here(id));
  revalidatePath("/produtos");
  return { error: null };
}

export async function setCoverImage(id: string, imageId: string) {
  const { supabase, canManage } = await getContext();
  const path = here(id);
  if (!canManage) fail(path, "Sem permissão.");
  await supabase.from("product_images").update({ is_cover: false }).eq("product_id", id);
  const { error } = await supabase.from("product_images").update({ is_cover: true }).eq("id", imageId).eq("product_id", id);
  if (error) fail(path, `Não foi possível definir a capa: ${error.message}`);
  done(id, "Capa atualizada.");
}

export async function deleteImage(id: string, imageId: string) {
  const { supabase, canManage } = await getContext();
  const path = here(id);
  if (!canManage) fail(path, "Sem permissão.");

  const { data: img } = await supabase
    .from("product_images")
    .select("id, path, is_cover")
    .eq("id", imageId)
    .eq("product_id", id)
    .maybeSingle();
  if (!img) fail(path, "Imagem não encontrada.");

  await supabase.storage.from("product-images").remove([img.path]);
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) fail(path, `Não foi possível excluir: ${error.message}`);

  if (img.is_cover) {
    const { data: next } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", id)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (next) await supabase.from("product_images").update({ is_cover: true }).eq("id", next.id);
  }
  done(id, "Imagem excluída.");
}
