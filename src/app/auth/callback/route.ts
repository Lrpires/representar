import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Recebe os links enviados pelo Supabase (confirmação de e-mail e troca de senha).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Para onde ir depois (ex.: /nova-senha). Só caminhos internos.
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    `${origin}/login?erro=${encodeURIComponent("Link de confirmação inválido ou expirado.")}`,
  );
}
