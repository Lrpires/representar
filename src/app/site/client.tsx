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
  { href: "#telas", label: "Telas" },
  { href: "#faturamento", label: "Faturamento" },
  { href: "#recursos", label: "Recursos" },
  { href: "#precos", label: "Preços" },
  { href: "#duvidas", label: "Dúvidas" },
];

// Cabeçalho fixo: transparente sobre o topo escuro e branco depois que a página rola.
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const light = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        light ? "border-b border-line bg-white/85 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Representar, início">
          <Logo size={28} />
          <span className={`text-[15px] font-semibold tracking-tight ${light ? "text-ink" : "text-white"}`}>Representar</span>
        </Link>
        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                light ? "text-ink-2 hover:bg-hover hover:text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            href="/login"
            className={`hidden h-9 items-center rounded-lg px-3 text-[13px] font-medium transition-colors sm:inline-flex ${
              light ? "text-ink-2 hover:bg-hover" : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            Entrar
          </Link>
          <Link
            href="/login?modo=criar"
            className={`inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-semibold transition ${
              light ? "bg-pen text-white shadow-btn hover:bg-pen-dark" : "bg-white text-[#0a2b34] hover:bg-white/90"
            }`}
          >
            Teste grátis
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Menu"
            className={`flex h-9 w-9 items-center justify-center rounded-lg md:hidden ${light ? "text-ink hover:bg-hover" : "text-white hover:bg-white/10"}`}
          >
            <Icon name={open ? "x" : "menu"} size={20} />
          </button>
        </div>
      </div>
      {open ? (
        <nav className="grid gap-0.5 border-t border-line bg-white px-4 pb-4 pt-2 md:hidden">
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
                on ? "border-pen bg-pen text-white shadow-btn" : "border-line bg-white text-ink-2 hover:border-line-strong hover:text-ink"
              }`}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
              {on && auto ? (
                <span
                  key={`${active}-${paused}`}
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-[2px] bg-white/60"
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
            <h3 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[1.75rem]">{tab.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{tab.text}</p>
          </div>
          <ul className="grid content-center gap-3">
            {tab.points.map((p) => (
              <li key={p} className="flex gap-3 text-[14px] leading-snug text-ink-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pen-soft text-pen">
                  <Icon name="check" size={12} />
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
        <div role="radiogroup" aria-label="Forma de pagamento" className="inline-flex rounded-full border border-line bg-white p-1 shadow-soft">
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
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                annual === o.v ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {o.l}
              {o.v ? (
                <span className={`rounded-full px-1.5 py-px text-[11px] font-semibold ${annual ? "bg-white/15 text-white" : "bg-ok-soft text-ok"}`}>
                  −{savePct}%
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3 lg:items-stretch">
        {PLANS.map((p) => {
          const hi = p.highlight;
          const value = price(p);
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl p-6 sm:p-7 ${
                hi
                  ? "bg-[#0a2b34] text-white shadow-[0_30px_60px_-20px_rgba(10,43,52,0.55)] ring-1 ring-white/10 lg:-my-3 lg:py-10"
                  : "border border-line bg-white"
              }`}
            >
              {hi ? (
                <>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#2fa07a] opacity-25 blur-3xl" />
                    <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-[#1d7b93] opacity-30 blur-3xl" />
                  </div>
                  <span className="absolute right-5 top-5 rounded-full bg-[#9fe3c4] px-2.5 py-1 text-[11px] font-semibold text-[#0a2b34] lg:top-7">
                    Mais escolhido
                  </span>
                </>
              ) : null}
              <div className="relative flex flex-1 flex-col">
                <h3 className={`text-lg font-semibold ${hi ? "text-white" : "text-ink"}`}>{p.name}</h3>
                <p className={`mt-1.5 min-h-[2.75rem] text-[13px] leading-relaxed ${hi ? "text-white/65" : "text-muted"}`}>{p.tagline}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className={`text-sm font-medium ${hi ? "text-white/70" : "text-muted"}`}>R$</span>
                  <span className="text-[2.75rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">{money(value)}</span>
                  <span className={`ml-1 text-sm ${hi ? "text-white/60" : "text-muted"}`}>/mês</span>
                </div>
                <p className={`mt-2 h-5 text-[12px] ${hi ? "text-white/55" : "text-faint"}`}>
                  {annual ? `R$ ${money(p.annual * 12)} por ano · ${p.users}` : p.users}
                </p>
                <Link
                  href={`/login?modo=criar&plano=${p.id}`}
                  className={`mt-6 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition ${
                    hi ? "bg-white text-[#0a2b34] hover:bg-white/90" : "bg-pen text-white shadow-btn hover:bg-pen-dark"
                  }`}
                >
                  {p.cta}
                </Link>
                <p className={`mt-2.5 text-center text-[12px] ${hi ? "text-white/50" : "text-faint"}`}>{TRIAL_DAYS} dias grátis, sem cartão</p>
                <ul className={`mt-7 grid gap-3 border-t pt-6 ${hi ? "border-white/10" : "border-line"}`}>
                  {p.features.map((f) => (
                    <li key={f} className={`flex gap-2.5 text-[13.5px] leading-snug ${hi ? "text-white/85" : "text-ink-2"}`}>
                      <Icon name="check" size={16} className={`mt-px shrink-0 ${hi ? "text-[#9fe3c4]" : "text-ok"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
