import { setNewPassword } from "../login/actions";
import { AuthShell } from "@/components/auth-shell";
import { SubmitButton } from "@/components/submit";
import { ErrorNote, Field, inputCls, primaryBtn } from "@/components/ui";

// Aberta pelo link do e-mail de troca de senha (o usuário já chega com a sessão ativa).
export default async function NewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  return (
    <AuthShell showcase={false}>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Crie uma senha nova</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">Depois de salvar, você já entra no Painel.</p>
      <div className="mt-6 empty:hidden">
        <ErrorNote message={erro} />
      </div>
      <form action={setNewPassword} className="mt-6 grid gap-4">
        <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
          <input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputCls} />
        </Field>
        <SubmitButton className={`${primaryBtn} mt-2 sm:h-9`} pending="Salvando…">
          Salvar senha
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
