"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/ui";
import { Icon } from "@/components/icons";
import { PLANS, TRIAL_DAYS, type Plan } from "./plans";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Mostra uma "tela" desenhada em tamanho de computador, encolhida para caber na largura disponível.
// No celular ela não encolhe além de "minScale": fica legível e dá para arrastar para o lado.
export function ScaleFrame({
  width,
  children,
  className = "",
  minScale = 0.5,
  startX = 190,
}: {
  width: number;
  children: ReactNode;
  className?: string;
  minScale?: number;
  startX?: number; // no celular, começa mostrando a partir daqui (pula a barra lateral)
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ scale: number; height: number; swipe: boolean } | null>(null);

  useIso(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    let first = true;
    const fit = () => {
      const fitScale = Math.min(1, o.clientWidth / width);
      const scale = Math.max(fitScale, Math.min(minScale, 1));
      const swipe = scale > fitScale + 0.001;
      setBox({ scale, height: i.offsetHeight * scale, swipe });
      if (swipe && first) o.scrollLeft = startX * scale;
      first = false;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width, minScale, startX]);

  const scale = box?.scale ?? 1;
  return (
    <div className={`relative ${className}`}>
      <div
        ref={outer}
        className={`relative w-full ${box?.swipe ? "snap-x overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "overflow-hidden"}`}
        style={{ height: box?.height }}
      >
        <div style={{ width: width * scale, height: box?.height }}>
          <div ref={inner} style={{ width, transform: `scale(${scale})`, transformOrigin: "top left", visibility: box ? "visible" : "hidden" }}>
            {children}
          </div>
        </div>
      </div>
      {box?.swipe ? (
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11.5px] text-faint">
          <Icon name="arrow-left" size={12} />
          Arraste para ver a tela inteira
          <Icon name="arrow-right" size={12} />
        </p>
      ) : null}
    </div>
  );
}

// Faz os blocos surgirem com suavidade quando entram na tela.
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92) return; // já visível ao abrir: não esconde
    setState("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} ${state === "hidden" ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"} transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]`}
      style={{ transitionDelay: state === "shown" ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}

const links = [
  { href: "#telas", label: "Produto" },
  { href: "#faturamento", label: "Faturamento" },
  { href: "#recursos", label: "Recursos" },
  { href: "#precos", label: "Preços" },
  { href: "#duvidas", label: "Dúvidas" },
];

type Theme = "dia" | "noite";
const THEME_KEY = "representar-tema";

// Tema do site: segue o celular/computador da pessoa, ou a escolha dela no botão.
function useSiteTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("dia");
  useEffect(() => {
    const current = document.documentElement.dataset.lp === "noite" ? "noite" : "dia";
    setTheme(current);
  }, []);
  const toggle = () => {
    const next: Theme = theme === "noite" ? "dia" : "noite";
    document.documentElement.dataset.lp = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    setTheme(next);
  };
  return [theme, toggle];
}

// Roda antes de desenhar a página, para não piscar no tema errado.
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"noite":"dia";document.documentElement.dataset.lp=t}catch(e){}`;

function ThemeButton({ theme, onClick }: { theme: Theme; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={theme === "noite" ? "Usar tema claro" : "Usar tema escuro"}
      title={theme === "noite" ? "Tema claro" : "Tema escuro"}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 transition hover:bg-hover hover:text-ink"
    >
      {theme === "noite" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}

// Cabeçalho fixo no papel da marca; ganha uma borda quando a página rola.
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [theme, toggle] = useSiteTheme();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
        scrolled || open ? "border-b border-line bg-paper/90 backdrop-blur-xl" : "border-b border-transparent bg-paper"
      }`}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-3 px-4 sm:gap-8 sm:px-8 lg:px-16">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Representar, início">
          <Logo size={30} tone={theme === "noite" ? "dark" : "light"} />
          <span className="text-[19px] font-bold tracking-[-0.05em] text-ink sm:text-[22px]">Representar</span>
        </Link>
        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-[15px] text-ink-2 transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <ThemeButton theme={theme} onClick={toggle} />
          <Link href="/login" className="hidden px-2 text-[15px] text-ink-2 transition-colors hover:text-ink sm:inline">
            Entrar
          </Link>
          <Link
            href="/login?modo=criar"
            className="inline-flex h-10 items-center whitespace-nowrap rounded-xl bg-accent px-3.5 text-[14px] font-semibold text-on-accent transition hover:bg-accent-dark sm:h-11 sm:px-5 sm:text-[15px]"
          >
            Teste grátis
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-hover lg:hidden"
          >
            <Icon name={open ? "x" : "menu"} size={20} />
          </button>
        </div>
      </div>
      {open ? (
        <nav className="grid gap-0.5 border-t border-line bg-paper px-4 pb-4 pt-2 lg:hidden">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-[15px] font-medium text-ink hover:bg-hover">
              {l.label}
            </a>
          ))}
          <Link href="/login" className="rounded-lg px-3 py-3 text-[15px] font-medium text-ink hover:bg-hover">
            Entrar
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

export type ShowcaseTab = { id: string; label: string; icon: Parameters<typeof Icon>[0]["name"]; title: string; text: string; points: string[]; screen: ReactNode };

// Tour pelas telas: abas que trocam sozinhas (e param quando a pessoa interage).
export function Showcase({ tabs }: { tabs: ShowcaseTab[] }) {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const DURATION = 7000;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAuto(false);
  }, []);

  useEffect(() => {
    if (!auto || paused) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % tabs.length), DURATION);
    return () => clearTimeout(t);
  }, [active, auto, paused, tabs.length]);

  const tab = tabs[active];

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div role="tablist" aria-label="Telas do sistema" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
        {tabs.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => {
                setActive(i);
                setAuto(false);
              }}
              className={`relative flex shrink-0 items-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${
                on ? "border-ink bg-ink text-paper" : "border-line bg-transparent text-ink-2 hover:border-line-strong hover:text-ink"
              }`}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
              {on && auto ? (
                <span
                  key={`${active}-${paused}`}
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-[2px] bg-accent"
                  style={{ animation: `lp-progress ${DURATION}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-8 lg:mt-12">
        <div key={tab.id} className="grid min-w-0 animate-[lp-fade-up_500ms_cubic-bezier(0.22,1,0.36,1)] gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h3 className="text-[1.75rem] font-bold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[2.25rem]">{tab.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{tab.text}</p>
          </div>
          <ul className="grid content-center gap-3">
            {tab.points.map((p) => (
              <li key={p} className="flex gap-3 text-[14px] leading-snug text-ink-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                  <Icon name="check" size={12} strokeWidth={2.2} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div key={`s-${tab.id}`} className="mt-8 min-w-0 animate-[lp-screen-in_600ms_cubic-bezier(0.22,1,0.36,1)] lg:mt-10">
          {tab.screen}
        </div>
      </div>
    </div>
  );
}

const money = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Tabela de preços com a troca mensal / anual.
export function Pricing() {
  const [annual, setAnnual] = useState(true);
  const price = (p: Plan) => (annual ? p.annual : p.monthly);
  const best = PLANS.find((p) => p.highlight) ?? PLANS[0];
  const savePct = Math.round((1 - best.annual / best.monthly) * 100);

  return (
    <>
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Forma de pagamento" className="inline-flex rounded-xl border border-line bg-white p-1">
          {[
            { v: false, l: "Mensal" },
            { v: true, l: "Anual" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              role="radio"
              aria-checked={annual === o.v}
              onClick={() => setAnnual(o.v)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-medium transition-colors ${
                annual === o.v ? "bg-ink text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {o.l}
              {o.v ? <span className="rounded bg-accent px-1.5 py-px font-mono text-[11px] font-semibold text-on-accent">−{savePct}%</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-3 lg:items-stretch">
        {PLANS.map((p, i) => {
          const hi = p.highlight;
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-md p-7 sm:p-8 ${hi ? "bg-side text-[#f3f0e8]" : "border border-line bg-white text-ink"}`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-mono text-[12px] uppercase tracking-[0.08em] ${hi ? "text-[#a8a49b]" : "text-muted"}`}>
                  0{i + 1} — {p.name}
                </p>
                {hi ? <span className="rounded bg-accent px-2 py-0.5 text-[11.5px] font-semibold text-on-accent">Mais escolhido</span> : null}
              </div>
              <div className={`my-4 h-px bg-[repeating-linear-gradient(90deg,currentColor_0_6px,transparent_6px_12px)] opacity-30`} />
              <p className={`min-h-[2.75rem] text-[14px] leading-relaxed ${hi ? "text-[#c9c5bb]" : "text-ink-2"}`}>{p.tagline}</p>
              <div className="mt-6 flex items-baseline gap-1.5">
                <span className={`font-mono text-sm ${hi ? "text-[#a8a49b]" : "text-muted"}`}>R$</span>
                <span className="font-mono text-[3.25rem] font-medium leading-none tracking-[-0.05em] tabular-nums">{money(price(p))}</span>
                <span className={`text-sm ${hi ? "text-[#a8a49b]" : "text-muted"}`}>/mês</span>
              </div>
              <p className={`mt-2 h-5 font-mono text-[12px] ${hi ? "text-[#a8a49b]" : "text-muted"}`}>
                {annual ? `R$ ${money(p.annual * 12)} por ano · ${p.users}` : p.users}
              </p>
              <Link
                href={`/login?modo=criar&plano=${p.id}`}
                className={`mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition ${
                  hi ? "bg-accent text-on-accent hover:bg-accent-dark" : "border border-line-strong text-ink hover:bg-hover"
                }`}
              >
                {p.cta}
              </Link>
              <p className={`mt-2.5 text-center font-mono text-[11.5px] ${hi ? "text-[#8a867d]" : "text-faint"}`}>{TRIAL_DAYS} dias grátis · sem cartão</p>
              <ul className={`mt-7 grid gap-3 border-t pt-6 ${hi ? "border-[#f3f0e8]/10" : "border-line"}`}>
                {p.features.map((f) => (
                  <li key={f} className={`flex gap-2.5 text-[14px] leading-snug ${hi ? "text-[#e3ded2]" : "text-ink-2"}`}>
                    <Icon name="check" size={16} strokeWidth={2} className={`mt-px shrink-0 ${hi ? "text-accent" : "text-ink"}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
