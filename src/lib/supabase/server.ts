import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

import { cookies } from "next/headers";

// orgId: escritório aberto. Vai no cabeçalho "x-org-id" e o banco limita os dados a esse escritório (migração 024).
export async function createClient(orgId?: string) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(orgId ? { global: { headers: { "x-org-id": orgId } } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component: o middleware renova a sessão.
          }
        },
      },
    },
  );
}
