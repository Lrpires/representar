"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { Avatar } from "./ui";

export type MenuUser = { name: string; email: string; roleName: string; photoUrl: string | null };

// Crachá do usuário (foto, nome e perfil) com menu: Meu perfil, Configurações, Sair.
export function UserMenu({
  user,
  signOut,
  showSettings,
  variant,
}: {
  user: MenuUser;
  signOut: () => Promise<void>;
  showSettings: boolean;
  variant: "sidebar" | "header";
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
            open ? "bg-white shadow-panel" : "hover:bg-active/70"
          }`}
        >
          <Avatar name={user.name} size={32} round src={user.photoUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium leading-tight text-ink">{user.name}</span>
            <span className="block truncate text-[11px] leading-tight text-muted">{user.roleName}</span>
          </span>
          <Icon name="chevrons-updown" size={14} className="shrink-0 text-faint" />
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
          className={`absolute z-50 w-64 animate-pop-in rounded-xl bg-white p-1.5 shadow-menu ${
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
