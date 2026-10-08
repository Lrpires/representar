export function text(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optional(fd: FormData, key: string): string | null {
  return text(fd, key) || null;
}

// Aceita "1.234,56" (padrão brasileiro) e "12.5" (ponto decimal).
export function parseNumber(raw: string): number {
  const s = raw.trim();
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(normalized);
}

const brlFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function brl(value: number | string): string {
  return brlFormat.format(Number(value));
}

// "2026-10-03" -> "03/10/2026" (sem passar por fuso horário)
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Data de hoje (AAAA-MM-DD) no fuso do Brasil, para comparar com vigências.
export function todayISO(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

// Tira caracteres que quebram o filtro de busca do banco.
export function safeQ(raw: string | undefined): string {
  return (raw ?? "").replace(/[,()*%\\]/g, " ").trim();
}

export function pct(value: number | string | null): string {
  if (value == null) return "";
  return `${String(value).replace(".", ",")}%`;
}
