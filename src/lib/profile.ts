import { cache } from "react";
import { getContext, roleLabel } from "@/lib/session";
import { avatarUrl } from "@/lib/storage";

export type Profile = {
  name: string;
  firstName: string;
  email: string;
  phone: string;
  photoUrl: string | null;
  photoPath: string | null;
  roleName: string;
};

// Perfil de quem está usando (nome, foto, telefone). Funciona mesmo antes da migração 010.
export const getProfile = cache(async (): Promise<Profile> => {
  const { supabase, user, orgId, role } = await getContext();
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();
  const m = (data ?? {}) as { full_name?: string | null; phone?: string | null; avatar_path?: string | null };
  const name = m.full_name?.trim() || user.email.split("@")[0];
  return {
    name,
    firstName: name.split(/\s+/)[0],
    email: user.email,
    phone: m.phone ?? "",
    photoPath: m.avatar_path ?? null,
    photoUrl: m.avatar_path ? avatarUrl(m.avatar_path) : null,
    roleName: roleLabel[role],
  };
});
