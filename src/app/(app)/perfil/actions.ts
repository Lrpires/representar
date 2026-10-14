"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { fail } from "@/lib/flash";
import { text } from "@/lib/format";
import { formatPhone, isValidPhone } from "@/lib/br";

const PATH = "/perfil";

async function saveMine(fullName: string, phone: string, photoPath: string | null) {
  const { supabase } = await getContext();
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: fullName,
    p_phone: phone,
    p_avatar_path: photoPath ?? "",
  });
  return error;
}

export async function saveProfile(formData: FormData) {
  const profile = await getProfile();
  const name = text(formData, "full_name");
  if (!name) fail(PATH, "Informe o seu nome.");
  const phone = text(formData, "phone");
  if (phone && !isValidPhone(phone)) fail(PATH, "Telefone incompleto. Inclua o DDD.");

  const error = await saveMine(name, phone ? formatPhone(phone) : "", profile.photoPath);
  if (error) {
    if (error.message.includes("update_my_profile")) fail(PATH, "Falta rodar a migração 010 no Supabase.");
    fail(PATH, `Não foi possível salvar: ${error.message}`);
  }
  revalidatePath("/", "layout");
  redirect(`${PATH}?ok=${encodeURIComponent("Perfil atualizado.")}`);
}

// Chamado depois que o navegador enviou a foto para a pasta do usuário.
export async function setPhoto(path: string): Promise<{ error?: string }> {
  const { supabase, user } = await getContext();
  if (!path.startsWith(`${user.id}/`)) return { error: "Foto inválida." };
  const profile = await getProfile();
  const error = await saveMine(profile.name, profile.phone, path);
  if (error) return { error: error.message.includes("update_my_profile") ? "Falta rodar a migração 010 no Supabase." : error.message };
  if (profile.photoPath && profile.photoPath !== path) await supabase.storage.from("avatars").remove([profile.photoPath]);
  revalidatePath("/", "layout");
  return {};
}

export async function removePhoto() {
  const { supabase } = await getContext();
  const profile = await getProfile();
  await saveMine(profile.name, profile.phone, null);
  if (profile.photoPath) await supabase.storage.from("avatars").remove([profile.photoPath]);
  revalidatePath("/", "layout");
  redirect(`${PATH}?ok=${encodeURIComponent("Foto removida.")}`);
}

export async function changePassword(formData: FormData) {
  const { supabase } = await getContext();
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");
  if (password.length < 8) fail(PATH, "A nova senha precisa ter pelo menos 8 caracteres.");
  if (password !== confirm) fail(PATH, "As duas senhas não são iguais.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail(PATH, `Não foi possível trocar a senha: ${error.message}`);
  redirect(`${PATH}?ok=${encodeURIComponent("Senha alterada.")}`);
}
