import Link from "next/link";
import { getContext, roleLabel } from "@/lib/session";
import { getCounts } from "@/lib/counts";
import { setupSteps } from "@/lib/setup";
import { Nav } from "@/components/nav";
import { TopSearch } from "@/components/search";
import { Icon } from "@/components/icons";
import { Avatar, Logo } from "@/components/ui";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { orgName, role, user, canManage } = await getContext();
  const showTeam = role === "owner" || role === "manager";
  const counts = await getCounts();

  const steps = setupSteps(counts, canManage);
  const done = steps.filter((s) => s.n > 0).length;
  const next = steps.find((s) => s.n === 0);

  const navCounts = {
    "/clientes": counts.clientes,
    "/representadas": counts.representadas,
    "/produtos": counts.produtos,
    "/tabelas-de-preco": counts.tabelas,
    "/equipe": 0,
  };

  return (
    <div className="min-h-dvh bg-white">
      {/* Barra lateral (computador) */}
      <aside className="fixed inset-y-0 left-0 hidden w-[17rem] flex-col border-r border-line bg-subtle px-4 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <Logo size={38} />
          <span className="text-[1.35rem] font-semibold tracking-tight">Representantes</span>
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2.5 shadow-float">
          <Avatar name={orgName} size={34} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">{orgName}</p>
            <p className="text-xs text-muted">{roleLabel[role]}</p>
          </div>
        </div>

        <Nav variant="side" counts={navCounts} showTeam={showTeam} />

        <div className="mt-auto flex items-center gap-3 rounded-2xl px-2 py-2">
          <Avatar name={user.email ?? orgName} size={34} />
          <p className="min-w-0 flex-1 truncate text-xs text-muted" title={user.email ?? ""}>
            {user.email}
          </p>
          <form action={signOut}>
            <button
              aria-label="Sair"
              title="Sair"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-hover hover:text-ink"
            >
              <Icon name="logout" size={18} />
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
            {/* celular e tablet: marca + escritório */}
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <Logo size={36} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold leading-tight">{orgName}</p>
                <p className="text-xs text-muted">{roleLabel[role]}</p>
              </div>
            </div>

            <TopSearch />

            <div className="flex items-center gap-3">
              {next ? (
                <Link
                  href={next.href}
                  className="hidden items-center gap-3 rounded-full bg-ink py-1.5 pl-1.5 pr-5 text-white shadow-btn transition hover:bg-ink-2 md:flex"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink">
                    <Icon name="sparkle" size={18} />
                  </span>
                  <span className="leading-tight">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      Configuração
                      <span className="rounded-md bg-tint-green px-1.5 py-0.5 text-xs font-semibold text-ok">
                        {done} de {steps.length}
                      </span>
                    </span>
                    <span className="block text-xs text-white/70 underline underline-offset-2">
                      {next.title}
                    </span>
                  </span>
                </Link>
              ) : null}
              <span title={user.email ?? ""} className="hidden sm:block lg:hidden">
                <Avatar name={user.email ?? orgName} size={38} />
              </span>
              <form action={signOut} className="lg:hidden">
                <button
                  aria-label="Sair"
                  title="Sair"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-ink-2 shadow-float transition active:scale-95"
                >
                  <Icon name="logout" size={18} />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 md:px-8 md:pt-8 lg:pb-16">{children}</main>
      </div>

      <Nav variant="tabs" />
    </div>
  );
}
