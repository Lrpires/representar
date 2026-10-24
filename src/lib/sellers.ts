import type { SupabaseClient } from "@supabase/supabase-js";

export type Seller = { id: string; name: string };

// Quem pode ser vendedor de um cliente ou pedido: todo mundo da equipe, menos o financeiro.
export async function loadSellers(supabase: SupabaseClient, orgId: string): Promise<Seller[]> {
  const { data } = await supabase
    .from("members")
    .select("user_id, full_name, email, role")
    .eq("org_id", orgId)
    .neq("role", "finance");
  return (data ?? [])
    .map((m) => ({ id: m.user_id as string, name: (m.full_name || m.email || "Sem nome") as string }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
