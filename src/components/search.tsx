"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// Campo de busca que filtra a lista pelo endereço (?q=...), mantendo os outros filtros.
// "hint" mostra o atalho ⌘K / Ctrl+K, que leva o cursor ao campo.
export function SearchBox({
  placeholder = "Buscar",
  className = "min-w-0 flex-1 sm:max-w-sm",
  hint = false,
}: {
  placeholder?: string;
  className?: string;
  hint?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = value.trim();
      if (next === (params.get("q") ?? "")) return;
      const sp = new URLSearchParams(params.toString());
      sp.delete("erro");
      sp.delete("novo");
      if (next) sp.set("q", next);
      else sp.delete("q");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 280);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!hint) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hint]);

  return (
    <div className={`relative ${className}`}>
      <Icon
        name="search"
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`h-12 w-full rounded-2xl border border-line-strong bg-white pl-11 text-base text-ink shadow-field transition placeholder:text-muted hover:border-faint focus:border-pen focus:ring-4 focus:ring-pen/15 sm:h-11 sm:text-sm ${
          hint ? "pr-16" : "pr-4"
        }`}
      />
      {hint ? (
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-line bg-subtle px-2 py-1 text-[11px] font-medium text-muted shadow-float">
          ⌘ K
        </kbd>
      ) : null}
    </div>
  );
}

// Busca do topo: aparece só nas telas que têm lista pesquisável.
const placeholders: Record<string, string> = {
  "/clientes": "Buscar clientes",
  "/representadas": "Buscar representadas",
  "/produtos": "Buscar produtos",
};

export function TopSearch() {
  const pathname = usePathname();
  const placeholder = placeholders[pathname];
  if (!placeholder) return <div className="hidden lg:block" />;
  return (
    <SearchBox
      key={pathname}
      hint
      placeholder={placeholder}
      className="hidden w-full max-w-sm lg:block"
    />
  );
}
