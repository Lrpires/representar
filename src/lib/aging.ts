// Atraso do pedido: dias desde o envio sem estar totalmente faturado.
// Amarelo (aviso) e vermelho (crítico) a partir dos prazos das Configurações.

export type AgingLevel = "ok" | "aviso" | "critico";
export type Aging = { days: number; level: AgingLevel } | null;

const DAY = 86400000;

export function orderAging(
  o: { status: string; sent_at?: string | null; order_date: string },
  warnDays: number,
  criticalDays: number,
  today: string,
): Aging {
  if (o.status !== "enviado" && o.status !== "parcial") return null;
  const since = (o.sent_at ? String(o.sent_at) : o.order_date).slice(0, 10);
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(since)) / DAY));
  const level: AgingLevel = days >= criticalDays ? "critico" : days >= warnDays ? "aviso" : "ok";
  return { days, level };
}

export const AGING_STYLE: Record<AgingLevel, { badge: string; dot: string; label: string }> = {
  ok: { badge: "bg-hover text-ink-2", dot: "bg-faint", label: "No prazo" },
  aviso: { badge: "bg-warn-soft text-warn", dot: "bg-[#e09f3e]", label: "Atenção" },
  critico: { badge: "bg-alert-soft text-alert", dot: "bg-alert", label: "Crítico" },
};
