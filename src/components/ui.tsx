import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

/* ---------- Campos e botões ----------
   No celular tudo tem pelo menos 44px de altura (dedo); no computador fica
   mais compacto. Texto de campo em 16px no celular evita o zoom do iPhone. */

export const inputCls =
  "h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-base text-ink shadow-field outline-none transition-[border-color,box-shadow] placeholder:text-faint hover:border-[#c5cdd1] focus:border-pen focus:ring-[3px] focus:ring-pen/15 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-2 disabled:shadow-none sm:h-9 sm:text-sm";

export const textareaCls = `${inputCls} h-auto py-2 leading-relaxed sm:h-auto`;

const btnBase =
  "inline-flex h-11 shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-[background-color,color,box-shadow,transform] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 sm:h-8 sm:px-3 sm:text-[13px]";

export const primaryBtn = `${btnBase} bg-pen text-white shadow-btn hover:bg-pen-dark`;

export const ghostBtn = `${btnBase} border border-line-strong bg-white text-ink shadow-field hover:bg-hover`;

export const quietBtn = `${btnBase} text-ink-2 hover:bg-hover hover:text-ink`;

export const dangerBtn = `${btnBase} text-alert hover:bg-alert-soft`;

export const iconBtn =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-hover hover:text-ink sm:h-8 sm:w-8";

/* ---------- Tabelas (computador) e listas (celular) ---------- */

export const th = "h-9 px-4 text-left text-xs font-medium text-muted first:pl-5 last:pr-5";
export const td = "h-[3.25rem] px-4 text-sm align-middle first:pl-5 last:pr-5";
export const tr = "group relative transition-colors hover:bg-subtle";

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-line bg-white md:block">
      <table className="w-full border-collapse [&_thead]:border-b [&_thead]:border-line [&_thead]:bg-subtle [&_tbody>tr+tr]:border-t [&_tbody>tr+tr]:border-line">
        {children}
      </table>
    </div>
  );
}

// Link que cobre a linha inteira da tabela (a linha toda fica clicável).
export function RowLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-pen ${className}`}>
      {children}
    </Link>
  );
}

export function CardList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white md:hidden">
      {children}
    </ul>
  );
}

// Linha de lista no celular, com seta à direita quando é link.
export function ListRow({ href, children }: { href?: string; children: ReactNode }) {
  if (!href) return <li className="flex items-center gap-3 px-4 py-3">{children}</li>;
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-hover">
        {children}
        <Icon name="chevron-right" size={16} className="shrink-0 text-faint" />
      </Link>
    </li>
  );
}

/* ---------- Estrutura de página ---------- */

export function PageHeader({
  title,
  hint,
  action,
  filters,
  back,
  meta,
  leading,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  filters?: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <header className="mb-6 sm:mb-8">
      {back ? (
        <nav aria-label="Caminho" className="mb-3 flex min-w-0 items-center gap-1 text-[13px] text-muted">
          <Link
            href={back.href}
            className="-ml-1.5 inline-flex h-8 items-center gap-1 rounded-md px-1.5 transition hover:bg-hover hover:text-ink"
          >
            <Icon name="chevron-left" size={15} className="lg:hidden" />
            {back.label}
          </Link>
          <Icon name="chevron-right" size={13} className="hidden shrink-0 text-faint lg:block" />
          <span className="hidden truncate text-ink-2 lg:block">{title}</span>
        </nav>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          {leading}
          <div className="min-w-0">
            <h1 className="text-[1.375rem] font-semibold leading-tight tracking-[-0.015em] text-ink sm:text-2xl">
              {title}
            </h1>
            {hint ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{hint}</p> : null}
          </div>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {meta ? <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">{meta}</div> : null}
      {filters ? <div className="mt-5">{filters}</div> : null}
    </header>
  );
}

// Pequeno dado com ícone, usado na linha "meta" do cabeçalho.
export function Meta({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name={icon} size={14} className="text-faint" />
      {children}
    </span>
  );
}

/* ---------- Filtros em abas ---------- */

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

type CountTone = "green" | "yellow" | "orange" | "blue" | "neutral";

export function FilterPill({
  href,
  active,
  count,
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
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition sm:h-8 sm:px-2.5 ${
        active
          ? "bg-white text-ink shadow-panel"
          : "text-muted hover:bg-hover hover:text-ink-2"
      }`}
    >
      {children}
      {count != null ? (
        <span className={`tabular-nums ${active ? "text-muted" : "text-faint"}`}>{count}</span>
      ) : null}
    </Link>
  );
}

// Moldura cinza clara em volta das abas de filtro (estilo "segmented control").
export function Segmented({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex gap-0.5 rounded-[0.6rem] bg-hover p-0.5">{children}</div>
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">{children}</div>;
}

export function Count({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <span className="ml-auto hidden text-[13px] tabular-nums text-muted sm:block">
      {n} {n === 1 ? one : many}
    </span>
  );
}

/* ---------- Formulários ---------- */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className ?? ""}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs leading-snug text-muted">{hint}</span> : null}
    </label>
  );
}

export function Checkbox({
  name,
  defaultChecked,
  children,
  hint,
}: {
  name: string;
  defaultChecked?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg py-1 text-sm text-ink">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-line-strong sm:h-4 sm:w-4"
      />
      <span>
        {children}
        {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

// Seção de formulário no estilo "página de configurações": título e explicação
// à esquerda, campos num cartão à direita. No celular, um embaixo do outro.
export function FormSection({
  title,
  hint,
  children,
  id,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="grid scroll-mt-20 gap-3 border-t border-line pt-6 first:border-t-0 first:pt-0 sm:gap-4 xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] xl:gap-10 xl:pt-8"
    >
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {hint ? <p className="mt-1 text-[13px] leading-relaxed text-muted">{hint}</p> : null}
      </div>
      <div className="min-w-0 rounded-xl border border-line bg-white p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Card({
  title,
  hint,
  action,
  children,
  flush,
  className = "",
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-xl border border-line bg-white ${className}`}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {hint ? <p className="mt-0.5 text-[13px] leading-snug text-muted">{hint}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

// Lista de propriedades no estilo da barra lateral do Linear.
export function Properties({ children }: { children: ReactNode }) {
  return <dl className="grid gap-y-1 text-[13px]">{children}</dl>;
}

export function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-8 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-ink">{children || <span className="text-faint">—</span>}</dd>
    </div>
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
      <div className="scroll-thin grid flex-1 content-start gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">
        {children}
      </div>
      <footer className="flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:pb-3">
        {extraSubmit ? (
          <button name={extraSubmit.name} value={extraSubmit.value} className={`${quietBtn} sm:mr-auto`}>
            {extraSubmit.label}
          </button>
        ) : (
          <span className="hidden text-xs text-faint sm:mr-auto sm:block">Esc para fechar</span>
        )}
        <Link href={closeHref} replace scroll={false} className={ghostBtn}>
          Cancelar
        </Link>
        <button className={primaryBtn}>{submitLabel}</button>
      </footer>
    </form>
  );
}

/* ---------- Mensagens ---------- */

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-alert/15 bg-alert-soft px-3 py-2.5 text-[13px] leading-snug text-alert sm:col-span-2"
    >
      <Icon name="alert" size={15} className="mt-px shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function OkNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="flex animate-pop-in items-start gap-2 rounded-lg border border-ok/15 bg-ok-soft px-3 py-2.5 text-[13px] leading-snug text-ok"
    >
      <Icon name="check" size={15} strokeWidth={2} className="mt-px shrink-0" />
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
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-subtle px-4 py-3 text-[13px] text-ink-2">
      <Icon name="info" size={16} className="shrink-0 text-muted" />
      <span className="flex-1">{children}</span>
      {href && cta ? (
        <Link href={href} className="inline-flex items-center gap-1 font-medium text-pen hover:text-pen-dark">
          {cta}
          <Icon name="arrow-right" size={14} />
        </Link>
      ) : null}
    </div>
  );
}

/* ---------- Pequenos elementos ---------- */

type Tone = "neutral" | "ok" | "warn" | "pen" | "alert" | "info" | "solid" | "ink";
const tones: Record<Tone, string> = {
  neutral: "bg-[#eef1f2] text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  pen: "bg-pen-soft text-pen-ink",
  alert: "bg-alert-soft text-alert",
  info: "bg-info-soft text-info",
  solid: "bg-pen text-white",
  ink: "bg-ink text-white",
};
const dots: Record<Tone, string> = {
  neutral: "bg-faint",
  ok: "bg-ok",
  warn: "bg-[#e09f3e]",
  pen: "bg-pen",
  alert: "bg-alert",
  info: "bg-info",
  solid: "bg-white",
  ink: "bg-white",
};

export function Badge({
  children,
  tone = "neutral",
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex h-[1.375rem] items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium ${tones[tone]}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dots[tone]}`} /> : null}
      {children}
    </span>
  );
}

function hueOf(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

// Iniciais com cor estável pelo nome. Empresas: quadrado; pessoas: círculo.
export function Avatar({
  name,
  size = 32,
  round,
  src,
}: {
  name: string;
  size?: number;
  round?: boolean;
  src?: string | null;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="shrink-0 object-cover ring-1 ring-black/5"
        style={{ width: size, height: size, borderRadius: round ? 9999 : Math.round(size * 0.26) }}
      />
    );
  }
  const hue = hueOf(name);
  const initials = name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 select-none items-center justify-center font-semibold tracking-tight"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        borderRadius: round ? 9999 : Math.round(size * 0.26),
        background: `hsl(${hue} 55% 94%)`,
        color: `hsl(${hue} 40% 34%)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 40% 88%)`,
      }}
    >
      {initials || "?"}
    </span>
  );
}

// Monograma "R" em quadrado azul-petróleo; a perna do R termina numa seta que sobe.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center bg-pen bg-linear-to-b from-white/15 to-transparent text-white shadow-btn"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.68)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 19V5h5.25a3.75 3.75 0 0 1 0 7.5H7" />
        <path d="m11 12.5 3 4 5.75-6.75" />
        <path d="M16 9.5h3.75v3.75" />
      </svg>
    </span>
  );
}

// Interruptor liga/desliga (só o desenho; o clique vem do botão em volta).
export function Switch({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? "bg-pen" : "bg-line-strong"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
          on ? "left-[1.125rem]" : "left-0.5"
        }`}
      />
    </span>
  );
}

// Barra de progresso fina.
export function Progress({ value, max }: { value: number; max: number }) {
  const share = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-active">
      <span className="block h-full rounded-full bg-pen transition-all" style={{ width: `${share * 100}%` }} />
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-active)" strokeWidth={stroke} />
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
  compact,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-xl border border-dashed border-line-strong px-6 text-center ${
        compact ? "py-10" : "py-16 sm:py-20"
      }`}
    >
      <div className="relative mb-5 h-12 w-12">
        <span className="absolute inset-0 -translate-x-3 translate-y-1 -rotate-12 rounded-xl border border-line bg-subtle" />
        <span className="absolute inset-0 translate-x-3 translate-y-1 rotate-12 rounded-xl border border-line bg-subtle" />
        <span className="absolute inset-0 flex items-center justify-center rounded-xl border border-line bg-white text-ink-2 shadow-panel">
          <Icon name={icon} size={20} />
        </span>
      </div>
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {children ? <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{children}</p> : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

// Botão "Novo …". Com fab, no celular vira um botão flutuante acima da barra de abas.
export function NewButton({
  label,
  href = "?novo=1",
  fab,
}: {
  label: string;
  href?: string;
  fab?: boolean;
}) {
  if (!fab) {
    return (
      <Link href={href} scroll={false} className={primaryBtn}>
        <Icon name="plus" size={15} strokeWidth={2} />
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <>
      <Link href={href} scroll={false} className={`${primaryBtn} hidden sm:inline-flex`}>
        <Icon name="plus" size={15} strokeWidth={2} />
        <span>{label}</span>
      </Link>
      <Link
        href={href}
        scroll={false}
        aria-label={label}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-14 items-center gap-2 rounded-2xl bg-pen pl-4 pr-5 text-[15px] font-medium text-white shadow-[0_8px_24px_-6px_rgb(15_76_92/0.45),0_2px_4px_rgb(20_33_42/0.12)] transition active:scale-95 sm:hidden"
      >
        <Icon name="plus" size={20} strokeWidth={2} />
        {label}
      </Link>
    </>
  );
}

/* ---------- Abas ---------- */

export function Tabs({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <nav className="flex gap-5">{children}</nav>
    </div>
  );
}

export function Tab({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active?: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`relative -mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 text-sm font-medium transition-colors sm:h-10 ${
        active ? "border-pen text-ink" : "border-transparent text-muted hover:text-ink-2"
      }`}
    >
      {children}
      {count != null ? (
        <span
          className={`rounded-md px-1.5 text-xs tabular-nums ${active ? "bg-pen-soft text-pen-ink" : "bg-hover text-muted"}`}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

// Título de um grupo de campos dentro de um formulário de 2 colunas.
export function FormGroup({ title }: { title: string }) {
  return (
    <p className="-mb-1 border-t border-line pt-4 text-xs font-medium uppercase tracking-wide text-faint sm:col-span-2">
      {title}
    </p>
  );
}

// Barra de ações presa no rodapé da tela (acima das abas no celular).
// Fica dentro do <form> para o botão Salvar enviar o formulário.
export function SaveBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <>
      <div aria-hidden="true" className="h-16" />
      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-white/95 shadow-[0_-4px_16px_-8px_rgb(20_33_42/0.12)] backdrop-blur-xl lg:bottom-2 lg:left-60 lg:right-2 lg:rounded-b-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 py-2.5 sm:px-6 lg:px-10">
          {note ? <div className="mr-auto min-w-0 text-[13px] text-muted">{note}</div> : null}
          {children}
        </div>
      </div>
    </>
  );
}
