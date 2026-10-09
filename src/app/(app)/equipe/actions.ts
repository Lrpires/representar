"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext, ROLES, type Role } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional } from "@/lib/format";

const PATH = "/equipe";

function done(message: string): never {
  revalidatePath(PATH);
  redirect(`${PATH}?ok=${encodeURIComponent(message)}`);
}

const isRole = (r: string): r is Role => (ROLES as string[]).includes(r);

export async function inviteMember(formData: FormData) {
  const { supabase, orgId, user, isOwner } = await getContext();
  if (!isOwner) fail(PATH, "Só o administrador pode convidar pessoas.");

  const email = text(formData, "email").toLowerCase();
  const role = text(formData, "role");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(PATH, "Informe um e-mail válido.");
  if (!isRole(role)) fail(PATH, "Escolha o perfil.");

  const { data: already } = await supabase
    .from("members")
    .select("id")
    .eq("org_id", orgId)
    .ilike("email", email)
    .maybeSingle();
  if (already) fail(PATH, "Essa pessoa já faz parte da equipe.");

  const { error } = await supabase.from("invites").insert({
    org_id: orgId,
    email,
    full_name: optional(formData, "full_name"),
    role,
    invited_by: user.id,
  });
  if (error) {
    if (error.code === "23505") fail(PATH, "Já existe um convite pendente para esse e-mail.");
    fail(PATH, `Não foi possível convidar: ${error.message}`);
  }
  done("Convite criado. Peça para a pessoa criar a conta com esse e-mail.");
}

export async function cancelInvite(inviteId: string) {
  const { supabase, isOwner } = await getContext();
  if (!isOwner) fail(PATH, "Só o administrador pode cancelar convites.");
  const { error } = await supabase.from("invites").delete().eq("id", inviteId);
  if (error) fail(PATH, `Não foi possível cancelar: ${error.message}`);
  done("Convite cancelado.");
}

async function ownerCount(orgId: string) {
  const { getContext: g } = await import("@/lib/session");
  const { supabase } = await g();
  const { count } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "owner");
  return count ?? 0;
}

export async function updateMember(memberId: string, formData: FormData) {
  const { supabase, orgId, isOwner } = await getContext();
  if (!isOwner) fail(PATH, "Só o administrador pode alterar a equipe.");

  const role = text(formData, "role");
  if (!isRole(role)) fail(PATH, "Escolha o perfil.");

  const { data: current } = await supabase
    .from("members")
    .select("role")
    .eq("id", memberId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!current) fail(PATH, "Pessoa não encontrada.");

  if (current.role === "owner" && role !== "owner" && (await ownerCount(orgId)) <= 1) {
    fail(PATH, "Você é o único administrador, então não pode mudar o próprio perfil. Para cadastrar um vendedor use o botão Convidar pessoa.");
  }

  const { error } = await supabase
    .from("members")
    .update({ role, full_name: optional(formData, "full_name") })
    .eq("id", memberId)
    .eq("org_id", orgId);
  if (error) fail(PATH, `Não foi possível salvar: ${error.message}`);
  done("Alterações salvas.");
}

export async function removeMember(memberId: string) {
  const { supabase, orgId, user, isOwner } = await getContext();
  if (!isOwner) fail(PATH, "Só o administrador pode remover pessoas.");

  const { data: m } = await supabase
    .from("members")
    .select("user_id, role")
    .eq("id", memberId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!m) fail(PATH, "Pessoa não encontrada.");
  if (m.user_id === user.id) fail(PATH, "Você não pode remover a si mesmo.");
  if (m.role === "owner" && (await ownerCount(orgId)) <= 1) {
    fail(PATH, "O escritório precisa de pelo menos um administrador.");
  }

  const { error } = await supabase.from("members").delete().eq("id", memberId).eq("org_id", orgId);
  if (error) fail(PATH, `Não foi possível remover: ${error.message}`);
  done("Pessoa removida do escritório.");
}
