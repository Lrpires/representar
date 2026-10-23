// Quais comissões nascem de uma nota fiscal, conforme a regra da representada.
// - Paga NA LIQUIDEZ (quando o cliente paga a fábrica): uma comissão por parcela (duplicata),
//   na proporção do valor dela, vencendo pela regra aplicada ao vencimento de cada parcela
//   (ex.: "dia 10 do mês seguinte": parcela de 10/12 → comissão em janeiro; parcela de 10/01 → fevereiro).
// - Paga NO FATURAMENTO: o valor completo de uma vez, contado a partir da emissão da nota.
import { commissionDueDate, type DueRule } from "@/lib/commission-due";

export type InstallmentIn = { number: string | null; dueDate: string; value: number };
export type PlanRule = DueRule & { commission_trigger?: string | null; commission_release?: string | null };
export type PlannedCommission = { installmentIndex: number | null; base: number; value: number; dueDate: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function planCommissions({
  issuedAt,
  invoiceValue,
  pct,
  installments,
  rule,
}: {
  issuedAt: string;
  invoiceValue: number;
  pct: number;
  installments: InstallmentIn[];
  rule: PlanRule;
}): PlannedCommission[] {
  const totalCommission = r2((invoiceValue * pct) / 100);

  const liquidez = rule.commission_trigger === "recebimento_cliente" || rule.commission_release === "por_parcela";
  if (liquidez && installments.length > 0) {
    const sum = installments.reduce((s, i) => s + i.value, 0);
    let baseLeft = r2(invoiceValue);
    let valueLeft = totalCommission;
    return installments.map((inst, idx) => {
      const last = idx === installments.length - 1;
      // A última parcela fica com o que sobrar, para a soma bater certinho com a nota.
      const base = last ? baseLeft : r2((invoiceValue * inst.value) / sum);
      const value = last ? valueLeft : r2((base * pct) / 100);
      baseLeft = r2(baseLeft - base);
      valueLeft = r2(valueLeft - value);
      return { installmentIndex: idx, base, value, dueDate: commissionDueDate(inst.dueDate, rule) };
    });
  }

  return [{ installmentIndex: null, base: r2(invoiceValue), value: totalCommission, dueDate: commissionDueDate(issuedAt, rule) }];
}

// Parcelas a partir do prazo do pedido ("30/60/90 dias", "28/56 dias", "À vista"…), dividindo o valor.
export function installmentsFromTerms(terms: string | null | undefined, issuedAt: string, value: number): InstallmentIn[] {
  const days = (terms ?? "").match(/\d+/g)?.map(Number).filter((n) => n > 0 && n <= 720) ?? [];
  const list = days.length ? days : [0];
  const each = Math.floor((value / list.length) * 100) / 100;
  return list.map((d, i) => {
    const dt = new Date(`${issuedAt}T12:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + d);
    const v = i === list.length - 1 ? r2(value - each * (list.length - 1)) : each;
    return { number: String(i + 1).padStart(3, "0"), dueDate: dt.toISOString().slice(0, 10), value: v };
  });
}
