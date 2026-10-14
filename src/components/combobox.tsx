"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type ComboOption = { id: string; label: string; sub?: string; right?: ReactNode; search?: string };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Campo de texto com lista de sugestões filtrada enquanto digita.
// Setas escolhem, Enter confirma, Esc fecha. Com "free", o texto digitado vale mesmo sem escolher.
export function Combobox({
  value,
  onText,
  onSelect,
  options,
  placeholder,
  className,
  disabled,
  emptyText = "Nada encontrado",
  footer,
  onEnterWithoutOption,
  inputRef,
  name,
  ariaLabel,
  openOnFocus = true,
}: {
  value: string;
  onText: (text: string) => void;
  onSelect: (opt: ComboOption) => void;
  options: ComboOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  emptyText?: string;
  footer?: ReactNode;
  onEnterWithoutOption?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
  name?: string;
  ariaLabel?: string;
  openOnFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [typed, setTyped] = useState(false);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  // Ao abrir sem digitar, mostra tudo; depois de digitar, filtra.
  const list = useMemo(() => {
    const q = norm(value.trim());
    const base = !typed || !q ? options : options.filter((o) => norm(o.search ?? `${o.label} ${o.sub ?? ""}`).includes(q));
    return base.slice(0, 60);
  }, [options, value, typed]);

  useEffect(() => setHi(0), [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(o: ComboOption) {
    onSelect(o);
    setOpen(false);
    setTyped(false);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && list[hi] && typed) choose(list[hi]);
      else {
        setOpen(false);
        onEnterWithoutOption?.();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={box} className="relative min-w-0">
      <input
        ref={inputRef}
        name={name}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onFocus={() => openOnFocus && setOpen(true)}
        onChange={(e) => {
          onText(e.target.value);
          setTyped(true);
          setOpen(true);
        }}
        onKeyDown={onKey}
        className={className}
      />
      {open && !disabled && (list.length > 0 || typed) ? (
        <div
          id={listId}
          role="listbox"
          className="scroll-thin absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-72 min-w-[16rem] animate-pop-in overflow-y-auto rounded-lg bg-white p-1 shadow-menu"
        >
          {list.length === 0 ? (
            <p className="px-3 py-2.5 text-[13px] text-muted">{emptyText}</p>
          ) : (
            list.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={i === hi}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left ${i === hi ? "bg-hover" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{o.label}</span>
                  {o.sub ? <span className="block truncate text-xs text-muted">{o.sub}</span> : null}
                </span>
                {o.right ? <span className="shrink-0 text-xs tabular-nums text-muted">{o.right}</span> : null}
              </button>
            ))
          )}
          {footer ? <div className="mt-1 border-t border-line pt-1">{footer}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
