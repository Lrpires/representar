// Unidades de venda. Mantenha igual ao enum unit_type do banco (migrations 001 e 003).
export const UNIT_GROUPS: { label: string; units: [string, string][] }[] = [
  {
    label: "Contagem",
    units: [
      ["unidade", "Unidade"], ["peca", "Peça"], ["par", "Par"], ["duzia", "Dúzia"], ["cento", "Cento"],
      ["milheiro", "Milheiro"], ["conjunto", "Conjunto"], ["kit", "Kit"], ["jogo", "Jogo"],
    ],
  },
  {
    label: "Embalagem",
    units: [
      ["caixa", "Caixa"], ["pacote", "Pacote"], ["fardo", "Fardo"], ["saco", "Saco"], ["rolo", "Rolo"],
      ["bobina", "Bobina"], ["cartela", "Cartela"], ["display", "Display"], ["palete", "Palete"],
      ["lata", "Lata"], ["frasco", "Frasco"], ["tubo", "Tubo"], ["galao", "Galão"], ["barril", "Barril"],
    ],
  },
  { label: "Peso", units: [["kg", "Kg"], ["grama", "Grama"], ["tonelada", "Tonelada"]] },
  { label: "Volume", units: [["litro", "Litro"], ["metro_cubico", "Metro cúbico (m³)"]] },
  { label: "Medida", units: [["metro", "Metro"], ["metro_quadrado", "Metro quadrado (m²)"], ["centimetro", "Centímetro"]] },
  { label: "Tempo", units: [["hora", "Hora"]] },
];

export const UNITS: { value: string; label: string }[] = UNIT_GROUPS.flatMap((g) =>
  g.units.map(([value, label]) => ({ value, label })),
);

export function unitLabel(value: string): string {
  return UNITS.find((u) => u.value === value)?.label ?? value;
}

// Só as unidades ligadas nas configurações. "keep" mantém a unidade atual de um
// produto mesmo que ela tenha sido desligada depois.
export function unitGroupsFor(enabled: string[], keep?: string) {
  const on = new Set(enabled);
  if (keep) on.add(keep);
  return UNIT_GROUPS.map((g) => ({ ...g, units: g.units.filter(([v]) => on.has(v)) })).filter((g) => g.units.length > 0);
}

// Abreviação para mostrar quantidades ("120 kg", "340 pç").
const SHORT: Record<string, string> = {
  unidade: "un.", peca: "pç", par: "pares", duzia: "dz", cento: "cento", milheiro: "milheiro", conjunto: "conj.",
  kit: "kits", jogo: "jogos", caixa: "cx", pacote: "pct", fardo: "fardos", saco: "sacos", rolo: "rolos",
  bobina: "bobinas", cartela: "cartelas", display: "displays", palete: "paletes", lata: "latas", frasco: "frascos",
  tubo: "tubos", galao: "galões", barril: "barris", kg: "kg", grama: "g", tonelada: "t", litro: "L",
  metro_cubico: "m³", metro: "m", metro_quadrado: "m²", centimetro: "cm", hora: "h",
};
export function unitShort(value: string): string {
  return SHORT[value] ?? unitLabel(value).toLowerCase();
}
