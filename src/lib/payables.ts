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
