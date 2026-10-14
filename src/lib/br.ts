// Documentos e telefones brasileiros: só dígitos, formatação e validação.

export const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export function formatCnpj(raw: string): string {
  const d = digits(raw).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatCpf(raw: string): string {
  const d = digits(raw).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

// (81) 3333-4444 ou (81) 99999-8888
export function formatPhone(raw: string): string {
  const d = digits(raw).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidCnpj(raw: string): boolean {
  const d = digits(raw);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function isValidCpf(raw: string): boolean {
  const d = digits(raw);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

// Telefone com DDD: 10 (fixo) ou 11 dígitos (celular).
export const isValidPhone = (raw: string) => [10, 11].includes(digits(raw).length);

// Link para abrir conversa no WhatsApp (wa.me), sempre com o código do Brasil.
export function whatsappUrl(phone: string | null | undefined): string | null {
  const d = digits(phone);
  if (d.length < 10) return null;
  return `https://wa.me/${d.startsWith("55") && d.length > 11 ? d : `55${d}`}`;
}
