"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

type Kind = "clientes" | "representadas";
const TABLE: Record<Kind, "customers" | "principals"> = { clientes: "customers", representadas: "principals" };

// Grava a logo (o arquivo já foi enviado pelo navegador para a pasta "logos").
export async function setLogo(kind: Kind, id: string, path: string): Promise<{ error?: string }> {
  const { supabase, orgId } = await getContext();
  if (!TABLE[kind] || !path.startsWith(`${orgId}/${kind}/${id}/`)) return { error: "Arquivo inválido." };
  const { data: before } = await supabase.from(TABLE[kind]).select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from(TABLE[kind]).update({ logo_path: path }).eq("id", id);
  if (error) return { error: error.message.includes("logo_path") ? "Falta rodar a migração 015 no Supabase." : error.message };
  const old = (before as { logo_path?: string | null } | null)?.logo_path;
  if (old && old !== path) await supabase.storage.from("logos").remove([old]);
  revalidatePath(`/${kind}`);
  revalidatePath(`/${kind}/${id}`);
  return {};
}

export async function removeLogo(kind: Kind, id: string): Promise<{ error?: string }> {
  const { supabase } = await getContext();
  const { data: before } = await supabase.from(TABLE[kind]).select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from(TABLE[kind]).update({ logo_path: null }).eq("id", id);
  if (error) return { error: error.message };
  const old = (before as { logo_path?: string | null } | null)?.logo_path;
  if (old) await supabase.storage.from("logos").remove([old]);
  revalidatePath(`/${kind}`);
  revalidatePath(`/${kind}/${id}`);
  return {};
}
