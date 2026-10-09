import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "manager" | "seller" | "finance";

export const roleLabel: Record<Role, string> = {
  owner: "Administrador",
  manager: "Gerente",
  seller: "Vendedor",
  finance: "Financeiro",
};

export const roleHint: Record<Role, string> = {
  owner: "Acesso total, inclusive equipe e configurações.",
  manager: "Cadastra e altera representadas, produtos e preços. Vê a equipe.",
  seller: "Consulta o catálogo e trabalha a própria carteira e pedidos.",
  finance: "Consulta o catálogo e acompanha comissões e recebimentos.",
};

export const ROLES: Role[] = ["owner", "manager", "seller", "finance"];

// Usuário logado + escritório + papel. Quem não tem escritório vai para o onboarding.
// Hoje usa o primeiro escritório do usuário; a troca entre escritórios fica para depois.
export const getContext = cache(async () => {
  const supabase = await createClient();
  // O middleware já validou o login no servidor do Supabase nesta mesma requisição.
  // Aqui só lemos o token (checagem local, sem ir à rede) para ganhar velocidade.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");
  const user = { id: claims.sub as string, email: (claims.email as string | undefined) ?? "" };

  const findMembership = () =>
    supabase
      .from("members")
      .select("org_id, role, organizations(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

  let { data: membership } = await findMembership();

  // Quem foi convidado entra no escritório que o convidou, em vez de criar um novo.
  if (!membership) {
    const { data: accepted } = await supabase.rpc("accept_invites");
    if (accepted && Number(accepted) > 0) ({ data: membership } = await findMembership());
  }

  if (!membership) redirect("/onboarding");

  const org = membership.organizations as unknown as { name: string } | null;
  const role = membership.role as Role;

  return {
    supabase,
    user,
    orgId: membership.org_id as string,
    orgName: org?.name ?? "Meu escritório",
    role,
    canManage: role === "owner" || role === "manager",
    isOwner: role === "owner",
    isBackOffice: role === "owner" || role === "manager" || role === "finance",
  };
});
