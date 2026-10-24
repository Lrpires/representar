// Leitura do XML da NF-e (modelo 55), feita no navegador.
// Pega o que importa para vincular a nota ao pedido: número, série, data, valor,
// CNPJ de quem emitiu (representada) e de quem recebeu (cliente) e os itens.

import { digits } from "./br";

export type NfeItem = { code: string; description: string; unit: string; qty: number; unitPrice: number; total: number };
// Parcela (duplicata) da cobrança: número, vencimento e valor.
export type NfeInstallment = { number: string; dueDate: string; value: number };
export type Nfe = {
  accessKey: string | null;
  number: string;
  series: string;
  issuedAt: string; // AAAA-MM-DD
  total: number;
  emitCnpj: string;
  emitName: string;
  destDoc: string; // CNPJ ou CPF, só números
  destName: string;
  items: NfeItem[];
  installments: NfeInstallment[];
  additionalInfo: string; // informações complementares (infCpl / infAdFisco)
  orderRefs: string[]; // números de pedido citados na nota (xPed dos itens e "Pedido 123" nas informações)
};

// Números de pedido escritos nas informações complementares: "Pedido 360", "Ped. nº 360", "N/Pedido: 360",
// "Seu pedido 360/26", "Pedido do representante 360"…
export function orderRefsFromText(text: string): string[] {
  const out: string[] = [];
  const re = /\bped(?:ido)?s?\b\.?[^0-9\n]{0,25}?(\d{1,9})(?:\s*[,e/]\s*(\d{1,9}))*/gi;
  for (const m of text.matchAll(re)) {
    for (const n of m[0].match(/\d{1,9}/g) ?? []) {
      // "360/26": o número que vem depois da barra é o ano, não outro pedido.
      if (/^\d{2}$/.test(n) && m[0].includes(`/${n}`)) continue;
      out.push(n.replace(/^0+(?=\d)/, ""));
    }
  }
  return out;
}

const num = (s: string | null | undefined) => {
  const n = Number((s ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};

export function parseNfe(xml: string): Nfe {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("O arquivo não é um XML válido.");
  // Busca pelo nome da tag, ignorando o "namespace" da NF-e.
  const all = (name: string, root: Document | Element = doc) => Array.from(root.getElementsByTagNameNS("*", name));
  const first = (name: string, root: Document | Element = doc) => all(name, root)[0] ?? null;
  const text = (name: string, root: Document | Element = doc) => first(name, root)?.textContent?.trim() ?? "";

  const inf = first("infNFe");
  if (!inf) throw new Error("Este XML não parece ser de uma NF-e.");
  const ide = first("ide", inf)!;
  const emit = first("emit", inf);
  const dest = first("dest", inf);

  const keyFromId = digits(inf.getAttribute("Id"));
  const keyFromProt = digits(text("chNFe"));
  const accessKey = [keyFromProt, keyFromId].find((k) => k.length === 44) ?? null;

  const issued = text("dhEmi", ide) || text("dEmi", ide);
  const items: NfeItem[] = all("det", inf).map((det) => {
    const prod = first("prod", det)!;
    return {
      code: text("cProd", prod),
      description: text("xProd", prod),
      unit: text("uCom", prod),
      qty: num(text("qCom", prod)),
      unitPrice: num(text("vUnCom", prod)),
      total: num(text("vProd", prod)),
    };
  });

  // Cobrança: <cobr><dup><nDup/><dVenc/><vDup/></dup>…
  const installments: NfeInstallment[] = all("dup", inf)
    .map((d) => ({ number: text("nDup", d), dueDate: text("dVenc", d).slice(0, 10), value: num(text("vDup", d)) }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.dueDate) && d.value > 0);

  const additionalInfo = [text("infCpl"), text("infAdFisco")].filter(Boolean).join("\n");
  const xPed = all("xPed", inf).map((e) => digits(e.textContent).replace(/^0+(?=\d)/, "")).filter(Boolean);
  const orderRefs = [...new Set([...xPed, ...orderRefsFromText(additionalInfo)])];

  return {
    accessKey,
    installments,
    additionalInfo,
    orderRefs,
    number: text("nNF", ide).replace(/^0+(?=\d)/, ""),
    series: text("serie", ide),
    issuedAt: issued.slice(0, 10),
    total: num(text("vNF", first("ICMSTot", inf) ?? inf)),
    emitCnpj: digits(emit ? text("CNPJ", emit) : ""),
    emitName: emit ? text("xNome", emit) : "",
    destDoc: digits(dest ? text("CNPJ", dest) || text("CPF", dest) : ""),
    destName: dest ? text("xNome", dest) : "",
    items,
  };
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Casa os itens da nota com os itens do pedido: primeiro pelo código, depois pela descrição.
export function matchItems<T extends { id: string; code: string; description: string }>(nfe: NfeItem[], order: T[]) {
  const used = new Set<string>();
  const result = new Map<string, number>(); // id do item do pedido -> quantidade da nota
  const unmatched: NfeItem[] = [];
  for (const it of nfe) {
    const byCode = it.code ? order.find((o) => !used.has(o.id) && o.code && norm(o.code) === norm(it.code)) : undefined;
    const byDesc =
      byCode ??
      order.find((o) => !used.has(o.id) && norm(o.description) === norm(it.description)) ??
      order.find((o) => !used.has(o.id) && (norm(o.description).includes(norm(it.description)) || norm(it.description).includes(norm(o.description))));
    if (byDesc) {
      used.add(byDesc.id);
      result.set(byDesc.id, (result.get(byDesc.id) ?? 0) + it.qty);
    } else unmatched.push(it);
  }
  return { qty: result, unmatched };
}
