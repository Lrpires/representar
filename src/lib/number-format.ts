// Moeda e formato dos números do escritório (Configurações → Moeda e números).
// Vale para mostrar valores e também para ler o que a pessoa digita ("1.234,56" ou "1,234.56").
import { cache } from "react";

export type NumberStyle = "br" | "us";
export type NumFmt = { currency: string; style: NumberStyle; group: boolean };

export const DEFAULT_FMT: NumFmt = { currency: "BRL", style: "br", group: true };

export const CURRENCIES: { code: string; label: string }[] = [
  { code: "BRL", label: "Real brasileiro" },
  { code: "USD", label: "Dólar americano" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "Libra esterlina" },
  { code: "ARS", label: "Peso argentino" },
  { code: "UYU", label: "Peso uruguaio" },
  { code: "PYG", label: "Guarani paraguaio" },
  { code: "CLP", label: "Peso chileno" },
  { code: "MXN", label: "Peso mexicano" },
  { code: "COP", label: "Peso colombiano" },
  { code: "PEN", label: "Sol peruano" },
  { code: "CNY", label: "Yuan chinês" },
];

export function toFmt(row: { currency?: string | null; number_style?: string | null; number_group?: boolean | null } | null | undefined): NumFmt {
  const currency = row?.currency && CURRENCIES.some((c) => c.code === row.currency) ? row.currency : DEFAULT_FMT.currency;
  const style: NumberStyle = row?.number_style === "us" ? "us" : "br";
  return { currency, style, group: row?.number_group ?? true };
}

/* ---------------------------------------------------------------- formato ativo */

// No servidor: um por requisição (cada escritório com o seu). No navegador: o do escritório aberto.
const requestStore = cache(() => ({ fmt: null as NumFmt | null }));
let browserFmt: NumFmt = DEFAULT_FMT;

export function setActiveFormat(f: NumFmt) {
  if (typeof window !== "undefined") {
    browserFmt = f;
    return;
  }
  try {
    requestStore().fmt = f;
  } catch {
    /* fora de uma requisição: fica o padrão */
  }
}

export function activeFormat(): NumFmt {
  if (typeof window !== "undefined") return browserFmt;
  try {
    return requestStore().fmt ?? DEFAULT_FMT;
  } catch {
    return DEFAULT_FMT;
  }
}

/* ---------------------------------------------------------------- mostrar */

const locale = (f: NumFmt) => (f.style === "us" ? "en-US" : "pt-BR");

// Valor em dinheiro: "R$ 1.234,56", "US$ 1,234.56", "€ 1.234,56"…
export function money(value: number | string, f: NumFmt = activeFormat()): string {
  return new Intl.NumberFormat(locale(f), { style: "currency", currency: f.currency, useGrouping: f.group }).format(Number(value) || 0);
}

// Número para ler (quantidades, percentuais): separador de milhar conforme o escritório.
export function numberText(n: number, maxDecimals = 3, f: NumFmt = activeFormat(), minDecimals = 0): string {
  return Number(n).toLocaleString(locale(f), { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals, useGrouping: f.group });
}

// Número para campo de edição (sem separador de milhar, para não confundir na digitação).
export function inputText(n: number, maxDecimals = 4, f: NumFmt = activeFormat(), minDecimals = 0): string {
  return Number(n).toLocaleString(locale(f), { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals, useGrouping: false });
}

// Símbolo da moeda ("R$", "US$", "€"), para rótulos e campos.
export function currencySymbol(f: NumFmt = activeFormat()): string {
  const part = new Intl.NumberFormat(locale(f), { style: "currency", currency: f.currency }).formatToParts(0).find((p) => p.type === "currency");
  return part?.value ?? f.currency;
}

/* ---------------------------------------------------------------- ler o que foi digitado */

// Brasil: "1.234,56" ou "12,5" (e também "12.5"). EUA: "1,234.56" ou "12.5".
export function parseAmount(raw: string, f: NumFmt = activeFormat()): number {
  const s = raw.trim().replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (!s) return NaN;
  if (f.style === "us") return Number(s.replace(/,/g, ""));
  return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}
