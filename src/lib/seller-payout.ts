// Repasse de comissão aos vendedores (migração 029). Só o escritório vê (canSeeCommissions).
// Regra do vendedor, uma só para todas as representadas:
//   share → % da comissão que o escritório recebeu
//   rate  → % do valor faturado da nota, na proporção do que o escritório já recebeu daquela comissão
// O vendedor ganha quando o escritório recebe.

export type SellerRule = { id: string; seller_id: string | null; seller_name: string | null; mode: "share" | "rate"; value: number };

export const RULE_MODES = [
  { value: "share", label: "% da comissão do escritório", hint: "Ex.: 40% de uma comissão de R$ 300 = R$ 120." },
  { value: "rate", label: "% do valor faturado", hint: "Ex.: 1% de uma nota de R$ 10.000 = R$ 100." },
] as const;

const r2 = (n: number) => Math.round(n * 100) / 100;

// Quem é o vendedor da comissão: o nome do sistema antigo (pedido importado) ou o login.
export function sellerKey(o: { seller_id: string | null; seller_name?: string | null }): string {
  return o.seller_name ? `nome:${o.seller_name.trim().toLowerCase()}` : `id:${o.seller_id ?? ""}`;
}

// A regra do vendedor: pelo login; se não houver, pelo nome (vendedor do sistema antigo ou o nome do membro).
export function ruleFor(rules: SellerRule[], key: string, memberName?: string | null): SellerRule | null {
  if (key.startsWith("id:")) {
    const id = key.slice(3);
    const byId = rules.find((r) => r.seller_id === id);
    if (byId) return byId;
  }
  const name = key.startsWith("nome:") ? key.slice(5) : (memberName ?? "").trim().toLowerCase();
  return (name && rules.find((r) => !r.seller_id && (r.seller_name ?? "").trim().toLowerCase() === name)) || null;
}

// Quanto do recebimento vai para o vendedor.
export function payoutOf(
  receiptAmount: number,
  commission: { value: number; base_value: number },
  rule: Pick<SellerRule, "mode" | "value"> | null,
): number {
  if (!rule || receiptAmount <= 0) return 0;
  if (rule.mode === "share") return r2((receiptAmount * rule.value) / 100);
  // rate: % do valor faturado, na proporção do que já entrou desta comissão
  if (!commission.value) return 0;
  return r2(((receiptAmount / commission.value) * commission.base_value * rule.value) / 100);
}

export function ruleText(rule: Pick<SellerRule, "mode" | "value"> | null, pct: (n: number) => string): string {
  if (!rule) return "Sem regra";
  return rule.mode === "share" ? `${pct(rule.value)} da comissão` : `${pct(rule.value)} do faturado`;
}
