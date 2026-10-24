import { inputText, numberText, parseAmount, type NumFmt } from "@/lib/number-format";
export type OrderStatus = "rascunho" | "enviado" | "parcial" | "faturado" | "entregue" | "cancelado";

export const STATUS_LIST: { value: OrderStatus; label: string; tone: "neutral" | "info" | "pen" | "warn" | "ok" | "alert" }[] = [
  { value: "rascunho", label: "Rascunho", tone: "neutral" },
  { value: "enviado", label: "Enviado", tone: "info" },
  { value: "parcial", label: "Faturado parcial", tone: "pen" },
  { value: "faturado", label: "Faturado", tone: "ok" },
  { value: "entregue", label: "Entregue", tone: "ok" },
  { value: "cancelado", label: "Cancelado", tone: "alert" },
];

// Pedidos que contam como venda (enviados, parcial ou totalmente faturados).
export const SOLD_STATUSES = ["enviado", "parcial", "faturado", "entregue"];
// Pedidos ainda esperando faturamento (é sobre eles que vale o aviso de atraso).
export const OPEN_STATUSES = ["enviado", "parcial"];

// Status do playbook (o "Entregue" antigo continua aparecendo nos pedidos que já o tinham).
export const MAIN_STATUSES = STATUS_LIST.filter((s) => s.value !== "entregue");

export const statusInfo = (s: string) => STATUS_LIST.find((x) => x.value === s) ?? STATUS_LIST[0];

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

// 12 -> "PED-12/26" conforme prefixo e sufixo do escritório.
export function formatOrderNumber(n: number, s: { orderPrefix: string; orderSuffix: string }): string {
  return `${s.orderPrefix}${n}${s.orderSuffix}`;
}

/* ---------- Cálculo do pedido (igual na tela e no servidor) ---------- */

export type LineInput = { qty: number; price: number; discount: number };

// Preço com desconto do item e total da linha.
export function lineTotals({ qty, price, discount }: LineInput) {
  const unit = round4(price * (1 - discount / 100));
  return { unit, total: round2(qty * unit) };
}

// Totais do pedido. A comissão incide sobre a mercadoria (já com desconto), sem o frete.
export function orderTotals(lines: LineInput[], discountPct: number, freight: number, commissionPct: number) {
  const subtotal = round2(lines.reduce((s, l) => s + lineTotals(l).total, 0));
  const discountValue = round2((subtotal * discountPct) / 100);
  const net = round2(subtotal - discountValue);
  const total = round2(net + freight);
  const commission = round2((net * commissionPct) / 100);
  const qty = lines.reduce((s, l) => s + l.qty, 0);
  return { subtotal, discountValue, net, total, commission, qty };
}

// Lê o que foi digitado no formato do escritório; vazio ou inválido vira 0.
export function num(raw: string | number | null | undefined, f?: NumFmt): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const s = (raw ?? "").trim();
  if (!s) return 0;
  const n = parseAmount(s, f);
  return Number.isFinite(n) ? n : 0;
}

// 1234.5 -> "1234,5" (campos de quantidade e preço, no formato do escritório e sem milhar)
export function numText(n: number | null | undefined, decimals = 4, f?: NumFmt): string {
  if (n == null || !Number.isFinite(Number(n))) return "";
  return inputText(Number(n), decimals, f);
}

export const PAYMENT_TERMS = [
  "À vista", "Antecipado", "7 dias", "14 dias", "21 dias", "28 dias", "30 dias", "28/56 dias",
  "30/60 dias", "30/60/90 dias", "28/35/42 dias", "Boleto 15 dias",
];

// Quantidade para MOSTRAR (não para campo): no padrão do escritório, com milhar e 2 casas (até 3). 11000 -> "11.000,00"
export function qtyText(n: number | null | undefined, f?: NumFmt): string {
  if (n == null || !Number.isFinite(Number(n))) return "";
  return numberText(Number(n), 3, f, 2);
}

// Preço para campo de edição: sempre com 2 casas (até 4 se precisar). 24.9 -> "24,90"
export function priceText(n: number | null | undefined, f?: NumFmt): string {
  if (n == null || !Number.isFinite(Number(n))) return "";
  return inputText(Number(n), 4, f, 2);
}
