import { getContext } from "@/lib/session";
import type { GoalRow, InvoiceRow, SaleRow } from "@/lib/goals";

// Vendas (pedidos enviados/faturados) e notas fiscais de um intervalo.
export async function fetchActivity(from: string, to: string) {
  const { supabase } = await getContext();
  const [{ data: orders }, { data: inv }] = await Promise.all([
    supabase
      .from("orders")
      .select("order_date, total, principal_id, seller_id, customer_id")
      .in("status", ["enviado", "faturado", "entregue"])
      .gte("order_date", from)
      .lte("order_date", to)
      .limit(20000),
    supabase
      .from("order_invoices")
      .select("issued_at, value, orders!inner(principal_id, seller_id, status)")
      .neq("orders.status", "cancelado")
      .gte("issued_at", from)
      .lte("issued_at", to)
      .limit(20000),
  ]);
  const sales = (orders ?? []) as SaleRow[];
  const invoices: InvoiceRow[] = (inv ?? []).map((i) => {
    const o = i.orders as unknown as { principal_id: string; seller_id: string };
    return { issued_at: i.issued_at, value: Number(i.value), principal_id: o.principal_id, seller_id: o.seller_id };
  });
  return { sales, invoices };
}

// Metas que tocam o intervalo [start, end] e as vendas/notas necessárias para calcular o realizado.
export async function loadGoals(start: string, end: string) {
  const { supabase } = await getContext();
  const { data: goalsData, error } = await supabase
    .from("goals")
    .select("id, principal_id, seller_id, metric, period_start, period_end, target, notes")
    .lte("period_start", end)
    .gte("period_end", start)
    .order("period_start");
  const goals = (goalsData ?? []) as GoalRow[];
  if (error || goals.length === 0) return { goals, sales: [] as SaleRow[], invoices: [] as InvoiceRow[], error };

  const from = goals.reduce((m, g) => (g.period_start < m ? g.period_start : m), goals[0].period_start);
  const to = goals.reduce((m, g) => (g.period_end > m ? g.period_end : m), goals[0].period_end);
  const { sales, invoices } = await fetchActivity(from, to);
  return { goals, sales, invoices, error: null };
}
