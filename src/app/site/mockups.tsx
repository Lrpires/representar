// Telas desenhadas do sistema para o site (dados fictícios). São só ilustração: nada aqui é clicável.
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

/* ---------------------------------------------------------------- peças */

type Tone = "ok" | "warn" | "alert" | "info" | "pen" | "neutral";
const toneCls: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  alert: "bg-alert-soft text-alert",
  info: "bg-info-soft text-info",
  pen: "bg-pen-soft text-pen",
  neutral: "bg-active text-ink-2",
};
const dotCls: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-[#d99a2b]",
  alert: "bg-alert",
  info: "bg-info",
  pen: "bg-pen",
  neutral: "bg-faint",
};

export function Chip({ tone = "neutral", dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ${toneCls[tone]}`}>
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dotCls[tone]}`} /> : null}
      {children}
    </span>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11px] text-muted">{children}</span>;
}

function Initials({ name, color }: { name: string; color: string }) {
  const ini = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white" style={{ background: color }}>
      {ini}
    </span>
  );
}

// Moldura de janela do navegador.
export function Window({ children, title = "Representar", className = "" }: { children: ReactNode; title?: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(20,33,42,0.08),0_30px_80px_-20px_rgba(10,43,52,0.35)] ${className}`}>
      <div className="flex h-9 items-center gap-2 border-b border-line bg-[#f6f8f9] px-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="mx-auto flex h-6 w-72 items-center justify-center gap-1.5 rounded-md bg-white text-[11px] text-muted shadow-[0_0_0_1px_rgba(20,33,42,0.06)]">
          <Icon name="shield" size={11} />
          {title}
        </span>
        <span className="w-12" />
      </div>
      {children}
    </div>
  );
}

const NAV: { id: string; label: string; icon: IconName; group?: string }[] = [
  { id: "painel", label: "Painel", icon: "home" },
  { id: "pedidos", label: "Pedidos", icon: "receipt" },
  { id: "faturamento", label: "Faturamento", icon: "file" },
  { id: "metas", label: "Metas", icon: "target" },
  { id: "clientes", label: "Clientes", icon: "users", group: "Carteira" },
  { id: "leads", label: "Leads", icon: "kanban" },
  { id: "comissoes", label: "Comissões", icon: "percent", group: "Financeiro" },
  { id: "contas", label: "Contas a pagar", icon: "wallet" },
  { id: "representadas", label: "Representadas", icon: "factory", group: "Catálogo" },
  { id: "produtos", label: "Produtos", icon: "box" },
];

// O "esqueleto" do sistema: barra lateral + área de conteúdo.
export function AppShell({ active, title, meta, actions, children }: { active: string; title: string; meta?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-[640px] bg-canvas text-ink">
      <aside className="flex w-[200px] shrink-0 flex-col px-2.5 py-3">
        <div className="mb-4 flex items-center gap-2 px-2">
          <Logo size={22} />
          <span className="text-[13px] font-semibold">Aurora Representações</span>
        </div>
        <div className="mb-3 flex h-7 items-center gap-2 rounded-md border border-line bg-white px-2 text-[12px] text-faint">
          <Icon name="search" size={13} />
          Buscar
          <span className="ml-auto rounded border border-line px-1 text-[10px]">⌘K</span>
        </div>
        <nav className="grid gap-px">
          {NAV.map((n) => (
            <div key={n.id}>
              {n.group ? <p className="mb-1 mt-3 px-2 text-[10.5px] font-medium text-faint">{n.group}</p> : null}
              <div
                className={`flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px] ${
                  n.id === active ? "bg-white font-medium text-ink shadow-[0_0_0_1px_rgba(20,33,42,0.06),0_1px_2px_rgba(20,33,42,0.05)]" : "text-ink-2"
                }`}
              >
                <Icon name={n.icon} size={14} className={n.id === active ? "text-pen" : "text-muted"} />
                {n.label}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 rounded-md px-2 py-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c98a5a] text-[10px] font-semibold text-white">MC</span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-medium">Marina Costa</span>
            <span className="block text-[10.5px] text-muted">Dona</span>
          </span>
        </div>
      </aside>
      <main className="my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_rgba(20,33,42,0.05),0_1px_3px_rgba(20,33,42,0.04)]">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-6">
          <h4 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h4>
          {meta ? <span className="text-[12px] text-muted">{meta}</span> : null}
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}

function Btn({ children, primary, icon }: { children: ReactNode; primary?: boolean; icon?: IconName }) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium ${
        primary ? "bg-pen text-white shadow-btn" : "border border-line-strong bg-white text-ink-2"
      }`}
    >
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

function Kpi({ label, value, delta, tone = "ok", sub }: { label: string; value: string; delta?: string; tone?: Tone; sub?: string }) {
  return (
    <div className="rounded-lg border border-line px-4 py-3">
      <p className="text-[11.5px] text-muted">{label}</p>
      <p className="mt-1 text-[19px] font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
        {delta ? <span className={`font-medium ${tone === "ok" ? "text-ok" : tone === "alert" ? "text-alert" : "text-warn"}`}>{delta}</span> : null}
        {sub}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- gráfico */

const CUR = [0, 9, 21, 30, 38, 52, 64, 71, 85, 102, 118, 126, 139, 158, 171, 186, 204, 219, 231, 252, 268, 281, 299, 318, 336];
const PREV = [0, 7, 15, 26, 31, 40, 47, 59, 66, 74, 88, 97, 105, 116, 128, 137, 149, 161, 170, 182, 196, 207, 216, 229, 241, 252, 266, 274, 285, 296];

function path(vals: number[], w: number, h: number, max: number, days: number) {
  return vals.map((v, i) => `${i ? "L" : "M"}${((i / (days - 1)) * w).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
}

export function SalesChart({ w = 560, h = 170 }: { w?: number; h?: number }) {
  const max = 400;
  const days = 30;
  const cur = path(CUR, w, h, max, days);
  const lastX = ((CUR.length - 1) / (days - 1)) * w;
  const lastY = h - (CUR[CUR.length - 1] / max) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="w-full" aria-hidden="true">
      <defs>
        <linearGradient id="lp-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-pen)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--color-pen)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="0" x2={w} y1={(h / 4) * i + 0.5} y2={(h / 4) * i + 0.5} stroke="#eef1f2" />
      ))}
      <line x1="0" x2={w} y1={h} y2={h} stroke="#d7dde0" />
      <path d={path(PREV, w, h, max, days)} fill="none" stroke="#b6c2c8" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
      <path d={`${cur} L${lastX},${h} L0,${h} Z`} fill="url(#lp-area)" />
      <path d={cur} fill="none" stroke="var(--color-pen)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
      <line x1={lastX} x2={lastX} y1={lastY} y2={h} stroke="var(--color-pen)" strokeOpacity="0.25" strokeDasharray="2 3" />
      <circle cx={lastX} cy={lastY} r="4.5" fill="white" stroke="var(--color-pen)" strokeWidth="2.25" />
      {["1", "8", "15", "22", "29"].map((d) => (
        <text key={d} x={((Number(d) - 1) / (days - 1)) * w} y={h + 14} fontSize="10" fill="#9eaab1" textAnchor={d === "1" ? "start" : d === "29" ? "end" : "middle"}>
          {d}/out
        </text>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------- Painel */

const rankCustomers = [
  { n: "Malharia Vale Verde", v: "R$ 68.420", s: 1 },
  { n: "Boutique Lumi", v: "R$ 51.180", s: 0.75 },
  { n: "Confecções Serra Azul", v: "R$ 44.960", s: 0.66 },
  { n: "Ateliê Dona Flor", v: "R$ 31.300", s: 0.46 },
];

export function PainelScreen() {
  return (
    <AppShell
      active="painel"
      title="Painel"
      meta="Outubro de 2026"
      actions={
        <>
          <Btn icon="calendar">Este mês</Btn>
          <Btn icon="users">Todos os vendedores</Btn>
          <Btn primary icon="plus">
            Novo pedido
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 p-5">
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="Vendido no mês" value="R$ 482.390" delta="▲ 18%" sub="vs. setembro" />
          <Kpi label="Pedidos" value="64" delta="▲ 9" sub="vs. setembro" />
          <Kpi label="Faturado" value="R$ 356.870" sub="74% do vendido" />
          <Kpi label="Comissão prevista" value="R$ 24.119" sub="5,0% em média" />
        </div>
        <div className="grid grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] gap-4">
          <div className="rounded-lg border border-line p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[13px] font-semibold">Vendas acumuladas</p>
              <span className="flex items-center gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 rounded bg-pen" />
                  Outubro
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 rounded bg-[#b6c2c8]" />
                  Setembro
                </span>
              </span>
            </div>
            <SalesChart />
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-[#f2d2cf] bg-alert-soft/60 p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-alert">
                <Icon name="alert" size={14} />3 pedidos em atraso
              </p>
              <div className="mt-2 grid gap-1.5 text-[12px]">
                <p className="flex justify-between">
                  <span className="text-ink-2">#1038 · Boutique Lumi</span>
                  <Chip tone="alert">19 dias</Chip>
                </p>
                <p className="flex justify-between">
                  <span className="text-ink-2">#1041 · Ateliê Dona Flor</span>
                  <Chip tone="warn">9 dias</Chip>
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-line p-3.5">
              <div className="flex items-baseline justify-between">
                <p className="text-[12.5px] font-semibold">Meta do mês</p>
                <p className="text-[12px] tabular-nums text-muted">
                  <span className="font-semibold text-ink">78%</span> de R$ 620 mil
                </p>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-active">
                <div className="h-full w-[78%] rounded-full bg-pen" />
              </div>
              <p className="mt-2 text-[11px] text-muted">Faltam R$ 137.610 em 13 dias úteis · R$ 10.585 por dia</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-line p-3">
            <p className="mb-2 px-1 text-[12.5px] font-semibold">Clientes</p>
            {rankCustomers.map((r, i) => (
              <div key={r.n} className="px-1 py-1">
                <p className="flex gap-2 text-[11.5px]">
                  <span className="w-3 text-faint">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{r.n}</span>
                  <span className="tabular-nums">{r.v}</span>
                </p>
                <div className="ml-5 mt-1 h-1 rounded-full bg-active">
                  <div className="h-full rounded-full bg-pen" style={{ width: `${r.s * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-line p-3">
            <p className="mb-2 px-1 text-[12.5px] font-semibold">Representadas</p>
            {[
              { n: "Tecelagem Aurora", v: "R$ 198.400", s: 1 },
              { n: "Fios do Sul", v: "R$ 142.050", s: 0.72 },
              { n: "Jeans Atlântico", v: "R$ 88.730", s: 0.45 },
              { n: "Linhas Bela Vista", v: "R$ 53.210", s: 0.27 },
            ].map((r, i) => (
              <div key={r.n} className="px-1 py-1">
                <p className="flex gap-2 text-[11.5px]">
                  <span className="w-3 text-faint">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{r.n}</span>
                  <span className="tabular-nums">{r.v}</span>
                </p>
                <div className="ml-5 mt-1 h-1 rounded-full bg-active">
                  <div className="h-full rounded-full bg-pen" style={{ width: `${r.s * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-line p-3">
            <p className="mb-2 px-1 text-[12.5px] font-semibold">Funil de pedidos</p>
            {[
              { l: "Enviado", n: 18, s: 1, c: "bg-info" },
              { l: "Faturado parcial", n: 7, s: 0.39, c: "bg-[#d99a2b]" },
              { l: "Faturado", n: 31, s: 1.72, c: "bg-ok" },
              { l: "Entregue", n: 8, s: 0.44, c: "bg-pen" },
            ].map((f) => (
              <div key={f.l} className="flex items-center gap-2 px-1 py-[5px] text-[11.5px]">
                <span className="w-24 text-ink-2">{f.l}</span>
                <span className="h-2 flex-1 rounded-full bg-active">
                  <span className={`block h-full rounded-full ${f.c}`} style={{ width: `${Math.min(f.s / 1.72, 1) * 100}%` }} />
                </span>
                <span className="w-5 text-right tabular-nums text-muted">{f.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------------------------------------------------------- Pedidos */

const ORDERS: { n: string; c: string; p: string; d: string; v: string; s: [string, Tone]; age?: [string, Tone] }[] = [
  { n: "1047", c: "Malharia Vale Verde", p: "Tecelagem Aurora", d: "13/10", v: "R$ 18.420,00", s: ["Enviado", "info"] },
  { n: "1046", c: "Boutique Lumi", p: "Fios do Sul", d: "12/10", v: "R$ 7.385,50", s: ["Faturado", "ok"] },
  { n: "1045", c: "Confecções Serra Azul", p: "Jeans Atlântico", d: "10/10", v: "R$ 22.910,00", s: ["Faturado parcial", "pen"], age: ["4 dias", "neutral"] },
  { n: "1044", c: "Ateliê Dona Flor", p: "Tecelagem Aurora", d: "09/10", v: "R$ 4.120,80", s: ["Rascunho", "neutral"] },
  { n: "1041", c: "Ateliê Dona Flor", p: "Linhas Bela Vista", d: "05/10", v: "R$ 9.640,00", s: ["Enviado", "info"], age: ["9 dias", "warn"] },
  { n: "1040", c: "Moda Praia Maré", p: "Fios do Sul", d: "03/10", v: "R$ 12.004,00", s: ["Entregue", "ok"] },
  { n: "1038", c: "Boutique Lumi", p: "Tecelagem Aurora", d: "25/09", v: "R$ 15.870,00", s: ["Enviado", "info"], age: ["19 dias", "alert"] },
  { n: "1036", c: "Loja Girassol", p: "Jeans Atlântico", d: "22/09", v: "R$ 6.215,40", s: ["Faturado", "ok"] },
];

export function PedidosScreen() {
  return (
    <AppShell
      active="pedidos"
      title="Pedidos"
      meta="64 neste mês"
      actions={
        <>
          <Btn icon="download">Exportar</Btn>
          <Btn primary icon="plus">
            Novo pedido
          </Btn>
        </>
      }
    >
      <div className="p-5">
        <div className="mb-4 grid grid-cols-4 gap-3">
          <Kpi label="Vendido" value="R$ 482.390" delta="▲ 18%" sub="vs. setembro" />
          <Kpi label="Aguardando faturamento" value="25" sub="R$ 163.240" />
          <Kpi label="Em atraso" value="3" delta="2 críticos" tone="alert" />
          <Kpi label="Ticket médio" value="R$ 7.537" sub="por pedido" />
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-56 items-center gap-2 rounded-md border border-line px-2 text-[12px] text-faint">
            <Icon name="search" size={13} />
            Cliente, número ou representada
          </span>
          {["Todos", "Enviados", "Parciais", "Em atraso"].map((f, i) => (
            <span
              key={f}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium ${i === 0 ? "border-ink bg-ink text-white" : "border-line text-ink-2"}`}
            >
              {f}
              {f === "Em atraso" ? <span className="ml-1 rounded bg-alert px-1 text-[10px] text-white">3</span> : null}
            </span>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-subtle text-[11px] text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Nº</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Representada</th>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ORDERS.map((o) => (
                <tr key={o.n}>
                  <td className="px-3 py-2.5">
                    <Mono>#{o.n}</Mono>
                  </td>
                  <td className="px-3 py-2.5 font-medium">{o.c}</td>
                  <td className="px-3 py-2.5 text-ink-2">{o.p}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{o.d}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <Chip tone={o.s[1]} dot>
                        {o.s[0]}
                      </Chip>
                      {o.age ? (
                        <Chip tone={o.age[1]}>
                          <Icon name="clock" size={11} />
                          {o.age[0]}
                        </Chip>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{o.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------------------------------------------------------- Faturamento */

export function FaturamentoScreen() {
  return (
    <AppShell
      active="faturamento"
      title="Faturamento"
      meta="Outubro de 2026"
      actions={
        <>
          <Btn icon="plus">Lançar à mão</Btn>
          <Btn primary icon="upload">
            Importar XML
          </Btn>
        </>
      }
    >
      <div className="relative h-full">
        <div className="p-5 opacity-60">
          <div className="mb-4 grid grid-cols-4 gap-3">
            <Kpi label="Faturado" value="R$ 356.870" sub="41 notas" />
            <Kpi label="A faturar" value="R$ 163.240" sub="25 pedidos" />
            <Kpi label="Em atenção" value="1" tone="warn" delta="mais de 7 dias" />
            <Kpi label="Críticos" value="2" tone="alert" delta="mais de 15 dias" />
          </div>
          <div className="overflow-hidden rounded-lg border border-line">
            {["45871", "45870", "12204", "8812", "8810", "3391"].map((n, i) => (
              <div key={n} className="flex items-center gap-4 border-b border-line px-3 py-2.5 text-[12px] last:border-0">
                <Mono>NF {n}</Mono>
                <span className="flex-1 font-medium">{rankCustomers[i % 4].n}</span>
                <span className="text-muted">#{1046 - i}</span>
                <span className="w-24 text-right tabular-nums">R$ {(7385 + i * 2311).toLocaleString("pt-BR")},00</span>
              </div>
            ))}
          </div>
        </div>
        {/* Gaveta do XML */}
        <div className="absolute inset-y-0 right-0 flex w-[420px] flex-col border-l border-line bg-white shadow-[-24px_0_48px_-24px_rgba(20,33,42,0.25)]">
          <div className="flex h-12 items-center justify-between border-b border-line px-5">
            <p className="text-[13.5px] font-semibold">Lançar nota pelo XML</p>
            <Icon name="x" size={15} className="text-muted" />
          </div>
          <div className="grid gap-3 p-5">
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-pen/50 bg-pen-soft/50 px-3 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-pen text-white">
                <Icon name="file" size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">35261012345678000190550010000458711.xml</span>
                <span className="block text-[11px] text-muted">Lido com sucesso</span>
              </span>
              <Icon name="check" size={16} className="text-ok" />
            </div>
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="flex items-baseline justify-between text-[13px] font-semibold">
                NF 45871 <span className="tabular-nums">R$ 22.910,00</span>
              </p>
              <p className="mt-1 text-[11px] text-muted">Emitida em 13/10/2026 · 3 itens</p>
              <p className="mt-1.5 text-[11px] text-ink-2">
                <span className="text-muted">De:</span> Jeans Atlântico <span className="text-faint">→</span> <span className="text-muted">Para:</span> Confecções Serra Azul
              </p>
            </div>
            <p className="text-[12px] font-medium text-ink-2">Vincular ao pedido</p>
            <div className="flex items-center gap-2.5 rounded-lg border border-pen bg-pen-soft/60 px-3 py-2.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border-[5px] border-pen bg-white" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium">
                  <Mono>#1045</Mono> Confecções Serra Azul
                </span>
                <span className="block text-[11px] text-muted">Jeans Atlântico · 3 itens casaram</span>
              </span>
              <Chip tone="ok">Sugerido</Chip>
            </div>
            <div className="overflow-hidden rounded-lg border border-line">
              {[
                ["JA-210", "Calça skinny azul", "120", "120"],
                ["JA-304", "Jaqueta jeans clássica", "40", "40"],
                ["JA-118", "Bermuda reta", "80", "60"],
              ].map(([c, d, q, f]) => (
                <div key={c} className="flex items-center gap-2 border-b border-line px-3 py-2 text-[11.5px] last:border-0">
                  <Mono>{c}</Mono>
                  <span className="flex-1 truncate">{d}</span>
                  <span className="text-muted">de {q}</span>
                  <span className="w-12 rounded border border-line-strong px-1.5 py-0.5 text-right tabular-nums">{f}</span>
                </div>
              ))}
            </div>
            <p className="rounded-md bg-pen-soft px-3 py-2 text-[11.5px] text-pen">Faltam 20 bermudas: o pedido fica como Faturado parcial.</p>
          </div>
          <div className="mt-auto flex justify-end gap-2 border-t border-line px-5 py-3">
            <Btn>Cancelar</Btn>
            <Btn primary>Lançar nota</Btn>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------------------------------------------------------- Comissões */

export function ComissoesScreen() {
  const rows: { nf: string; p: string; c: string; due: string; v: string; s: [string, Tone]; input?: string }[] = [
    { nf: "45871", p: "Jeans Atlântico", c: "Confecções Serra Azul", due: "10/11", v: "R$ 1.145,50", s: ["A receber", "info"], input: "1.145,50" },
    { nf: "12204", p: "Fios do Sul", c: "Boutique Lumi", due: "05/11", v: "R$ 369,28", s: ["A receber", "info"], input: "369,28" },
    { nf: "8812", p: "Tecelagem Aurora", c: "Malharia Vale Verde", due: "30/09", v: "R$ 921,00", s: ["Atrasada", "alert"], input: "921,00" },
    { nf: "8790", p: "Tecelagem Aurora", c: "Loja Girassol", due: "25/09", v: "R$ 1.380,40", s: ["Recebida", "ok"] },
    { nf: "3391", p: "Linhas Bela Vista", c: "Ateliê Dona Flor", due: "20/09", v: "R$ 482,00", s: ["Recebida", "ok"] },
  ];
  return (
    <AppShell active="comissoes" title="Comissões" meta="Outubro de 2026" actions={<Btn icon="factory">Todas as representadas</Btn>}>
      <div className="p-5">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Kpi label="A receber" value="R$ 24.119" sub="38 notas" />
          <Kpi label="Atrasadas" value="R$ 2.104" delta="3 notas" tone="alert" />
          <Kpi label="Recebidas no mês" value="R$ 17.582" delta="▲ 12%" sub="vs. setembro" />
        </div>
        <div className="mb-4 grid grid-cols-4 gap-3">
          {[
            ["Tecelagem Aurora", "R$ 9.920", 0.82],
            ["Fios do Sul", "R$ 7.102", 0.58],
            ["Jeans Atlântico", "R$ 4.436", 0.36],
            ["Linhas Bela Vista", "R$ 2.661", 0.22],
          ].map(([n, v, s]) => (
            <div key={n as string} className="rounded-lg border border-line px-3 py-2.5">
              <p className="truncate text-[11.5px] text-muted">{n}</p>
              <p className="mt-0.5 text-[14px] font-semibold tabular-nums">{v}</p>
              <div className="mt-2 h-1 rounded-full bg-active">
                <div className="h-full rounded-full bg-ok" style={{ width: `${(s as number) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-line">
          {rows.map((r) => (
            <div key={r.nf} className="flex items-center gap-3 border-b border-line px-3 py-2.5 text-[12px] last:border-0">
              <Mono>NF {r.nf}</Mono>
              <span className="w-32 truncate font-medium">{r.p}</span>
              <span className="flex-1 truncate text-ink-2">{r.c}</span>
              <span className="tabular-nums text-muted">vence {r.due}</span>
              <Chip tone={r.s[1]} dot>
                {r.s[0]}
              </Chip>
              {r.input ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-[86px] rounded-md border border-line-strong px-2 py-1 text-right tabular-nums">{r.input}</span>
                  <span className="inline-flex h-[26px] items-center gap-1 rounded-md bg-ok px-2 text-[11px] font-medium text-white">
                    <Icon name="check" size={12} />
                    Receber
                  </span>
                </span>
              ) : (
                <span className="w-[160px] text-right font-medium tabular-nums text-ok">{r.v}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------------------------------------------------------- Mapa */

const PINS: { x: number; y: number; t: Tone; n?: string }[] = [
  { x: 22, y: 30, t: "pen" },
  { x: 31, y: 41, t: "pen", n: "Malharia Vale Verde" },
  { x: 38, y: 28, t: "warn" },
  { x: 45, y: 52, t: "pen" },
  { x: 52, y: 37, t: "pen" },
  { x: 58, y: 61, t: "alert" },
  { x: 63, y: 44, t: "pen" },
  { x: 69, y: 30, t: "warn" },
  { x: 74, y: 55, t: "pen" },
  { x: 80, y: 40, t: "pen" },
  { x: 47, y: 72, t: "pen" },
  { x: 27, y: 62, t: "warn" },
  { x: 35, y: 78, t: "pen" },
  { x: 86, y: 66, t: "pen" },
];

function MapCanvas() {
  return (
    <div className="relative h-full overflow-hidden bg-[#eef2ef]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 70 C 20 62, 30 80, 55 74 S 85 60, 100 68 L100 100 L0 100 Z" fill="#dce9ee" />
        <path d="M62 0 C 60 20, 72 26, 70 45 S 80 70, 78 100" fill="none" stroke="#cfe0e6" strokeWidth="2.4" />
        {[12, 26, 40, 54, 68, 82].map((x) => (
          <line key={`v${x}`} x1={x} x2={x + 6} y1="0" y2="100" stroke="#ffffff" strokeWidth="0.9" />
        ))}
        {[14, 30, 46, 62, 78].map((y) => (
          <line key={`h${y}`} x1="0" x2="100" y1={y} y2={y - 4} stroke="#ffffff" strokeWidth="0.9" />
        ))}
        <path d="M0 20 L 100 48" stroke="#f6e7c4" strokeWidth="1.6" />
        <path d="M18 100 L 46 0" stroke="#f6e7c4" strokeWidth="1.4" />
        <rect x="40" y="16" width="9" height="7" rx="1" fill="#d9ebd8" />
        <rect x="70" y="72" width="11" height="8" rx="1" fill="#d9ebd8" />
      </svg>
      {PINS.map((p, i) => (
        <span key={i} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          {p.n ? (
            <span className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-3 py-2 text-[11px] shadow-[0_8px_24px_-6px_rgba(20,33,42,0.25),0_0_0_1px_rgba(20,33,42,0.06)]">
              <span className="block text-[12px] font-semibold text-ink">{p.n}</span>
              <span className="block text-muted">Último pedido há 12 dias · R$ 68.420 no ano</span>
            </span>
          ) : null}
          <svg width={p.n ? 30 : 22} height={p.n ? 38 : 28} viewBox="0 0 22 28">
            <path
              d="M11 27s9-8.4 9-15.5A9 9 0 0 0 2 11.5C2 18.6 11 27 11 27z"
              fill={p.t === "alert" ? "var(--color-alert)" : p.t === "warn" ? "#d99a2b" : "var(--color-pen)"}
              stroke="white"
              strokeWidth="1.6"
            />
            <circle cx="11" cy="11.5" r="3.4" fill="white" />
          </svg>
        </span>
      ))}
    </div>
  );
}

export function MapaScreen() {
  return (
    <AppShell
      active="clientes"
      title="Clientes"
      meta="148 na carteira"
      actions={
        <>
          <span className="inline-flex rounded-md border border-line-strong p-0.5 text-[11.5px]">
            <span className="rounded px-2 py-0.5 text-muted">Lista</span>
            <span className="rounded bg-ink px-2 py-0.5 font-medium text-white">Mapa</span>
          </span>
          <Btn primary icon="plus">
            Novo cliente
          </Btn>
        </>
      }
    >
      <div className="grid h-full grid-cols-[260px_minmax(0,1fr)]">
        <div className="border-r border-line p-3">
          <p className="mb-2 px-1 text-[11px] font-medium text-muted">Próximos da rota</p>
          {[
            ["Malharia Vale Verde", "Blumenau · SC", "pen"],
            ["Loja Girassol", "Gaspar · SC", "warn"],
            ["Boutique Lumi", "Itajaí · SC", "alert"],
            ["Moda Praia Maré", "Balneário Camboriú · SC", "pen"],
            ["Confecções Serra Azul", "Brusque · SC", "pen"],
            ["Ateliê Dona Flor", "Pomerode · SC", "warn"],
          ].map(([n, c, t]) => (
            <div key={n} className={`flex items-center gap-2.5 rounded-md px-2 py-2 ${n === "Malharia Vale Verde" ? "bg-pen-soft/60" : ""}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls[t as Tone]}`} />
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-medium">{n}</span>
                <span className="block text-[11px] text-muted">{c}</span>
              </span>
            </div>
          ))}
          <div className="mt-3 grid gap-1.5 border-t border-line px-1 pt-3 text-[11px] text-muted">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-pen" />
              Comprou nos últimos 60 dias
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#d99a2b]" />
              Sem comprar há 60 dias
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-alert" />
              Sem comprar há 120 dias
            </span>
          </div>
        </div>
        <MapCanvas />
      </div>
    </AppShell>
  );
}

/* ---------------------------------------------------------------- Metas */

export function MetasScreen() {
  const sellers = [
    { n: "Marina Costa", c: "#c98a5a", goal: "R$ 220 mil", pct: 91 },
    { n: "Rafael Lima", c: "#5a86c9", goal: "R$ 180 mil", pct: 84 },
    { n: "Júlia Prado", c: "#7a5ac9", goal: "R$ 140 mil", pct: 67 },
    { n: "Diego Souza", c: "#3f9a7a", goal: "R$ 80 mil", pct: 49 },
  ];
  return (
    <AppShell active="metas" title="Metas" meta="Outubro de 2026" actions={<Btn primary icon="plus">Nova meta</Btn>}>
      <div className="grid gap-4 p-5">
        <div className="flex items-center gap-6 rounded-lg border border-line p-5">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e7ecee" strokeWidth="3.2" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-pen)" strokeWidth="3.2" strokeLinecap="round" strokeDasharray={`${0.78 * 97.4} 97.4`} />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[22px] font-semibold tabular-nums">78%</span>
              <span className="text-[10px] text-muted">da meta</span>
            </span>
          </div>
          <div className="flex-1">
            <p className="text-[12px] text-muted">Meta do escritório</p>
            <p className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums">R$ 482.390 de R$ 620.000</p>
            <p className="mt-1 text-[12px] text-muted">Soma das metas dos vendedores · faltam 13 dias úteis</p>
            <div className="mt-3 flex gap-2">
              <Chip tone="ok" dot>
                No ritmo: R$ 10.585 por dia
              </Chip>
              <Chip tone="neutral">Por vendedor</Chip>
              <Chip tone="neutral">Por representada</Chip>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-line p-4">
            <p className="mb-3 text-[12.5px] font-semibold">Por vendedor</p>
            <div className="grid gap-3.5">
              {sellers.map((s) => (
                <div key={s.n}>
                  <div className="flex items-center gap-2 text-[12px]">
                    <Initials name={s.n} color={s.c} />
                    <span className="flex-1 font-medium">{s.n}</span>
                    <span className="text-muted">{s.goal}</span>
                    <span className="w-9 text-right font-semibold tabular-nums">{s.pct}%</span>
                  </div>
                  <div className="ml-8 mt-1.5 h-1.5 rounded-full bg-active">
                    <div className={`h-full rounded-full ${s.pct >= 80 ? "bg-ok" : s.pct >= 60 ? "bg-pen" : "bg-[#d99a2b]"}`} style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-line p-4">
            <p className="mb-3 text-[12.5px] font-semibold">Por representada</p>
            <div className="grid gap-3.5">
              {[
                ["Tecelagem Aurora", "R$ 240 mil", 83],
                ["Fios do Sul", "R$ 180 mil", 79],
                ["Jeans Atlântico", "R$ 120 mil", 74],
                ["Linhas Bela Vista", "R$ 80 mil", 66],
              ].map(([n, g, p]) => (
                <div key={n as string}>
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pen-soft text-pen">
                      <Icon name="factory" size={13} />
                    </span>
                    <span className="flex-1 font-medium">{n}</span>
                    <span className="text-muted">{g}</span>
                    <span className="w-9 text-right font-semibold tabular-nums">{p}%</span>
                  </div>
                  <div className="ml-8 mt-1.5 h-1.5 rounded-full bg-active">
                    <div className="h-full rounded-full bg-pen" style={{ width: `${p}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------------------------------------------------------- Celular */

export function Phone({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative w-[290px] rounded-[44px] bg-[#0b1a20] p-[10px] shadow-[0_40px_80px_-24px_rgba(10,43,52,0.55),inset_0_0_0_1.5px_rgba(255,255,255,0.08)] ${className}`}>
      <div className="relative h-[590px] overflow-hidden rounded-[34px] bg-white">
        <div className="absolute left-1/2 top-2.5 z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-[#0b1a20]" />
        {children}
      </div>
    </div>
  );
}

export function PhoneOrder() {
  return (
    <div className="flex h-full flex-col bg-canvas text-ink">
      <div className="flex items-center justify-between px-6 pb-2 pt-3.5 text-[11px] font-semibold">
        <span>9:41</span>
        <span className="flex gap-1">
          <span className="h-2 w-3.5 rounded-sm bg-ink" />
        </span>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3 pt-3">
        <Icon name="chevron-left" size={18} className="text-muted" />
        <p className="flex-1 text-[15px] font-semibold">Novo pedido</p>
        <Chip tone="neutral">Rascunho</Chip>
      </div>
      <div className="grid gap-2.5 px-3">
        <div className="rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgba(20,33,42,0.05)]">
          <p className="text-[10.5px] text-muted">Cliente</p>
          <p className="text-[13px] font-semibold">Malharia Vale Verde</p>
          <p className="mt-2 text-[10.5px] text-muted">Representada</p>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold">
            Tecelagem Aurora <Chip tone="pen">última compra</Chip>
          </p>
        </div>
        <div className="rounded-xl bg-white shadow-[0_0_0_1px_rgba(20,33,42,0.05)]">
          {[
            ["TA-11", "Malha penteada 30.1", "48 kg", "R$ 1.584,00"],
            ["TA-27", "Moletom flanelado", "30 kg", "R$ 1.230,00"],
            ["TA-40", "Ribana canelada", "12 kg", "R$ 384,00"],
          ].map(([c, d, q, v]) => (
            <div key={c} className="flex items-center gap-2 border-b border-line px-3 py-2.5 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium">{d}</span>
                <span className="block text-[10.5px] text-muted">
                  {c} · {q}
                </span>
              </span>
              <span className="text-[12px] font-medium tabular-nums">{v}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium text-pen">
            <Icon name="plus" size={14} />
            Adicionar item
          </div>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgba(20,33,42,0.05)]">
          <p className="flex justify-between text-[11.5px] text-muted">
            <span>Prazo</span>
            <span className="text-ink">30/60/90 dias</span>
          </p>
          <p className="mt-1.5 flex justify-between text-[11.5px] text-muted">
            <span>Desconto</span>
            <span className="text-ink">3%</span>
          </p>
          <p className="mt-2 flex justify-between border-t border-line pt-2 text-[14px] font-semibold">
            <span>Total</span>
            <span className="tabular-nums">R$ 3.102,94</span>
          </p>
        </div>
      </div>
      <div className="mt-auto grid grid-cols-[auto_1fr] gap-2 border-t border-line bg-white px-3 pb-6 pt-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7f6ec] text-[#1f9d55]">
          <Icon name="whatsapp" size={18} />
        </span>
        <span className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-pen text-[13px] font-semibold text-white">
          <Icon name="send" size={15} />
          Enviar pedido
        </span>
      </div>
    </div>
  );
}
