// Relatórios: busca e consolida os números (servidor). Cada função devolve linhas prontas para tela e planilha.
import { getContext } from "@/lib/session";
import { fetchAll, type Period } from "@/lib/cockpit";
import { SOLD_STATUSES } from "@/lib/orders";
import { payoutOf, ruleFor, sellerKey, type SellerRule } from "@/lib/seller-payout";

type Supa = Awaited<ReturnType<typeof getContext>>["supabase"];
const r2 = (n: number) => Math.round(n * 100) / 100;
const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);

// Nome de cada pessoa da equipe (para mostrar o vendedor com login).
export async function memberNames(supabase: Supa, orgId: string) {
  const { data } = await supabase.from("members").select("user_id, full_name, email").eq("org_id", orgId);
  return new Map((data ?? []).map((m) => [m.user_id as string, (m.full_name || m.email || "Vendedor") as string]));
}

const sellerLabel = (key: string, names: Map<string, string>) =>
  key.startsWith("nome:") ? null : names.get(key.slice(3)) ?? "Vendedor";

/* ---------------------------------------------------------------- Repasse aos vendedores */

export type PayoutItem = {
  receiptId: string;
  receivedAt: string;
  amount: number; // o que o escritório recebeu
  payout: number; // o que vai para o vendedor
  paid: boolean;
  order: number | null;
  invoice: string | null;
  customer: string;
  principal: string;
};
export type PayoutRow = {
  key: string;
  name: string;
  rule: SellerRule | null;
  received: number;
  payout: number;
  paid: number;
  pending: number;
  items: PayoutItem[];
};

// Recebimentos de comissão no período, por vendedor, com o repasse de cada um pela regra dele.
export async function loadPayouts(P: Pick<Period, "start" | "end">, rep?: string) {
  const { supabase, orgId } = await getContext();
  type Raw = {
    id: string; amount: number; received_at: string; seller_payout_id: string | null;
    commissions: {
      value: number; base_value: number; seller_id: string | null; principal_id: string;
      orders: { number: number; seller_id: string | null; seller_name?: string | null; customers: { name: string } | null } | null;
      order_invoices: { number: string | null } | null;
      principals: { name: string } | null;
    } | null;
  };
  const [{ data: rawData, error }, { data: ruleData, error: ruleErr }, names] = await Promise.all([
    fetchAll<Raw>((a, b) => {
      let q = supabase
        .from("commission_receipts")
        .select(
          "id, amount, received_at, seller_payout_id, commissions!inner(value, base_value, seller_id, principal_id, orders(number, seller_id, seller_name, customers(name)), order_invoices(number), principals(name))",
        )
        .gte("received_at", P.start)
        .lte("received_at", P.end);
      if (rep) q = q.eq("commissions.principal_id", rep);
      return q.order("received_at").order("id").range(a, b) as unknown as PromiseLike<{ data: Raw[] | null; error: unknown }>;
    }),
    supabase.from("seller_commission_rules").select("id, seller_id, seller_name, mode, value").eq("org_id", orgId),
    memberNames(supabase, orgId),
  ]);
  const rules = ((ruleData ?? []) as SellerRule[]).map((r) => ({ ...r, value: Number(r.value) }));

  const rows = new Map<string, PayoutRow>();
  for (const x of rawData) {
    const c = one(x.commissions);
    if (!c) continue;
    const o = one(c.orders);
    const key = sellerKey({ seller_id: o?.seller_id ?? c.seller_id, seller_name: o?.seller_name ?? null });
    const name = sellerLabel(key, names) ?? (o?.seller_name ?? "").trim();
    let row = rows.get(key);
    if (!row) {
      row = { key, name, rule: ruleFor(rules, key, sellerLabel(key, names)), received: 0, payout: 0, paid: 0, pending: 0, items: [] };
      rows.set(key, row);
    }
    const amount = Number(x.amount);
    const payout = payoutOf(amount, { value: Number(c.value), base_value: Number(c.base_value) }, row.rule);
    const paid = !!x.seller_payout_id;
    row.received = r2(row.received + amount);
    row.payout = r2(row.payout + payout);
    if (paid) row.paid = r2(row.paid + payout);
    else row.pending = r2(row.pending + payout);
    row.items.push({
      receiptId: x.id,
      receivedAt: x.received_at,
      amount,
      payout,
      paid,
      order: o?.number ?? null,
      invoice: one(c.order_invoices)?.number ?? null,
      customer: o ? one(o.customers)?.name ?? "" : "",
      principal: one(c.principals)?.name ?? "",
    });
  }
  const list = [...rows.values()].sort((a, b) => b.payout - a.payout || b.received - a.received);
  return { rows: list, error: error ?? ruleErr ?? null };
}

/* ---------------------------------------------------------------- Comissões por representada */

export type CommissionByPrincipal = {
  id: string; name: string; expected: number; received: number; open: number; late: number; count: number;
};

// Previsto (vencendo no período), recebido (entrou no período), em aberto e atrasado, por representada.
export async function loadCommissionsByPrincipal(P: Pick<Period, "start" | "end">, today: string) {
  const { supabase } = await getContext();
  type C = { value: number; received_value: number | null; status: string; due_date: string; principal_id: string; principals: { name: string } | null };
  type Rc = { amount: number; commissions: { principal_id: string; principals: { name: string } | null } | null };
  const [{ data: due, error }, { data: rec }] = await Promise.all([
    fetchAll<C>((a, b) =>
      supabase
        .from("commissions")
        .select("value, received_value, status, due_date, principal_id, principals(name)")
        .neq("status", "cancelada")
        .gte("due_date", P.start)
        .lte("due_date", P.end)
        .order("id")
        .range(a, b) as unknown as PromiseLike<{ data: C[] | null; error: unknown }>,
    ),
    fetchAll<Rc>((a, b) =>
      supabase
        .from("commission_receipts")
        .select("amount, commissions!inner(principal_id, principals(name))")
        .gte("received_at", P.start)
        .lte("received_at", P.end)
        .order("id")
        .range(a, b) as unknown as PromiseLike<{ data: Rc[] | null; error: unknown }>,
    ),
  ]);
  const m = new Map<string, CommissionByPrincipal>();
  const get = (id: string, name: string) => {
    let r = m.get(id);
    if (!r) m.set(id, (r = { id, name, expected: 0, received: 0, open: 0, late: 0, count: 0 }));
    return r;
  };
  for (const c of due) {
    const r = get(c.principal_id, one(c.principals)?.name ?? "—");
    const missing = c.status === "a_receber" ? Math.max(Number(c.value) - Number(c.received_value ?? 0), 0) : 0;
    r.expected = r2(r.expected + Number(c.value));
    r.open = r2(r.open + missing);
    if (c.due_date < today) r.late = r2(r.late + missing);
    r.count += 1;
  }
  for (const x of rec) {
    const c = one(x.commissions);
    if (!c) continue;
    const r = get(c.principal_id, one(c.principals)?.name ?? "—");
    r.received = r2(r.received + Number(x.amount));
  }
  return { rows: [...m.values()].sort((a, b) => b.expected - a.expected), error };
}

/* ---------------------------------------------------------------- Vendas */

export type SalesBy = "vendedor" | "cliente" | "representada" | "produto";
export type SalesSort = "valor" | "comissao";
export type SalesRow = {
  key: string; name: string; sub?: string; orders: number; value: number; qty?: number;
  // Só para quem vê comissões, e sem valor em reais: o peso (% do resultado, levando em conta o % de comissão de
  // cada venda) e o % médio ponderado. Ex.: 100 mil a 3% e 100 mil a 5% → pesos de 37,5% e 62,5%.
  weight: number; avgPct: number;
  share: number; cumulative: number; abc: "A" | "B" | "C";
};

// Vendido no período (pedidos enviados ou faturados), agrupado. Curva ABC (A = 80%, B = até 95%) pelo critério da ordem:
// valor vendido ou peso (o resultado: um pedido de 5% pesa mais que um de 3%).
// O peso usa o % de cada pedido, só para quem vê comissões, e nunca mostra valor de comissão.
export async function loadSales(P: Pick<Period, "start" | "end">, by: SalesBy, rep?: string, sort: SalesSort = "valor") {
  const { supabase, orgId, canSeeCommissions } = await getContext();
  const names = by === "vendedor" ? await memberNames(supabase, orgId) : new Map<string, string>();
  const groups = new Map<string, { name: string; sub?: string; orders: Set<string>; value: number; qty: number; commission: number }>();
  const add = (key: string, name: string, orderId: string, value: number, qty = 0, sub?: string, pct = 0) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { name, sub, orders: new Set(), value: 0, qty: 0, commission: 0 }));
    g.orders.add(orderId);
    g.value += value;
    g.qty += qty;
    g.commission += (value * pct) / 100;
  };
  const pctOf = (o: { order_commission_terms?: unknown } | null | undefined) => {
    if (!canSeeCommissions || !o) return 0;
    const t = one(o.order_commission_terms as { commission_pct: number | null } | { commission_pct: number | null }[] | null);
    return Number(t?.commission_pct ?? 0);
  };

  let error: unknown = null;
  if (by === "produto") {
    type I = {
      order_id: string; variant_id: string | null; code: string | null; description: string; qty: number; line_total: number;
      orders: { discount_pct: number; principals: { name: string } | null; order_commission_terms?: unknown } | null;
    };
    const res = await fetchAll<I>((a, b) => {
      let q = supabase
        .from("order_items")
        .select(
          `order_id, variant_id, code, description, qty, line_total, orders!inner(order_date, status, principal_id, discount_pct, principals(name)${
            canSeeCommissions ? ", order_commission_terms(commission_pct)" : ""
          })`,
        )
        .in("orders.status", SOLD_STATUSES)
        .gte("orders.order_date", P.start)
        .lte("orders.order_date", P.end);
      if (rep) q = q.eq("orders.principal_id", rep);
      return q.order("id").range(a, b) as unknown as PromiseLike<{ data: I[] | null; error: unknown }>;
    });
    error = res.error;
    for (const i of res.data) {
      // Produto do catálogo conta uma vez, qualquer que seja a cor ("Malha — Preto" e "Malha — Azul").
      const name = i.variant_id ? i.description.split(" — ")[0] : i.description;
      const key = i.variant_id ? `v:${i.variant_id}` : `d:${(i.code ?? "").toLowerCase()}|${name.toLowerCase()}`;
      const o = one(i.orders);
      // O item conta com o desconto geral do pedido (a comissão é sobre o valor líquido).
      const net = Number(i.line_total) * (1 - Number(o?.discount_pct ?? 0) / 100);
      add(key, name, i.order_id, net, Number(i.qty), [i.code, one(o?.principals)?.name].filter(Boolean).join(" · "), pctOf(o));
    }
  } else {
    type O = {
      id: string; total: number; seller_id: string; seller_name?: string | null; customer_id: string; principal_id: string;
      customers: { name: string; city?: string | null; state?: string | null } | null; principals: { name: string } | null;
      order_commission_terms?: unknown; freight_value: number;
    };
    const res = await fetchAll<O>((a, b) => {
      let q = supabase
        .from("orders")
        .select(
          `id, total, freight_value, seller_id, seller_name, customer_id, principal_id, customers(name, city, state), principals(name)${
            canSeeCommissions ? ", order_commission_terms(commission_pct)" : ""
          }`,
        )
        .in("status", SOLD_STATUSES)
        .gte("order_date", P.start)
        .lte("order_date", P.end);
      if (rep) q = q.eq("principal_id", rep);
      return q.order("id").range(a, b) as unknown as PromiseLike<{ data: O[] | null; error: unknown }>;
    });
    error = res.error;
    for (const o of res.data) {
      const v = Number(o.total);
      // A comissão é sobre o valor dos produtos (sem o frete).
      const pct = pctOf(o);
      const cpct = v ? (pct * Math.max(v - Number(o.freight_value ?? 0), 0)) / v : 0;
      if (by === "vendedor") {
        const key = sellerKey(o);
        add(key, sellerLabel(key, names) ?? (o.seller_name ?? "").trim(), o.id, v, 0, undefined, cpct);
      } else if (by === "cliente") {
        const c = one(o.customers);
        add(o.customer_id, c?.name ?? "Cliente", o.id, v, 0, [c?.city, c?.state].filter(Boolean).join(" / "), cpct);
      } else {
        add(o.principal_id, one(o.principals)?.name ?? "—", o.id, v, 0, undefined, cpct);
      }
    }
  }

  const bySort = sort === "comissao" && canSeeCommissions;
  const metric = (g: { value: number; commission: number }) => (bySort ? g.commission : g.value);
  const total = [...groups.values()].reduce((s, g) => s + g.value, 0);
  const totalCommission = [...groups.values()].reduce((s, g) => s + g.commission, 0);
  const totalMetric = bySort ? totalCommission : total;
  let acc = 0;
  const rows: SalesRow[] = [...groups.entries()]
    .sort((a, b) => metric(b[1]) - metric(a[1]))
    .map(([key, g]) => {
      const share = totalMetric ? metric(g) / totalMetric : 0;
      acc += share;
      const row: SalesRow = {
        key,
        name: g.name,
        sub: g.sub,
        orders: g.orders.size,
        value: r2(g.value),
        qty: by === "produto" ? g.qty : undefined,
        weight: canSeeCommissions && totalCommission ? g.commission / totalCommission : 0,
        avgPct: canSeeCommissions && g.value ? (g.commission / g.value) * 100 : 0,
        share,
        cumulative: acc,
        abc: acc - share < 0.8 ? "A" : acc - share < 0.95 ? "B" : "C",
      };
      return row;
    });
  // % médio ponderado do período (sem valor de comissão).
  const avgPct = canSeeCommissions && total ? (totalCommission / total) * 100 : 0;
  return { rows, total: r2(total), avgPct, showWeight: canSeeCommissions, error };
}
