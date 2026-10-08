// Lista fixa de unidades de venda. Mantenha igual ao enum unit_type do banco.
export const UNITS = [
  { value: "unidade", label: "Unidade" },
  { value: "caixa", label: "Caixa" },
  { value: "metro", label: "Metro" },
  { value: "kg", label: "Kg" },
] as const;

export function unitLabel(value: string): string {
  return UNITS.find((u) => u.value === value)?.label ?? value;
}
