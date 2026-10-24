// Atraso do pedido: dias depois da previsão de entrega sem estar totalmente faturado.
// Amarelo (aviso) e vermelho (crítico) a partir dos prazos das Configurações.
// Pedido sem previsão de entrega não entra no controle de atraso.

export type AgingLevel = "ok" | "aviso" | "critico";
export type Aging = { days: number; level: AgingLevel } | null;

const DAY = 86400000;

export function orderAging(
  o: { status: string; expected_delivery?: string | null },
  warnDays: number,
  criticalDays: number,
  today: string,
): Aging {
  if (o.status !== "enviado" && o.status !== "parcial") return null;
  if (!o.expected_delivery) return null;
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(String(o.expected_delivery).slice(0, 10))) / DAY));
  const level: AgingLevel = days >= criticalDays ? "critico" : days >= warnDays ? "aviso" : "ok";
  return { days, level };
}

export const AGING_STYLE: Record<AgingLevel, { badge: string; dot: string; label: string }> = {
  ok: { badge: "bg-hover text-ink-2", dot: "bg-faint", label: "No prazo" },
  aviso: { badge: "bg-warn-soft text-warn", dot: "bg-warn-dot", label: "Atenção" },
  critico: { badge: "bg-alert-soft text-alert", dot: "bg-alert", label: "Crítico" },
};
