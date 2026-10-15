"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// Campo de busca que filtra a lista pelo endereço (?q=...), mantendo os outros filtros.
// "hint" mostra o atalho ⌘K / Ctrl+K, que leva o cursor ao campo.
export function SearchBox({
  placeholder = "Buscar",
  className = "min-w-0 flex-1 sm:max-w-xs",
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
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`h-11 w-full rounded-lg border border-line-strong bg-surface pl-9 text-base text-ink shadow-field outline-none transition-[border-color,box-shadow] placeholder:text-faint hover:border-[#bdb8ab] focus:border-accent focus:ring-[3px] focus:ring-accent/25 sm:h-8 sm:text-[13px] ${
          hint ? "pr-3 sm:pr-12" : "pr-3"
        }`}
      />
      {hint ? (
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-subtle px-1.5 py-px font-sans text-[11px] font-medium text-muted sm:block">
          ⌘K
        </kbd>
      ) : null}
    </div>
  );
}
