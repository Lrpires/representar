"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

// Painel flutuante (computador) que vira folha deslizante de baixo (celular).
// Quem decide se está aberto é a página, pelo endereço (?novo=1).
export function Sheet({
  open,
  title,
  description,
  closeHref,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  closeHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.replace(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // No computador, já cai no primeiro campo. No celular não, para não abrir o teclado.
    if (window.matchMedia("(min-width: 768px)").matches) {
      ref.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, closeHref, router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <Link
        href={closeHref}
        replace
        scroll={false}
        aria-label="Fechar"
        tabIndex={-1}
        className="absolute inset-0 animate-fade-in bg-ink/30 backdrop-blur-[3px]"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] animate-sheet-up flex-col rounded-t-[1.75rem] bg-sheet shadow-sheet md:inset-y-3 md:left-auto md:right-3 md:max-h-none md:w-[29rem] md:animate-sheet-in md:rounded-[1.75rem]"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong md:hidden" />
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
          <div>
            <h2 id="sheet-title" className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          <Link
            href={closeHref}
            replace
            scroll={false}
            aria-label="Fechar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink-2 shadow-float transition hover:bg-hover hover:text-ink"
          >
            <Icon name="x" size={17} />
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
