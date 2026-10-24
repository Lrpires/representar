import { money, numberText, parseAmount, type NumFmt } from "@/lib/number-format";

export function text(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optional(fd: FormData, key: string): string | null {
  return text(fd, key) || null;
}

// Lê o número digitado no formato do escritório ("1.234,56" ou "1,234.56").
export function parseNumber(raw: string, f?: NumFmt): number {
  return parseAmount(raw, f);
}

// Valor em dinheiro na moeda e no formato do escritório (o nome ficou "brl" por histórico).
export function brl(value: number | string, f?: NumFmt): string {
  return money(value, f);
}

// "2026-10-03" -> "03/10/2026" (sem passar por fuso horário)
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Período por extenso nos relatórios: "de 01/10/2026 a 24/10/2026".
export function rangeText(start: string, end: string): string {
  return start === end ? `em ${formatDate(start)}` : `de ${formatDate(start)} a ${formatDate(end)}`;
}

// Data de hoje (AAAA-MM-DD) no fuso do Brasil, para comparar com vigências.
export function todayISO(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

// Tira caracteres que quebram o filtro de busca do banco.
export function safeQ(raw: string | undefined): string {
  return (raw ?? "").replace(/[,()*%\\]/g, " ").trim();
}

export function pct(value: number | string | null, f?: NumFmt): string {
  if (value == null) return "";
  return `${numberText(Number(value), 2, f)}%`;
}
