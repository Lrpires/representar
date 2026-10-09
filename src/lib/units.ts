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
