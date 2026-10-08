import { pct } from "@/lib/format";

export type Option = readonly [value: string, label: string];

// Sobre o quê incide o percentual.
export const baseOptions: readonly Option[] = [
  ["valor_total", "Valor total do pedido"],
  ["sem_ipi", "Valor sem IPI"],
  ["sem_impostos", "Valor sem impostos"],
  ["sem_impostos_frete", "Valor sem impostos e sem frete"],
];

// Quando a comissão passa a ser devida.
export const triggerOptions: readonly Option[] = [
  ["pedido", "Quando o pedido é fechado"],
  ["faturamento", "Quando a fábrica fatura (emite a NF)"],
  ["recebimento_cliente", "Quando o cliente paga a fábrica"],
];

// Como é liberada depois disso.
export const releaseOptions: readonly Option[] = [
  ["integral", "Tudo de uma vez"],
  ["por_parcela", "Proporcional a cada parcela recebida"],
];

// Quando a fábrica acerta com você.
export const closeOptions: readonly Option[] = [
  ["dia_fixo", "Em dia fixo do mês seguinte"],
  ["dias_apos_evento", "Alguns dias depois do evento"],
  ["semanal", "Toda semana"],
  ["quinzenal", "A cada quinzena"],
];

export const payOptions: readonly Option[] = [
  ["pix", "Pix"],
  ["ted", "TED"],
  ["boleto", "Boleto"],
  ["deposito", "Depósito"],
  ["desconto_em_conta", "Desconto em conta"],
  ["outro", "Outro"],
];

export const valid = (options: readonly Option[], v: string) => options.some(([k]) => k === v);

const baseText: Record<string, string> = {
  valor_total: "o valor total do pedido",
  sem_ipi: "o valor sem IPI",
  sem_impostos: "o valor sem impostos",
  sem_impostos_frete: "o valor sem impostos e sem frete",
};
const triggerText: Record<string, string> = {
  pedido: "quando o pedido é fechado",
  faturamento: "quando a fábrica fatura",
  recebimento_cliente: "quando o cliente paga a fábrica",
};
const releaseText: Record<string, string> = {
  integral: "de uma só vez",
  por_parcela: "proporcional a cada parcela recebida",
};
const payText: Record<string, string> = {
  pix: "Pix",
  ted: "TED",
  boleto: "boleto",
  deposito: "depósito",
  desconto_em_conta: "desconto em conta",
  outro: "outra forma",
};

export type CommissionRule = {
  default_commission_pct: number | string | null;
  commission_base: string;
  commission_trigger: string;
  commission_release: string;
  commission_close_mode: string;
  commission_close_day: number | null;
  commission_days_after: number | null;
  commission_pay_method: string;
  commission_needs_invoice: boolean;
  commission_chargeback: boolean;
  commission_chargeback_days: number | null;
};

// Frase em português que resume a regra, para conferir de relance.
export function commissionSummary(r: CommissionRule): string {
  const rate = r.default_commission_pct != null ? pct(r.default_commission_pct) : "Percentual ainda não definido";
  let close = "";
  if (r.commission_close_mode === "dia_fixo")
    close = r.commission_close_day ? `paga até o dia ${r.commission_close_day} do mês seguinte` : "paga no mês seguinte";
  else if (r.commission_close_mode === "dias_apos_evento")
    close = `paga ${r.commission_days_after ?? 0} dias depois`;
  else if (r.commission_close_mode === "semanal") close = "paga toda semana";
  else close = "paga a cada quinzena";

  let text =
    `${rate} sobre ${baseText[r.commission_base] ?? ""}, devida ${triggerText[r.commission_trigger] ?? ""}, ` +
    `liberada ${releaseText[r.commission_release] ?? ""}; ${close}, por ${payText[r.commission_pay_method] ?? ""}.`;
  if (r.commission_needs_invoice) text += " Você emite nota ou recibo para receber.";
  if (r.commission_chargeback)
    text += r.commission_chargeback_days
      ? ` Devolução ou inadimplência estorna em até ${r.commission_chargeback_days} dias.`
      : " Devolução ou inadimplência estorna a comissão.";
  return text;
}
