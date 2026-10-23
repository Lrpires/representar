// Listas de opções (cor, tamanho, voltagem…): cadastradas uma vez e ligadas a vários produtos.
// No pedido, o produto abre uma grade com as opções; cada opção (ou cor × tamanho) vira uma linha.

export type OptionValue = {
  id: string;
  name: string;
  code: string | null;
  priceAdjust: number | null; // acréscimo (negativo = desconto)
  adjustType: "valor" | "pct";
};
export type OptionList = { id: string; kind: string; name: string; values: OptionValue[] };

export const OPTION_KINDS = ["Cor", "Tamanho", "Voltagem", "Sabor", "Embalagem", "Modelo", "Acabamento", "Material"];

// Na grade, no máximo duas listas por produto: linhas × colunas (ex.: Cor × Tamanho).
export const MAX_LISTS_PER_PRODUCT = 2;

const r4 = (n: number) => Math.round(n * 10000) / 10000;

// Preço com os acréscimos das opções escolhidas (em valor somam; em % aplicam sobre o preço base).
export function priceWithOptions(base: number, values: (OptionValue | null | undefined)[]): number {
  let price = base;
  for (const v of values) {
    if (!v?.priceAdjust) continue;
    price += v.adjustType === "pct" ? (base * v.priceAdjust) / 100 : v.priceAdjust;
  }
  return r4(Math.max(price, 0));
}

// Texto curto do acréscimo, ex.: "+10%" ou "+R$ 2,00".
export function adjustText(v: Pick<OptionValue, "priceAdjust" | "adjustType">, money: (n: number) => string): string {
  if (!v.priceAdjust) return "";
  const sign = v.priceAdjust > 0 ? "+" : "−";
  const abs = Math.abs(v.priceAdjust);
  return v.adjustType === "pct" ? `${sign}${String(abs).replace(".", ",")}%` : `${sign}${money(abs)}`;
}

// "Azul Marinho / M" a partir de {"Cor": "Azul Marinho", "Tamanho": "M"}.
export function optionsText(options: Record<string, string> | null | undefined): string {
  return Object.values(options ?? {}).filter(Boolean).join(" / ");
}

// Descrição da linha do pedido: "Camiseta Básica — Azul Marinho / M".
export function describeWithOptions(name: string, options: Record<string, string> | null | undefined): string {
  const extra = optionsText(options);
  return extra ? `${name} — ${extra}` : name;
}

type RawValue = {
  id: string;
  name: string;
  code: string | null;
  position: number;
  price_adjust: number | string | null;
  adjust_type: string | null;
  active: boolean;
};
type RawList = { id: string; kind: string; name: string; option_values: RawValue[] | null };

// Converte o que vem do banco (lista com as opções) tirando as inativas e as escondidas no produto.
export function toOptionList(raw: RawList, hidden: Set<string> = new Set()): OptionList {
  return {
    id: raw.id,
    kind: raw.kind,
    name: raw.name,
    values: [...(raw.option_values ?? [])]
      .filter((v) => v.active && !hidden.has(v.id))
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR"))
      .map((v) => ({
        id: v.id,
        name: v.name,
        code: v.code,
        priceAdjust: v.price_adjust == null ? null : Number(v.price_adjust),
        adjustType: v.adjust_type === "pct" ? "pct" : "valor",
      })),
  };
}
