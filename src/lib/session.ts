import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { setActiveFormat, toFmt } from "@/lib/number-format";

export type Role = "owner" | "manager" | "seller" | "finance";

export const roleLabel: Record<Role, string> = {
  owner: "Administrador",
  manager: "Gerente",
  seller: "Vendedor",
  finance: "Financeiro",
};

export const roleHint: Record<Role, string> = {
  owner: "Acesso total, inclusive equipe e configurações.",
  manager: "Cadastra e altera representadas, produtos e preços. Vê a equipe. Não vê comissões.",
  seller: "Consulta o catálogo e trabalha a própria carteira e pedidos. Não vê comissões.",
  finance: "Consulta o catálogo e acompanha comissões e recebimentos.",
};

export const ROLES: Role[] = ["owner", "manager", "seller", "finance"];

// Usuário logado + escritório + papel. Quem não tem escritório vai para o onboarding.
// Quem participa de mais de um escritório escolhe qual abrir (menu do usuário); a escolha fica num cookie.
// Sem escolha (ou escolha inválida), abre o primeiro escritório do usuário.
export const ORG_COOKIE = "rep_org";
export const getContext = cache(async () => {
  const supabase = await createClient();
  // O middleware já validou o login no servidor do Supabase nesta mesma requisição.
  // Aqui só lemos o token (checagem local, sem ir à rede) para ganhar velocidade.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");
  const user = { id: claims.sub as string, email: (claims.email as string | undefined) ?? "" };

  // Traz também a moeda e o formato dos números do escritório (migração 020); sem eles, só o nome.
  const chosen = (await cookies()).get(ORG_COOKIE)?.value;
  const findMembership = async (orgId?: string) => {
    const q = (cols: string) => {
      let query = supabase.from("members").select(cols).eq("user_id", user.id);
      if (orgId) query = query.eq("org_id", orgId);
      return query.order("created_at", { ascending: true }).limit(1).maybeSingle();
    };
    const full = await q("org_id, role, organizations(name, currency, number_style, number_group)");
    const res = full.error ? await q("org_id, role, organizations(name)") : full;
    return res as unknown as { data: { org_id: string; role: string; organizations: unknown } | null };
  };

  let { data: membership } = chosen && /^[0-9a-f-]{36}$/.test(chosen) ? await findMembership(chosen) : { data: null };
  if (!membership) ({ data: membership } = await findMembership());

  // Quem foi convidado entra no escritório que o convidou, em vez de criar um novo.
  if (!membership) {
    const { data: accepted } = await supabase.rpc("accept_invites");
    if (accepted && Number(accepted) > 0) ({ data: membership } = await findMembership());
  }

  if (!membership) redirect("/onboarding");

  const org = membership.organizations as unknown as { name: string; currency?: string; number_style?: string; number_group?: boolean } | null;
  const role = membership.role as Role;
  const numberFormat = toFmt(org);
  setActiveFormat(numberFormat);

  return {
    supabase,
    user,
    orgId: membership.org_id as string,
    orgName: org?.name ?? "Meu escritório",
    numberFormat,
    role,
    canManage: role === "owner" || role === "manager",
    isOwner: role === "owner",
    isBackOffice: role === "owner" || role === "manager" || role === "finance",
    // Valores de comissão: só o administrador e o financeiro (vendedor e gerente não veem).
    canSeeCommissions: role === "owner" || role === "finance",
  };
});
