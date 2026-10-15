"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

// Painel que entra pela direita (computador) ou sobe de baixo (celular).
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
      ref.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea")?.focus();
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
        className="absolute inset-0 animate-fade-in bg-[rgb(21_23_28/0.32)] md:bg-[rgb(21_23_28/0.18)]"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] animate-sheet-up flex-col overflow-hidden rounded-t-2xl bg-sheet shadow-sheet md:inset-y-2 md:left-auto md:right-2 md:max-h-none md:w-[28rem] md:animate-sheet-in md:rounded-xl"
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong md:hidden" />
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-3 md:pt-5">
          <div className="min-w-0">
            <h2 id="sheet-title" className="text-base font-semibold tracking-[-0.01em] text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p> : null}
          </div>
          <Link
            href={closeHref}
            replace
            scroll={false}
            aria-label="Fechar"
            className="-mr-1.5 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-hover hover:text-ink md:h-8 md:w-8"
          >
            <Icon name="x" size={17} />
          </Link>
        </header>
        <div className="h-px shrink-0 bg-line" />
        {children}
      </div>
    </div>
  );
}
