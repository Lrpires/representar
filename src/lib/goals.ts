// Metas: indicadores, alvo e cálculo do realizado (igual no Painel e na tela de Metas).

export type Metric = "vendido" | "faturado" | "pedidos" | "clientes";

export const METRICS: { value: Metric; label: string; hint: string; money: boolean }[] = [
  { value: "vendido", label: "Valor vendido", hint: "Soma dos pedidos enviados e faturados", money: true },
  { value: "faturado", label: "Valor faturado", hint: "Soma das notas fiscais emitidas", money: true },
  { value: "pedidos", label: "Número de pedidos", hint: "Pedidos enviados e faturados", money: false },
  { value: "clientes", label: "Clientes atendidos", hint: "Clientes diferentes com pedido", money: false },
];

export const metricInfo = (m: string) => METRICS.find((x) => x.value === m) ?? METRICS[0];

export type GoalRow = {
  id: string;
  principal_id: string | null;
  seller_id: string | null;
  metric: Metric;
  period_start: string;
  period_end: string;
  target: number;
  notes: string | null;
};

export type SaleRow = { order_date: string; total: number; principal_id: string; seller_id: string; customer_id: string };
export type InvoiceRow = { issued_at: string; value: number; principal_id: string; seller_id: string };

// Quem é o alvo da meta.
export function goalScope(g: Pick<GoalRow, "principal_id" | "seller_id">) {
  if (g.principal_id && g.seller_id) return "vendedor_representada" as const;
  if (g.principal_id) return "representada" as const;
  if (g.seller_id) return "vendedor" as const;
  return "geral" as const;
}

const inGoal = (g: GoalRow, date: string, principal: string, seller: string) =>
  date >= g.period_start &&
  date <= g.period_end &&
  (!g.principal_id || g.principal_id === principal) &&
  (!g.seller_id || g.seller_id === seller);

// Dias úteis (seg–sex) entre duas datas, inclusive.
export function businessDays(from: string, to: string): number {
  if (to < from) return 0;
  let n = 0;
  const d = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (d <= end) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

export type Progress = {
  done: number;
  share: number; // 0..1+ do alvo
  expectedShare: number; // quanto do período já passou (0..1)
  status: "atingida" | "no_ritmo" | "abaixo" | "futura" | "encerrada";
  remaining: number;
  perDay: number | null; // quanto falta por dia útil restante
  projection: number | null; // no ritmo atual, onde termina
};

export function goalProgress(g: GoalRow, sales: SaleRow[], invoices: InvoiceRow[], today: string): Progress {
  let done = 0;
  if (g.metric === "faturado") {
    done = invoices.filter((i) => inGoal(g, i.issued_at, i.principal_id, i.seller_id)).reduce((s, i) => s + Number(i.value), 0);
  } else {
    const list = sales.filter((o) => inGoal(g, o.order_date, o.principal_id, o.seller_id));
    if (g.metric === "vendido") done = list.reduce((s, o) => s + Number(o.total), 0);
    if (g.metric === "pedidos") done = list.length;
    if (g.metric === "clientes") done = new Set(list.map((o) => o.customer_id)).size;
  }

  const target = Number(g.target);
  const share = target ? done / target : 0;
  const totalDays = businessDays(g.period_start, g.period_end) || 1;
  const elapsedEnd = today < g.period_end ? today : g.period_end;
  const elapsed = today < g.period_start ? 0 : businessDays(g.period_start, elapsedEnd);
  const expectedShare = Math.min(elapsed / totalDays, 1);
  const remaining = Math.max(target - done, 0);
  const daysLeft = today > g.period_end ? 0 : businessDays(today > g.period_start ? today : g.period_start, g.period_end);

  let status: Progress["status"];
  if (share >= 1) status = "atingida";
  else if (today < g.period_start) status = "futura";
  else if (today > g.period_end) status = "encerrada";
  else status = share >= expectedShare - 0.02 ? "no_ritmo" : "abaixo";

  return {
    done,
    share,
    expectedShare,
    status,
    remaining,
    perDay: daysLeft > 0 && remaining > 0 ? remaining / daysLeft : null,
    projection: elapsed > 0 && today <= g.period_end ? (done / elapsed) * totalDays : null,
  };
}

export const STATUS_INFO: Record<Progress["status"], { label: string; tone: "ok" | "info" | "warn" | "alert" | "neutral" }> = {
  atingida: { label: "Atingida", tone: "ok" },
  no_ritmo: { label: "No ritmo", tone: "info" },
  abaixo: { label: "Abaixo do ritmo", tone: "warn" },
  futura: { label: "Ainda não começou", tone: "neutral" },
  encerrada: { label: "Não atingida", tone: "alert" },
};

/* ---------- Plano de meta: total do escritório + distribuições ---------- */

export type Dimension = "vendedor" | "representada" | "vendedor_representada";

export const DIMENSIONS: { value: Dimension; label: string; action: string }[] = [
  { value: "vendedor", label: "Por vendedor", action: "Distribuir por vendedor" },
  { value: "representada", label: "Por representada", action: "Distribuir por representada" },
  { value: "vendedor_representada", label: "Por vendedor em cada representada", action: "Distribuir por vendedor e representada" },
];

// Metas do mesmo indicador e do mesmo período formam um plano.
export type Plan = {
  key: string;
  metric: Metric;
  start: string;
  end: string;
  office: GoalRow | null;
  parts: Record<Dimension, GoalRow[]>;
};

export const planKey = (g: Pick<GoalRow, "metric" | "period_start" | "period_end">) =>
  `${g.metric}.${g.period_start}.${g.period_end}`;

export function parsePlanKey(key: string | undefined) {
  const m = /^(vendido|faturado|pedidos|clientes)\.(\d{4}-\d{2}-\d{2})\.(\d{4}-\d{2}-\d{2})$/.exec(key ?? "");
  return m ? { metric: m[1] as Metric, start: m[2], end: m[3] } : null;
}

export function groupPlans(goals: GoalRow[]): Plan[] {
  const plans = new Map<string, Plan>();
  for (const g of goals) {
    const key = planKey(g);
    const plan =
      plans.get(key) ??
      { key, metric: g.metric, start: g.period_start, end: g.period_end, office: null, parts: { vendedor: [], representada: [], vendedor_representada: [] } };
    const scope = goalScope(g);
    if (scope === "geral") plan.office = g;
    else plan.parts[scope].push(g);
    plans.set(key, plan);
  }
  const rank = { vendido: 0, faturado: 1, pedidos: 2, clientes: 3 } as const;
  return [...plans.values()].sort((a, b) => a.start.localeCompare(b.start) || rank[a.metric] - rank[b.metric]);
}

export const sumTargets = (list: GoalRow[]) => Math.round(list.reduce((s, g) => s + Number(g.target), 0) * 100) / 100;

// Diferença que ainda conta como "fechado" (centavos de arredondamento).
export const closes = (a: number, b: number) => Math.abs(a - b) < 0.005;

// Realizado de qualquer recorte (para mostrar como referência ao distribuir).
export function realizedFor(
  metric: Metric,
  start: string,
  end: string,
  filter: { principal_id?: string | null; seller_id?: string | null },
  sales: SaleRow[],
  invoices: InvoiceRow[],
) {
  const g: GoalRow = {
    id: "", metric, period_start: start, period_end: end, target: 1, notes: null,
    principal_id: filter.principal_id ?? null, seller_id: filter.seller_id ?? null,
  };
  return goalProgress(g, sales, invoices, end).done;
}
