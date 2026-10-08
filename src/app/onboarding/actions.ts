"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fail } from "@/lib/flash";
import { text } from "@/lib/format";

export async function createOrganization(formData: FormData) {
  const name = text(formData, "name");
  if (!name) fail("/onboarding", "Informe o nome do escritório.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", { p_name: name });
  if (error) fail("/onboarding", `Não foi possível criar o escritório: ${error.message}`);

  redirect("/");
}
