"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { Avatar } from "./ui";
import { ThemeSwitch } from "./theme";

export type MenuUser = { name: string; email: string; roleName: string; photoUrl: string | null };
export type Office = { id: string; name: string; current: boolean };

// Lista de escritórios para trocar (só aparece para quem participa de mais de um).
export function OfficeSwitcher({
  offices,
  switchOrg,
  itemClass,
}: {
  offices: Office[];
  switchOrg: (orgId: string) => Promise<void>;
  itemClass: string;
}) {
  if (offices.length < 2) return null;
  return (
    <div className="py-1">
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">Escritórios</p>
      {offices.map((o) => (
        <form key={o.id} action={switchOrg.bind(null, o.id)}>
          <button role="menuitem" disabled={o.current} className={`${itemClass} ${o.current ? "font-medium text-ink" : ""}`}>
            <Icon name="factory" size={16} className="text-muted" />
            <span className="min-w-0 flex-1 truncate text-left">{o.name}</span>
            {o.current ? <Icon name="check" size={15} className="text-accent-ink" /> : null}
          </button>
        </form>
      ))}
    </div>
  );
}

// Crachá do usuário (foto, nome e perfil) com menu: Meu perfil, Configurações, Sair.
export function UserMenu({
  user,
  signOut,
  showSettings,
  variant,
  offices = [],
  switchOrg,
}: {
  user: MenuUser;
  signOut: () => Promise<void>;
  showSettings: boolean;
  variant: "sidebar" | "header";
  offices?: Office[];
  switchOrg?: (orgId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-ink-2 transition hover:bg-hover hover:text-ink sm:h-9 sm:text-[13px]";

  return (
    <div ref={box} className="relative">
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${
            open ? "bg-white/10" : "hover:bg-white/[0.06]"
          }`}
        >
          <Avatar name={user.name} size={32} round src={user.photoUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium leading-tight text-white">{user.name}</span>
            <span className="block truncate text-[11px] leading-tight text-[#a8a49b]">{user.roleName}</span>
          </span>
          <Icon name="chevrons-updown" size={14} className="shrink-0 text-[#6e6b64]" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Menu do usuário"
          className="flex h-10 w-10 items-center justify-center rounded-full"
        >
          <Avatar name={user.name} size={34} round src={user.photoUrl} />
        </button>
      )}

      {open ? (
        <div
          role="menu"
          className={`absolute z-50 w-64 animate-pop-in rounded-xl bg-surface p-1.5 shadow-menu ${
            variant === "sidebar" ? "bottom-[calc(100%+6px)] left-0" : "right-0 top-[calc(100%+6px)]"
          }`}
        >
          <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
            <Avatar name={user.name} size={40} round src={user.photoUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <div className="h-px bg-line" />
          <div className="py-1">
            <Link href="/perfil" role="menuitem" className={item}>
              <Icon name="user" size={16} className="text-muted" />
              Meu perfil
            </Link>
            {showSettings ? (
              <Link href="/configuracoes" role="menuitem" className={item}>
                <Icon name="settings" size={16} className="text-muted" />
                Configurações do escritório
              </Link>
            ) : null}
          </div>
          {switchOrg && offices.length > 1 ? (
            <>
              <div className="h-px bg-line" />
              <OfficeSwitcher offices={offices} switchOrg={switchOrg} itemClass={item} />
            </>
          ) : null}
          <div className="h-px bg-line" />
          <ThemeSwitch className="px-2.5 py-2.5" />
          <div className="h-px bg-line" />
          <form action={signOut} className="pt-1">
            <button role="menuitem" className={`${item} text-alert hover:bg-alert-soft hover:text-alert`}>
              <Icon name="logout" size={16} />
              Sair
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
