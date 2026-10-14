import Link from "next/link";
import { requestPasswordReset } from "../login/actions";
import { AuthShell } from "@/components/auth-shell";
import { SubmitButton } from "@/components/submit";
import { Icon } from "@/components/icons";
import { ErrorNote, OkNote, Field, inputCls, primaryBtn } from "@/components/ui";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { erro, ok } = await searchParams;
  return (
    <AuthShell showcase={false}>
      <Link href="/login" className="mb-8 inline-flex items-center gap-1 self-start text-[13px] text-muted hover:text-ink">
        <Icon name="arrow-left" size={14} />
        Voltar para o login
      </Link>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Esqueci minha senha</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Informe o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova.
      </p>
      <div className="mt-6 grid gap-3 empty:hidden">
        <ErrorNote message={erro} />
        <OkNote message={ok} />
      </div>
      <form action={requestPasswordReset} className="mt-6 grid gap-4">
        <Field label="E-mail">
          <input name="email" type="email" inputMode="email" autoComplete="email" required className={inputCls} />
        </Field>
        <SubmitButton className={`${primaryBtn} mt-2 sm:h-9`} pending="Enviando…">
          Enviar link
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
