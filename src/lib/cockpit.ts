// Períodos e agrupamentos do Painel (cockpit). Funções puras: servidor e navegador.

export type PeriodKey = "hoje" | "7d" | "30d" | "mes" | "mes_passado" | "trimestre" | "ano" | "datas";

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "mes", label: "Este mês" },
  { value: "mes_passado", label: "Mês passado" },
  { value: "trimestre", label: "Trimestre" },
  { value: "ano", label: "Ano" },
  { value: "datas", label: "Datas" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const at = (s: string) => new Date(`${s}T12:00:00Z`);
export const addDays = (s: string, n: number) => {
  const d = at(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const daysBetween = (a: string, b: string) => Math.round((at(b).getTime() - at(a).getTime()) / 86400000);
const monthStart = (y: number, m: number) => iso(new Date(Date.UTC(y, m, 1, 12)));
const monthEnd = (y: number, m: number) => iso(new Date(Date.UTC(y, m + 1, 0, 12)));

export type Period = {
  key: PeriodKey;
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  compareLabel: string; // "vs mês anterior"
  label: string; // "1 a 13 de outubro"
};

// Mesmo número de dias no período anterior equivalente (ex.: 1–13/out vs 1–13/set).
export function resolvePeriod(key: string | undefined, de: string | undefined, ate: string | undefined, today: string): Period {
  const [y, m] = today.split("-").map(Number);
  const mi = m - 1;
  let start = today, end = today, prevStart = today, prevEnd = today, compareLabel = "";
  let k = (["hoje", "7d", "30d", "mes", "mes_passado", "trimestre", "ano", "datas"] as const).find((x) => x === key) ?? "mes";

  if (k === "datas" && !(de && ate && /^\d{4}-\d{2}-\d{2}$/.test(de) && /^\d{4}-\d{2}-\d{2}$/.test(ate) && de <= ate)) k = "mes";

  switch (k) {
    case "hoje":
      prevStart = prevEnd = addDays(today, -1);
      compareLabel = "vs ontem";
      break;
    case "7d":
    case "30d": {
      const n = k === "7d" ? 7 : 30;
      start = addDays(today, -(n - 1));
      prevEnd = addDays(start, -1);
      prevStart = addDays(prevEnd, -(n - 1));
      compareLabel = `vs ${n} dias anteriores`;
      break;
    }
    case "mes": {
      start = monthStart(y, mi);
      prevStart = monthStart(y, mi - 1);
      const pe = addDays(prevStart, daysBetween(start, today));
      prevEnd = pe > monthEnd(y, mi - 1) ? monthEnd(y, mi - 1) : pe;
      compareLabel = "vs mesmo período do mês anterior";
      break;
    }
    case "mes_passado":
      start = monthStart(y, mi - 1);
      end = monthEnd(y, mi - 1);
      prevStart = monthStart(y, mi - 2);
      prevEnd = monthEnd(y, mi - 2);
      compareLabel = "vs mês retrasado";
      break;
    case "trimestre": {
      const q = Math.floor(mi / 3) * 3;
      start = monthStart(y, q);
      prevStart = monthStart(y, q - 3);
      prevEnd = addDays(prevStart, daysBetween(start, today));
      compareLabel = "vs mesmo período do trimestre anterior";
      break;
    }
    case "ano":
      start = `${y}-01-01`;
      prevStart = `${y - 1}-01-01`;
      prevEnd = `${y - 1}-${today.slice(5)}`;
      compareLabel = "vs mesmo período do ano passado";
      break;
    case "datas": {
      start = de!;
      end = ate!;
      const n = daysBetween(start, end);
      prevEnd = addDays(start, -1);
      prevStart = addDays(prevEnd, -n);
      compareLabel = "vs período anterior";
      break;
    }
  }
  return { key: k, start, end, prevStart, prevEnd, compareLabel, label: rangeLabel(start, end) };
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function rangeLabel(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (start === end) return `${sd} de ${MONTHS[sm - 1]} de ${sy}`;
  if (sy === ey && sm === em) return `${sd} a ${ed} de ${MONTHS[sm - 1]}`;
  if (sy === ey) return `${sd} de ${MONTHS[sm - 1].slice(0, 3)} a ${ed} de ${MONTHS[em - 1].slice(0, 3)}`;
  return `${sd}/${String(sm).padStart(2, "0")}/${sy} a ${ed}/${String(em).padStart(2, "0")}/${ey}`;
}

/* ---------- Série do gráfico ---------- */

export type Point = { label: string; tip: string; current: number; previous: number };

// Agrupa por dia (até 31 dias), semana (até ~4 meses) ou mês, alinhando o período anterior pela posição.
export function buildSeries(
  p: Period,
  current: { date: string; value: number }[],
  previous: { date: string; value: number }[],
): { points: Point[]; unit: "dia" | "semana" | "mês" } {
  const len = daysBetween(p.start, p.end) + 1;
  const unit = len <= 31 ? "dia" : len <= 124 ? "semana" : "mês";
  const bucketOf = (start: string, date: string) => {
    if (unit === "dia") return daysBetween(start, date);
    if (unit === "semana") return Math.floor(daysBetween(start, date) / 7);
    const [sy, sm] = start.split("-").map(Number);
    const [dy, dm] = date.split("-").map(Number);
    return (dy - sy) * 12 + (dm - sm);
  };
  const n = bucketOf(p.start, p.end) + 1;
  const cur = new Array(n).fill(0);
  const prev = new Array(n).fill(0);
  for (const r of current) {
    const b = bucketOf(p.start, r.date);
    if (b >= 0 && b < n) cur[b] += r.value;
  }
  for (const r of previous) {
    const b = bucketOf(p.prevStart, r.date);
    if (b >= 0 && b < n) prev[b] += r.value;
  }
  const points = cur.map((v, i) => {
    let label: string, tip: string;
    if (unit === "dia") {
      const d = addDays(p.start, i);
      label = d.slice(8, 10);
      tip = `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    } else if (unit === "semana") {
      const d = addDays(p.start, i * 7);
      label = `${d.slice(8, 10)}/${d.slice(5, 7)}`;
      tip = `Semana de ${label}`;
    } else {
      const [sy, sm] = p.start.split("-").map(Number);
      const mm = (sm - 1 + i) % 12;
      const yy = sy + Math.floor((sm - 1 + i) / 12);
      label = MONTHS[mm].slice(0, 3);
      tip = `${MONTHS[mm]} de ${yy}`;
    }
    return { label, tip, current: Math.round(v * 100) / 100, previous: Math.round(prev[i] * 100) / 100 };
  });
  return { points, unit };
}

// Variação percentual com sinal; null quando não há base de comparação.
export function delta(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return (current - previous) / previous;
}

// Soma por chave e ordena do maior para o menor.
export function rank<T>(rows: T[], key: (r: T) => string | null | undefined, value: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + value(r));
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// O banco devolve no máximo 1.000 linhas por consulta: busca em páginas até acabar
// (sem isso, um período movimentado era cortado sem aviso).
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  max = 50000,
): Promise<{ data: T[]; error: unknown }> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { data: out, error: null };
}
