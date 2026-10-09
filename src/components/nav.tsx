"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

type Item = {
  href: string;
  label: string;
  short: string;
  icon: IconName;
  badge?: string; // cor do contador
};

const groups: { title: string; items: Item[] }[] = [
  {
    title: "Geral",
    items: [{ href: "/", label: "Início", short: "Início", icon: "home" }],
  },
  {
    title: "Carteira",
    items: [
      { href: "/clientes", label: "Clientes", short: "Clientes", icon: "users", badge: "bg-tint-green text-ok" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      {
        href: "/representadas",
        label: "Representadas",
        short: "Fábricas",
        icon: "factory",
        badge: "bg-tint-blue text-pen-ink",
      },
      {
        href: "/produtos",
        label: "Produtos",
        short: "Produtos",
        icon: "box",
        badge: "bg-tint-orange text-[#b4470f]",
      },
      {
        href: "/tabelas-de-preco",
        label: "Tabelas de preço",
        short: "Preços",
        icon: "tag",
        badge: "bg-tint-yellow text-warn",
      },
    ],
  },
];

const teamGroup = {
  title: "Administração",
  items: [{ href: "/equipe", label: "Equipe", short: "Equipe", icon: "users" as IconName, badge: "bg-tint-blue text-pen-ink" }],
};

const tabItems: Item[] = [
  groups[0].items[0],
  groups[1].items[0],
  groups[2].items[0],
  groups[2].items[1],
  groups[2].items[2],
];

export function Nav({
  variant,
  counts = {},
  showTeam = false,
}: {
  variant: "side" | "tabs";
  counts?: Record<string, number>;
  showTeam?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  if (variant === "side") {
    return (
      <nav aria-label="Principal" className="mt-7 flex flex-col gap-6">
        {(showTeam ? [...groups, teamGroup] : groups).map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <p className="mb-1 px-3 text-sm text-muted">{group.title}</p>
            {group.items.map((item) => {
              const active = isActive(item.href);
              const n = counts[item.href] ?? 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] transition ${
                    active
                      ? "bg-active font-medium text-pen"
                      : "text-ink-2 hover:bg-hover hover:text-ink"
                  }`}
                >
                  <Icon name={item.icon} size={20} className={active ? "text-pen" : "text-ink-2"} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {n > 0 && item.badge ? (
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-xs font-semibold tabular-nums ${item.badge}`}
                    >
                      {n}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    );
  }

  // Barra inferior flutuante (celular e tablet).
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-3 bottom-3 z-40 rounded-3xl border border-line bg-white/95 p-1.5 shadow-sheet backdrop-blur-xl pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {tabItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10.5px] transition ${
                  active ? "bg-active font-semibold text-pen" : "text-muted"
                }`}
              >
                <Icon name={item.icon} size={20} strokeWidth={active ? 1.9 : 1.6} />
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
