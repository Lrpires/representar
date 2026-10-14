// Consultas a APIs públicas e gratuitas, feitas direto do navegador:
// - CEP: ViaCEP (viacep.com.br)
// - CNPJ: BrasilAPI (brasilapi.com.br), com dados públicos da Receita Federal.
import { digits, formatPhone } from "./br";

const SMALL = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no"]);

// "AVENIDA REPUBLICA DO CHILE" -> "Avenida Republica do Chile"
export function titleCase(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export type CepResult = { zip: string; street: string; district: string; city: string; state: string };

export async function fetchCep(raw: string, signal?: AbortSignal): Promise<CepResult | null> {
  const cep = digits(raw);
  if (cep.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal });
  if (!res.ok) return null;
  const d = await res.json();
  if (d.erro) return null;
  return {
    zip: d.cep ?? raw,
    street: d.logradouro ?? "",
    district: d.bairro ?? "",
    city: d.localidade ?? "",
    state: d.uf ?? "",
  };
}

export type CnpjResult = {
  legalName: string;
  tradeName: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  situation: string;
};

export async function fetchCnpj(raw: string, signal?: AbortSignal): Promise<CnpjResult | null> {
  const cnpj = digits(raw);
  if (cnpj.length !== 14) return null;
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal });
  if (!res.ok) return null;
  const d = await res.json();
  const cep = digits(d.cep);
  const number = String(d.numero ?? "").trim();
  return {
    legalName: (d.razao_social ?? "").trim(),
    tradeName: titleCase(d.nome_fantasia),
    zip: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : "",
    street: titleCase([d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ")),
    number: number === "S/N" || number === "SN" ? "S/N" : number,
    complement: titleCase(d.complemento),
    district: titleCase(d.bairro),
    city: titleCase(d.municipio),
    state: (d.uf ?? "").toUpperCase(),
    phone: d.ddd_telefone_1 ? formatPhone(String(d.ddd_telefone_1)) : "",
    email: (d.email ?? "").toLowerCase(),
    situation: titleCase(d.descricao_situacao_cadastral),
  };
}
