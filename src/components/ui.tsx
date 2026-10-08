import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

/* ---------- Campos e botões ---------- */

export const inputCls =
  "h-12 w-full rounded-2xl border border-line-strong bg-white px-4 text-base text-ink shadow-field transition placeholder:text-faint hover:border-faint focus:border-pen focus:ring-4 focus:ring-pen/15 sm:h-11 sm:text-sm";

export const primaryBtn =
  "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-sm font-medium text-white shadow-btn transition hover:bg-ink-2 active:scale-[0.98] sm:h-11";

export const ghostBtn =
  "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-white px-5 text-sm font-medium text-ink shadow-float transition hover:bg-hover active:scale-[0.98] sm:h-11";

/* ---------- Tabelas (computador) e cartões (celular) ---------- */

export const th = "px-5 py-3 text-left text-[13px] font-medium text-muted";
export const td = "px-5 py-3.5 text-sm align-middle";

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="hidden overflow-hidden rounded-[1.75rem] border border-line bg-white md:block">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

export function CardList({ children }: { children: ReactNode }) {
  return (
    <ul className="grid gap-2.5 md:hidden [&>li]:rounded-3xl [&>li]:border [&>li]:border-line [&>li]:bg-white">
      {children}
    </ul>
  );
}

/* ---------- Estrutura de página ---------- */

export function PageHeader({
  title,
  hint,
  action,
  filters,
  back,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  filters?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6">
      {back ? (
        <Link
          href={back.href}
          className="mb-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white pl-2.5 pr-4 text-sm text-ink-2 shadow-float transition hover:bg-hover hover:text-ink"
        >
          <Icon name="arrow-left" size={15} />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">{title}</h1>
          {hint ? <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{hint}</p> : null}
        </div>
        {filters ? (
          <div className="order-3 flex w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:order-none lg:w-auto lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {filters}
          </div>
        ) : null}
        {action ? (
          <div className="order-2 w-full shrink-0 sm:ml-auto sm:w-auto lg:order-none [&>*]:w-full sm:[&>*]:w-auto">
            {action}
          </div>
        ) : null}
      </div>
    </header>
  );
}

// Filtro em pílula com contador colorido (preto quando ativo).
type CountTone = "green" | "yellow" | "orange" | "blue" | "neutral";
const countTones: Record<CountTone, string> = {
  green: "bg-tint-green text-ok",
  yellow: "bg-tint-yellow text-warn",
  orange: "bg-tint-orange text-[#b4470f]",
  blue: "bg-tint-blue text-pen-ink",
  neutral: "bg-hover text-ink-2",
};

export function FilterPill({
  href,
  active,
  count,
  tone = "neutral",
  children,
}: {
  href: string;
  active?: boolean;
  count?: number;
  tone?: CountTone;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border pl-4 text-sm transition ${
        count == null ? "pr-4" : "pr-1.5"
      } ${
        active
          ? "border-ink bg-ink font-medium text-white"
          : "border-line bg-white text-ink-2 hover:bg-hover"
      }`}
    >
      {children}
      {count != null ? (
        <span
          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums ${countTones[tone]}`}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs leading-snug text-muted">{hint}</span> : null}
    </label>
  );
}

/* ---------- Formulário dentro do painel lateral ---------- */

export function SheetForm({
  action,
  closeHref,
  submitLabel,
  extraSubmit,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  closeHref: string;
  submitLabel: string;
  extraSubmit?: { name: string; value: string; label: string };
  children: ReactNode;
}) {
  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-1 content-start gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
        {children}
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-line px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {extraSubmit ? (
          <button name={extraSubmit.name} value={extraSubmit.value} className={`${ghostBtn} col-span-2`}>
            {extraSubmit.label}
          </button>
        ) : null}
        <Link href={closeHref} replace scroll={false} className={ghostBtn}>
          Cancelar
        </Link>
        <button className={primaryBtn}>{submitLabel}</button>
      </div>
    </form>
  );
}

/* ---------- Mensagens ---------- */

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-2xl bg-alert-soft px-4 py-3 text-sm text-alert sm:col-span-2"
    >
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function OkNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="mb-4 flex items-start gap-2 rounded-2xl bg-ok-soft px-4 py-3 text-sm text-ok"
    >
      <Icon name="check" size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function Notice({
  children,
  href,
  cta,
}: {
  children: ReactNode;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-subtle px-5 py-3.5 text-sm text-ink-2">
      <span>{children}</span>
      {href && cta ? (
        <Link href={href} className="inline-flex items-center gap-1 font-medium text-pen hover:text-pen-dark">
          {cta}
          <Icon name="chevron-right" size={14} />
        </Link>
      ) : null}
    </div>
  );
}

/* ---------- Pequenos elementos ---------- */

type Tone = "neutral" | "ok" | "warn" | "pen" | "alert" | "solid" | "ink";
const tones: Record<Tone, string> = {
  neutral: "border-line bg-white text-muted",
  ok: "border-transparent bg-ok-soft text-ok",
  warn: "border-transparent bg-warn-soft text-warn",
  pen: "border-transparent bg-pen-soft text-pen-ink",
  alert: "border-transparent bg-alert-soft text-alert",
  solid: "border-transparent bg-pen text-white",
  ink: "border-transparent bg-ink text-white",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// Iniciais num bloco arredondado (estilo ícone de aplicativo), com cor estável pelo nome.
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center font-semibold shadow-float"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        borderRadius: size * 0.3,
        background: `hsl(${hash} 80% 96%)`,
        color: `hsl(${hash} 50% 32%)`,
        border: `1px solid hsl(${hash} 45% 90%)`,
      }}
    >
      {initials}
    </span>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center bg-pen text-white shadow-btn"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <Icon name="bolt" size={size * 0.52} strokeWidth={2.2} />
    </span>
  );
}

// Interruptor liga/desliga (só o desenho; o clique vem do botão em volta).
export function Switch({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
        on ? "bg-ok" : "bg-line-strong"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
          on ? "left-[1.375rem]" : "left-0.5"
        }`}
      />
    </span>
  );
}

// Anel de progresso.
export function Ring({
  value,
  max,
  size = 132,
  stroke = 12,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-pen)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[1.75rem] border border-dashed border-line-strong bg-subtle px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white text-pen shadow-float">
        <Icon name={icon} size={22} />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      {children ? <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{children}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function NewButton({ label, href = "?novo=1" }: { label: string; href?: string }) {
  return (
    <Link href={href} scroll={false} className={primaryBtn}>
      <Icon name="plus" size={16} strokeWidth={2} />
      <span>{label}</span>
    </Link>
  );
}
