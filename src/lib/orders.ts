export type OrderStatus = "rascunho" | "enviado" | "faturado" | "entregue" | "cancelado";

export const STATUS_LIST: { value: OrderStatus; label: string; tone: "neutral" | "pen" | "warn" | "ok" | "alert" }[] = [
  { value: "rascunho", label: "Rascunho", tone: "neutral" },
  { value: "enviado", label: "Enviado", tone: "pen" },
  { value: "faturado", label: "Faturado", tone: "warn" },
  { value: "entregue", label: "Entregue", tone: "ok" },
  { value: "cancelado", label: "Cancelado", tone: "alert" },
];

export const statusInfo = (s: string) => STATUS_LIST.find((x) => x.value === s) ?? STATUS_LIST[0];

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
