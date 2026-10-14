"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { text } from "@/lib/format";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function back(path: string, key: "erro" | "ok", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${key}=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const email = text(formData, "email");
  const password = text(formData, "password");
  if (!email || !password) back("/login", "erro", "Informe e-mail e senha.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) back("/login", "erro", "E-mail ou senha incorretos");

  redirect("/");
}

export async function signup(formData: FormData) {
  const email = text(formData, "email");
  const password = text(formData, "password");
  const page = "/login?modo=criar";
  if (!email) back(page, "erro", "Informe seu e-mail.");
  if (password.length < 8) back(page, "erro", "A senha precisa ter pelo menos 8 caracteres.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) back(page, "erro", `Não foi possível criar a conta: ${error.message}`);

  if (!data.session) back("/login", "ok", "Enviamos um link de confirmação para o seu e-mail.");
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const email = text(formData, "email");
  if (!email) back("/recuperar-senha", "erro", "Informe seu e-mail.");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/nova-senha`,
  });
  if (error) back("/recuperar-senha", "erro", "Não foi possível enviar o e-mail. Tente de novo em alguns minutos.");

  // Mesma mensagem exista ou não a conta, para não revelar quem é cliente.
  back("/recuperar-senha", "ok", "Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha.");
}

export async function setNewPassword(formData: FormData) {
  const password = text(formData, "password");
  if (password.length < 8) back("/nova-senha", "erro", "A senha precisa ter pelo menos 8 caracteres.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) back("/nova-senha", "erro", "Não foi possível trocar a senha. Peça um novo link.");

  redirect("/");
}
