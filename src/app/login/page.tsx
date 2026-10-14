import Link from "next/link";
import { login, signup } from "./actions";
import { AuthShell } from "@/components/auth-shell";
import { SubmitButton } from "@/components/submit";
import { ErrorNote, OkNote, Field, inputCls, primaryBtn } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; modo?: string }>;
}) {
  const { erro, ok, modo } = await searchParams;
  const creating = modo === "criar";

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">
        {creating ? "Crie sua conta" : "Entre na sua conta"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {creating ? (
          <>
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-pen hover:underline">
              Entrar
            </Link>
          </>
        ) : (
          <>
            Ainda não tem conta?{" "}
            <Link href="/login?modo=criar" className="font-medium text-pen hover:underline">
              Criar conta
            </Link>
          </>
        )}
      </p>

      <div className="mt-6 grid gap-3 empty:hidden">
        <ErrorNote message={erro} />
        <OkNote message={ok} />
      </div>

      <form action={creating ? signup : login} className="mt-6 grid gap-4">
        <Field label="E-mail">
          <input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="voce@empresa.com.br"
            required
            className={inputCls}
          />
        </Field>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="password" className="text-[13px] font-medium text-ink-2">
              Senha
            </label>
            {!creating ? (
              <Link href="/recuperar-senha" className="text-[13px] text-muted hover:text-pen">
                Esqueci minha senha
              </Link>
            ) : null}
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={creating ? "new-password" : "current-password"}
            minLength={creating ? 8 : undefined}
            required
            className={inputCls}
          />
          {creating ? <p className="mt-1.5 text-xs text-muted">Mínimo de 8 caracteres.</p> : null}
        </div>
        <SubmitButton className={`${primaryBtn} mt-2 sm:h-9`} pending={creating ? "Criando conta…" : "Entrando…"}>
          {creating ? "Criar conta" : "Entrar"}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
