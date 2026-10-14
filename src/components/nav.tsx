"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";
import { Avatar } from "./ui";
import type { MenuUser } from "./user-menu";

type Item = { href: string; label: string; short: string; icon: IconName };

const home: Item = { href: "/", label: "Painel", short: "Painel", icon: "home" };
const orders: Item = { href: "/pedidos", label: "Pedidos", short: "Pedidos", icon: "receipt" };
const leads: Item = { href: "/leads", label: "Leads", short: "Leads", icon: "sparkle" };
const customers: Item = { href: "/clientes", label: "Clientes", short: "Clientes", icon: "users" };
const principals: Item = { href: "/representadas", label: "Representadas", short: "Fábricas", icon: "factory" };
const products: Item = { href: "/produtos", label: "Produtos", short: "Produtos", icon: "box" };
const goals: Item = { href: "/metas", label: "Metas", short: "Metas", icon: "target" };
const commissions: Item = { href: "/comissoes", label: "Comissões", short: "Comissões", icon: "percent" };
const payables: Item = { href: "/contas-a-pagar", label: "Contas a pagar", short: "Contas", icon: "wallet" };
const team: Item = { href: "/equipe", label: "Equipe", short: "Equipe", icon: "shield" };
const settings: Item = { href: "/configuracoes", label: "Configurações", short: "Ajustes", icon: "settings" };

type Access = { showTeam?: boolean; showFinance?: boolean };

// Grupos do menu conforme o perfil (financeiro e escritório só para quem pode ver).
function groupsFor({ showTeam, showFinance }: Access): { title?: string; items: Item[] }[] {
  return [
    { items: [home, orders, goals] },
    { title: "Carteira", items: [customers, leads] },
    { title: "Financeiro", items: showFinance ? [commissions, payables] : [commissions] },
    { title: "Catálogo", items: [principals, products] },
    ...(showTeam ? [{ title: "Escritório", items: [team, settings] }] : []),
  ];
}

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
}

/* ---------- Barra lateral (computador) ---------- */

export function SideNav({
  counts = {},
  showTeam = false,
  showFinance = false,
}: { counts?: Record<string, number> } & Access) {
  const isActive = useActive();
  const all = groupsFor({ showTeam, showFinance });

  return (
    <nav aria-label="Principal" className="mt-4 flex flex-col gap-5">
      {all.map((group, gi) => (
        <div key={group.title ?? gi} className="flex flex-col gap-px">
          {group.title ? (
            <p className="mb-1 px-2 text-xs font-medium text-faint">{group.title}</p>
          ) : null}
          {group.items.map((item) => {
            const active = isActive(item.href);
            const n = counts[item.href] ?? 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] transition-colors ${
                  active
                    ? "bg-white font-medium text-ink shadow-panel"
                    : "text-ink-2 hover:bg-active/70 hover:text-ink"
                }`}
              >
                <Icon
                  name={item.icon}
                  size={16}
                  strokeWidth={active ? 1.8 : 1.6}
                  className={active ? "text-pen" : "text-muted group-hover:text-ink-2"}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {n > 0 ? <span className="text-xs tabular-nums text-faint">{n}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/* ---------- Barra de abas (celular e tablet) ---------- */

const tabItems: Item[] = [home, orders, customers, leads];

export function MobileTabs({
  showTeam = false,
  showFinance = false,
  orgName,
  user,
  signOut,
}: {
  showTeam?: boolean;
  showFinance?: boolean;
  orgName: string;
  user: MenuUser;
  signOut: () => Promise<void>;
}) {
  const isActive = useActive();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreItems = [
    goals,
    commissions,
    ...(showFinance ? [payables] : []),
    principals,
    products,
    ...(showTeam ? [team, settings] : []),
  ];
  const moreActive = moreItems.some((i) => isActive(i.href));

  // Fecha o menu ao trocar de página.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const tab = (active: boolean) =>
    `flex h-full flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors ${
      active ? "text-pen" : "text-muted active:text-ink"
    }`;

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid h-[3.75rem] max-w-lg grid-cols-5">
          {tabItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={tab(active)}>
                  <Icon name={item.icon} size={22} strokeWidth={active ? 1.9 : 1.6} />
                  {item.short}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              className={`${tab(moreActive)} w-full`}
            >
              <Icon name="grid" size={22} strokeWidth={moreActive ? 1.9 : 1.6} />
              Mais
            </button>
          </li>
        </ul>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 animate-fade-in bg-[rgb(20_33_42/0.32)]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-x-0 bottom-0 animate-sheet-up rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-sheet"
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line-strong" />
            <Link href="/perfil" className="flex items-center gap-3 px-5 pb-4 pt-4 active:bg-hover">
              <Avatar name={user.name} size={44} round src={user.photoUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{user.name}</p>
                <p className="truncate text-[13px] text-muted">
                  {user.roleName} · {orgName}
                </p>
              </div>
              <span className="text-[13px] font-medium text-pen">Meu perfil</span>
            </Link>
            <ul className="mx-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
              {moreItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex h-[3.25rem] items-center gap-3 px-4 text-[15px] active:bg-hover ${
                        active ? "font-medium text-pen" : "text-ink"
                      }`}
                    >
                      <Icon name={item.icon} size={20} className={active ? "text-pen" : "text-muted"} />
                      <span className="flex-1">{item.label}</span>
                      <Icon name="chevron-right" size={16} className="text-faint" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <form action={signOut} className="mx-3 mt-3">
              <button className="flex h-[3.25rem] w-full items-center gap-3 rounded-xl border border-line px-4 text-[15px] text-alert active:bg-hover">
                <Icon name="logout" size={20} />
                Sair da conta
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
