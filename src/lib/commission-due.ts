// Vencimento da comissão a partir da data do faturamento e da regra da representada.
export type DueRule = {
  commission_close_mode?: string | null;
  commission_close_day?: number | null;
  commission_days_after?: number | null;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function commissionDueDate(issuedAt: string, rule: DueRule): string {
  const d = new Date(`${issuedAt}T12:00:00Z`);
  switch (rule.commission_close_mode) {
    case "dias_apos_evento":
      d.setUTCDate(d.getUTCDate() + (rule.commission_days_after ?? 30));
      return iso(d);
    case "dia_fixo": {
      // Dia fixo do mês seguinte (ex.: dia 10). Meses curtos usam o último dia.
      const day = rule.commission_close_day ?? 10;
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12));
      const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0, 12)).getUTCDate();
      next.setUTCDate(Math.min(day, last));
      return iso(next);
    }
    case "semanal":
      d.setUTCDate(d.getUTCDate() + 7);
      return iso(d);
    case "quinzenal":
      d.setUTCDate(d.getUTCDate() + 15);
      return iso(d);
    default:
      d.setUTCDate(d.getUTCDate() + 30);
      return iso(d);
  }
}
