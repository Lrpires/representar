import type { IconName } from "@/components/icons";

// Categorias de despesa (playbook: CategoriaConta).
export const PAYABLE_CATEGORIES: { value: string; label: string; icon: IconName }[] = [
  { value: "combustivel", label: "Combustível", icon: "truck" },
  { value: "hospedagem", label: "Hospedagem", icon: "home" },
  { value: "alimentacao", label: "Alimentação", icon: "receipt" },
  { value: "impostos", label: "Impostos", icon: "percent" },
  { value: "telefone_internet", label: "Telefone/Internet", icon: "phone" },
  { value: "outros", label: "Outros", icon: "tag" },
];

export const categoryInfo = (v: string) => PAYABLE_CATEGORIES.find((c) => c.value === v) ?? PAYABLE_CATEGORIES[5];

// Cadastros das contas a pagar (migração 018): cada escritório tem os seus, com uma lista pronta.
export type PayableOptionKind = "tipo" | "centro" | "forma";
export type PayableOption = { id: string; kind: PayableOptionKind; name: string; active: boolean; sort: number };

export const OPTION_KINDS: { kind: PayableOptionKind; title: string; hint: string; placeholder: string }[] = [
  {
    kind: "tipo",
    title: "Tipos de despesa",
    hint: "O que é a conta: combustível, aluguel, impostos… Usados para somar e filtrar as despesas.",
    placeholder: "Ex.: Feira e eventos",
  },
  {
    kind: "centro",
    title: "Centros de custo",
    hint: "De qual área do escritório é o gasto. Ajuda a ver quanto custa cada parte da operação.",
    placeholder: "Ex.: Filial Recife",
  },
  {
    kind: "forma",
    title: "Formas de pagamento",
    hint: "Como a conta é paga.",
    placeholder: "Ex.: Cartão corporativo",
  },
];
