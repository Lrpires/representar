import { todayISO } from "./format";

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// "2026-10" -> início, fim, nome e meses vizinhos. Valor inválido usa o mês atual.
export function monthInfo(raw?: string) {
  const ym = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : todayISO().slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  return {
    ym,
    start: `${ym}-01`,
    end: `${ym}-${String(last).padStart(2, "0")}`,
    label: `${MONTHS[m - 1].charAt(0).toUpperCase()}${MONTHS[m - 1].slice(1)} de ${y}`,
    prev: shift(-1),
    next: shift(1),
    isCurrent: ym === todayISO().slice(0, 7),
  };
}
