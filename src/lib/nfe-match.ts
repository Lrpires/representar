// A nota é de qual cliente e de qual representada? Usado para mostrar só os pedidos certos ao lançar o XML.
import { digits } from "./br";
import type { Nfe } from "./nfe";

type OrderParty = {
  customerName: string;
  customerCnpj: string | null;
  principalName: string;
  principalLegalName?: string | null;
  principalCnpj: string | null;
};

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const root = (cnpj: string | null | undefined) => digits(cnpj).slice(0, 8);
const LEGAL = new Set(["ltda", "me", "epp", "eireli", "sa", "s", "a", "cia", "industria", "comercio", "ind", "com", "de", "da", "do", "e"]);

// A representada da nota: mesmo CNPJ ou mesma raiz (matriz e filiais), ou o nome dela na razão social do emitente.
export function samePrincipal(o: OrderParty, n: Pick<Nfe, "emitCnpj" | "emitName">) {
  if (o.principalCnpj && n.emitCnpj && root(o.principalCnpj) === root(n.emitCnpj)) return true;
  const emit = norm(n.emitName);
  if (!emit) return false;
  if (o.principalLegalName && norm(o.principalLegalName) === emit) return true;
  const words = norm(o.principalName).split(" ").filter((w) => w.length >= 3 && !LEGAL.has(w) && !/^\d+$/.test(w));
  return words.length > 0 && words.every((w) => ` ${emit} `.includes(` ${w} `));
}
// O cliente da nota: mesmo CNPJ/CPF ou mesma razão social.
export function sameCustomer(o: OrderParty, n: Pick<Nfe, "destDoc" | "destName">) {
  if (o.customerCnpj && n.destDoc && digits(o.customerCnpj) === n.destDoc) return true;
  // Compara a razão social sem "Ltda", "ME", "&", "e"… (ex.: "Vem-Ca Moda e Tecidos" = "VEM-CA MODA & TECIDOS LTDA").
  const core = (x: string) => norm(x).split(" ").filter((w) => w && !LEGAL.has(w)).join(" ");
  return !!n.destName && !!core(o.customerName) && core(o.customerName) === core(n.destName);
}
