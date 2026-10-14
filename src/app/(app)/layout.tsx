import Link from "next/link";
import { getContext } from "@/lib/session";
import { getCounts } from "@/lib/counts";
import { getSettings, themeVars } from "@/lib/settings";
import { getProfile } from "@/lib/profile";
import { UserMenu } from "@/components/user-menu";
import { setupSteps } from "@/lib/setup";
import { SideNav, MobileTabs } from "@/components/nav";
import { Icon } from "@/components/icons";
import { Logo, Progress } from "@/components/ui";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { orgName, role, canManage } = await getContext();
  const showTeam = role === "owner" || role === "manager";
  const showFinance = role !== "seller";
  const canOrder = role !== "finance";
  const [counts, settings, profile] = await Promise.all([getCounts(), getSettings(), getProfile()]);
  const menuUser = { name: profile.name, email: profile.email, roleName: profile.roleName, photoUrl: profile.photoUrl };

  const steps = setupSteps(counts, canManage);
  const done = steps.filter((s) => s.n > 0).length;
  const next = steps.find((s) => s.n === 0);

  const navCounts = {
    "/clientes": counts.clientes,
    "/representadas": counts.representadas,
    "/produtos": counts.produtos,
    "/pedidos": counts.pedidos,
  };

  return (
    <div className="min-h-dvh">
      {/* Cor escolhida nas configurações do escritório */}
      <style>{`:root{${themeVars(settings.color)}}`}</style>
      {/* ---------- Barra lateral (computador) ---------- */}
      <aside className="scroll-thin fixed inset-y-0 left-0 hidden w-60 flex-col overflow-y-auto px-3 pb-3 pt-3 lg:flex">
        <Link href="/" className="flex min-h-10 items-center gap-2.5 rounded-md px-2 py-1 transition hover:bg-active/60">
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt={orgName} className="max-h-9 max-w-[10rem] object-contain" />
          ) : (
            <>
              <Logo size={24} />
              <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold leading-tight">{orgName}</p>
            </>
          )}
        </Link>

        {canOrder ? (
          <Link
            href="/pedidos/novo"
            className="mt-3 flex h-8 items-center gap-2 rounded-md border border-line-strong bg-white px-2 text-[13px] font-medium text-ink shadow-field transition hover:bg-subtle"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded bg-pen text-white">
              <Icon name="plus" size={12} strokeWidth={2.4} />
            </span>
            Novo pedido
          </Link>
        ) : null}

        <SideNav counts={navCounts} showTeam={showTeam} showFinance={showFinance} />

        <div className="mt-auto grid gap-2 pt-6">
          {next ? (
            <Link
              href={next.href}
              className="group block rounded-lg border border-line bg-white p-3 shadow-field transition hover:border-line-strong"
            >
              <span className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">Configuração inicial</span>
                <span className="tabular-nums text-muted">
                  {done}/{steps.length}
                </span>
              </span>
              <span className="mt-2 block">
                <Progress value={done} max={steps.length} />
              </span>
              <span className="mt-2 flex items-center gap-1 text-xs text-muted group-hover:text-ink-2">
                {next.title}
                <Icon name="arrow-right" size={12} className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ) : null}

          <UserMenu user={menuUser} signOut={signOut} showSettings={showTeam} variant="sidebar" />
        </div>
      </aside>

      {/* ---------- Topo (celular e tablet) ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2.5 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt={orgName} className="max-h-8 max-w-[9rem] object-contain" />
            ) : (
              <>
                <Logo size={28} />
                <span className="truncate text-[15px] font-semibold">{orgName}</span>
              </>
            )}
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {next ? (
              <Link
                href={next.href}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-pen-soft px-3 text-xs font-medium text-pen-ink"
              >
                Configuração {done}/{steps.length}
              </Link>
            ) : null}
            <UserMenu user={menuUser} signOut={signOut} showSettings={showTeam} variant="header" />
          </div>
        </div>
      </header>

      {/* ---------- Conteúdo ---------- */}
      <div className="lg:py-2 lg:pl-60 lg:pr-2">
        <div className="min-h-[calc(100dvh-1rem)] bg-white lg:rounded-xl lg:shadow-panel">
          <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:px-10 lg:pb-16 lg:pt-10">
            {children}
          </main>
        </div>
      </div>

      <MobileTabs
        showTeam={showTeam}
        showFinance={showFinance}
        orgName={orgName}
        user={menuUser}
        signOut={signOut}
      />
    </div>
  );
}
