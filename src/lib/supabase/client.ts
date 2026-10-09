import { createBrowserClient } from "@supabase/ssr";

// Cliente para uso no navegador (envio de fotos).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
