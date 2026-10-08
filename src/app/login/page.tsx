import { login, signup } from "./actions";
import { ErrorNote, OkNote, Field, Logo, inputCls, primaryBtn, ghostBtn } from "@/components/ui";

const points = ["Pedido com a tabela certa", "Comissão sob controle", "Carteira no celular"];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { erro, ok } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md rounded-[1.75rem] border border-line bg-white p-7 shadow-float sm:p-10">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <span className="text-xl font-semibold tracking-tight">Representantes</span>
        </div>
        <h1 className="mt-9 text-[1.75rem] font-semibold leading-tight tracking-tight">
          Entre na sua conta
        </h1>
        <p className="mb-7 mt-2 text-sm leading-relaxed text-muted">
          Ainda não tem conta? Preencha os campos e clique em Criar conta.
        </p>

        <div className="empty:hidden [&>*]:mb-4">
          <ErrorNote message={erro} />
          <OkNote message={ok} />
        </div>

        <form className="grid gap-4">
          <Field label="E-mail">
            <input name="email" type="email" autoComplete="email" required className={inputCls} />
          </Field>
          <Field label="Senha" hint="Mínimo de 8 caracteres para criar a conta.">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputCls}
            />
          </Field>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button formAction={signup} className={ghostBtn}>
              Criar conta
            </button>
            <button formAction={login} className={primaryBtn}>
              Entrar
            </button>
          </div>
        </form>
      </div>

      <ul className="mt-6 flex max-w-md flex-wrap justify-center gap-2">
        {points.map((p) => (
          <li
            key={p}
            className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs text-ink-2 shadow-float"
          >
            {p}
          </li>
        ))}
      </ul>
    </main>
  );
}
