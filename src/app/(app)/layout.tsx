import Link from "next/link";
import { getContext } from "@/lib/session";
import { getCounts } from "@/lib/counts";
import { getSettings, themeCss } from "@/lib/settings";
import { appThemeScript } from "@/components/theme";
import { NumberFormatProvider } from "@/components/number-format";
import { getProfile } from "@/lib/profile";
import { UserMenu } from "@/components/user-menu";
import { setupSteps } from "@/lib/setup";
import { SideNav, MobileTabs } from "@/components/nav";
import { Icon } from "@/components/icons";
import { Logo, Progress } from "@/components/ui";
import { signOut, switchOrg } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { orgName, role, canManage, canSeeCommissions, numberFormat, supabase, user, orgId } = await getContext();
  // Escritórios do usuário (para trocar pelo menu, quando tiver mais de um).
  const { data: myOrgs } = await supabase.from("members").select("org_id, organizations(name)").eq("user_id", user.id);
  const offices = (myOrgs ?? [])
    .map((m) => ({
      id: m.org_id as string,
      name: (m.organizations as unknown as { name: string } | null)?.name ?? "Escritório",
      current: m.org_id === orgId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
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
    <NumberFormatProvider value={numberFormat}>
    <div className="min-h-dvh">
      {/* Cor escolhida nas configurações do escritório */}
      <style>{themeCss(settings.color)}</style>
      {/* Tema claro/escuro escolhido neste aparelho (antes de desenhar, para não piscar) */}
      <script dangerouslySetInnerHTML={{ __html: appThemeScript }} />
      {/* ---------- Barra lateral (computador) ---------- */}
      <aside className="scroll-thin fixed inset-y-0 left-0 hidden w-60 flex-col overflow-y-auto bg-side px-3 pb-3 pt-3 text-white lg:flex">
        <Link href="/" className="flex min-h-10 items-center gap-2.5 rounded-md px-2 py-1 transition hover:bg-white/[0.06]">
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt={orgName} className="max-h-9 max-w-[10rem] object-contain" />
          ) : (
            <>
              <Logo size={24} tone="dark" />
              <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold leading-tight text-white">{orgName}</p>
            </>
          )}
        </Link>

        {canOrder ? (
          <Link
            href="/pedidos/novo"
            className="mt-3 flex h-9 items-center gap-2 rounded-lg bg-accent px-3 text-[13px] font-semibold text-on-accent transition hover:bg-accent-dark"
          >
            <Icon name="plus" size={15} strokeWidth={2.4} />
            Novo pedido
          </Link>
        ) : null}

        <SideNav counts={navCounts} showTeam={showTeam} showFinance={showFinance} showCommissions={canSeeCommissions} showPriceTables={settings.usePriceTables} />

        <div className="mt-auto grid gap-2 pt-6">
          {next ? (
            <Link
              href={next.href}
              className="group block rounded-lg border border-white/10 bg-white/[0.05] p-3 transition hover:border-white/20"
            >
              <span className="flex items-center justify-between text-xs">
                <span className="font-medium text-white">Configuração inicial</span>
                <span className="font-mono tabular-nums text-[#a8a49b]">
                  {done}/{steps.length}
                </span>
              </span>
              <span className="mt-2 block">
                <Progress value={done} max={steps.length} />
              </span>
              <span className="mt-2 flex items-center gap-1 text-xs text-[#a8a49b] group-hover:text-white">
                {next.title}
                <Icon name="arrow-right" size={12} className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ) : null}

          <UserMenu user={menuUser} signOut={signOut} showSettings={showTeam} variant="sidebar" offices={offices} switchOrg={switchOrg} />
        </div>
      </aside>

      {/* ---------- Topo (celular e tablet) ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-xl lg:hidden">
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
            <UserMenu user={menuUser} signOut={signOut} showSettings={showTeam} variant="header" offices={offices} switchOrg={switchOrg} />
          </div>
        </div>
      </header>

      {/* ---------- Conteúdo ---------- */}
      <div className="lg:py-2 lg:pl-60 lg:pr-2">
        <div className="min-h-[calc(100dvh-1rem)] bg-surface lg:rounded-xl lg:shadow-panel">
          <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:px-10 lg:pb-16 lg:pt-10">
            {children}
          </main>
        </div>
      </div>

      <MobileTabs
        showPriceTables={settings.usePriceTables}
        showTeam={showTeam}
        showFinance={showFinance}
        showCommissions={canSeeCommissions}
        orgName={orgName}
        user={menuUser}
        signOut={signOut}
        offices={offices}
        switchOrg={switchOrg}
      />
    </div>
    </NumberFormatProvider>
  );
}
