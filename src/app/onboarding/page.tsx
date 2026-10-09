import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createOrganization } from "./actions";
import { ErrorNote, Field, Logo, inputCls, primaryBtn } from "@/components/ui";

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
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md rounded-[1.75rem] border border-line bg-white p-7 shadow-float sm:p-10">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <span className="text-xl font-semibold tracking-tight">Representantes</span>
        </div>
        <h1 className="mt-9 text-[1.75rem] font-semibold leading-tight tracking-tight">
          Crie o seu escritório
        </h1>
        <p className="mb-7 mt-2 text-sm leading-relaxed text-muted">
          Você será o administrador e poderá convidar vendedores depois. Se trabalha sozinho, use o seu
          nome.
        </p>

        <div className="empty:hidden [&>*]:mb-4">
          <ErrorNote message={erro} />
        </div>

        <form action={createOrganization} className="grid gap-4">
          <Field label="Nome do escritório">
            <input name="name" required autoFocus className={inputCls} />
          </Field>
          <button className={`${primaryBtn} mt-2`}>Criar escritório</button>
        </form>
      </div>
    </main>
  );
}
