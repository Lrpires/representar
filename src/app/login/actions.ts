"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fail } from "@/lib/flash";
import { text } from "@/lib/format";

export async function login(formData: FormData) {
  const email = text(formData, "email");
  const password = text(formData, "password");
  if (!email || !password) fail("/login", "Informe e-mail e senha.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail("/login", "E-mail ou senha incorretos.");

  redirect("/");
}

export async function signup(formData: FormData) {
  const email = text(formData, "email");
  const password = text(formData, "password");
  if (!email) fail("/login", "Informe seu e-mail.");
  if (password.length < 8) fail("/login", "A senha precisa ter pelo menos 8 caracteres.");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });
  if (error) fail("/login", `Não foi possível criar a conta: ${error.message}`);

  if (!data.session) {
    redirect(
      `/login?ok=${encodeURIComponent("Enviamos um link de confirmação para o seu e-mail.")}`,
    );
  }
  redirect("/");
}
