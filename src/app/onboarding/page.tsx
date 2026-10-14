import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createOrganization } from "./actions";
import { AuthShell } from "@/components/auth-shell";
import { SubmitButton } from "@/components/submit";
import { ErrorNote, Field, inputCls, primaryBtn } from "@/components/ui";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership) redirect("/");

  return (
    <AuthShell showcase={false}>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Crie o seu escritório</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        É o espaço onde ficam seus clientes, pedidos e comissões. Se trabalha sozinho, use o seu
        nome.
      </p>
      <div className="mt-6 empty:hidden">
        <ErrorNote message={erro} />
      </div>
      <form action={createOrganization} className="mt-6 grid gap-4">
        <Field label="Nome do escritório">
          <input name="name" required autoFocus placeholder="Ex.: Silva Representações" className={inputCls} />
        </Field>
        <SubmitButton className={`${primaryBtn} mt-2 sm:h-9`} pending="Criando…">
          Criar escritório
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
