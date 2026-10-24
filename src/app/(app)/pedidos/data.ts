import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { UNITS } from "@/lib/units";
import { todayISO } from "@/lib/format";
import { optionsText, toOptionList, type OptionList } from "@/lib/options";
import { loadSellers } from "@/lib/sellers";
import type { EditorCustomer, EditorPrincipal, EditorProduct, EditorUnit, PriceHistory } from "./editor";

type HistoryRow = {
  variant_id: string;
  list_price: number;
  options?: Record<string, string> | null;
  orders: { customer_id: string };
};
type LinkRow = { product_id: string; position: number; option_lists: Parameters<typeof toOptionList>[0] | null };
type TableRow = { price_items: { variant_id: string; price: number }[] | null };

// Tudo o que o editor de pedido precisa para funcionar sem ir ao servidor a cada tecla.
export async function loadEditorData() {
  const { supabase, orgId, canManage } = await getContext();
  const settings = await getSettings();
  const today = todayISO();

  // Preços que cada cliente pagou em cada produto (os pedidos mais recentes primeiro).
  const history = async () => {
    const q = (cols: string) =>
      supabase
        .from("order_items")
        .select(cols)
        .not("variant_id", "is", null)
        .neq("orders.status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(5000);
    const withOptions = await q("variant_id, list_price, options, orders!inner(customer_id, status)");
    // Sem a migração 022 (coluna options), busca sem ela.
    return withOptions.error ? q("variant_id, list_price, orders!inner(customer_id, status)") : withOptions;
  };

  const [
    { data: customers },
    { data: principals },
    { data: variants },
    { data: recent },
    { data: lastOrders },
    { data: optionLinks },
    { data: hiddenRows },
    { data: tables },
    { data: allLists },
  ] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("principals").select("id, name, default_commission_pct").eq("active", true).order("name"),
    supabase
      .from("product_variants")
      .select("id, code, attributes, product_id, products!inner(name, unit, principal_id, active)")
      .eq("active", true)
      .eq("products.active", true)
      .limit(5000),
    history(),
    // Última representada de cada cliente: é a sugerida no novo pedido.
    supabase
      .from("orders")
      .select("customer_id, principal_id")
      .neq("status", "cancelado")
      .order("order_date", { ascending: false })
      .order("number", { ascending: false })
      .limit(20000),
    // Listas de opções de cada produto (migração 022; sem ela, vem vazio).
    supabase
      .from("product_option_lists")
      .select("product_id, position, option_lists(id, kind, name, option_values(id, name, code, position, price_adjust, adjust_type, active))"),
    supabase.from("product_option_hidden").select("product_id, value_id"),
    // Tabelas de preço vigentes, só quando o escritório usa tabelas (a mais nova vence).
    settings.usePriceTables
      ? supabase
          .from("price_tables")
          .select("price_items(variant_id, price)")
          .lte("valid_from", today)
          .or(`valid_to.is.null,valid_to.gte.${today}`)
          .order("valid_from", { ascending: true })
      : Promise.resolve({ data: [] as TableRow[] }),
    // Todas as listas, por representada: no pedido, qualquer produto dela pode usar.
    supabase
      .from("option_lists")
      .select("id, kind, name, principal_id, option_values(id, name, code, position, price_adjust, adjust_type, active)")
      .order("kind")
      .order("name"),
  ]);
  const lastPrincipal = new Map<string, string>();
  for (const o of lastOrders ?? []) if (!lastPrincipal.has(o.customer_id)) lastPrincipal.set(o.customer_id, o.principal_id);

  // Cliente → produto → [opções, preço], do mais recente para o mais antigo.
  const priceHistory: PriceHistory = {};
  for (const r of (recent ?? []) as unknown as HistoryRow[]) {
    const byCustomer = (priceHistory[r.orders.customer_id] ??= {});
    const list = (byCustomer[r.variant_id] ??= []);
    if (list.length < 40) list.push([optionsText(r.options), Number(r.list_price)]);
  }

  const tablePrice = new Map<string, number>();
  for (const t of (tables ?? []) as TableRow[]) {
    for (const i of t.price_items ?? []) tablePrice.set(i.variant_id, Number(i.price));
  }

  // Listas de opções por produto, na ordem escolhida, sem as opções escondidas no produto.
  const hidden = new Map<string, Set<string>>();
  for (const h of hiddenRows ?? []) {
    if (!hidden.has(h.product_id)) hidden.set(h.product_id, new Set());
    hidden.get(h.product_id)!.add(h.value_id);
  }
  const listsOf = new Map<string, { position: number; list: OptionList }[]>();
  for (const l of (optionLinks ?? []) as unknown as LinkRow[]) {
    if (!l.option_lists) continue;
    const list = toOptionList(l.option_lists, hidden.get(l.product_id));
    if (!list.values.length) continue;
    if (!listsOf.has(l.product_id)) listsOf.set(l.product_id, []);
    listsOf.get(l.product_id)!.push({ position: l.position, list });
  }

  const principalLists: Record<string, OptionList[]> = {};
  for (const l of (allLists ?? []) as unknown as (Parameters<typeof toOptionList>[0] & { principal_id: string | null })[]) {
    if (!l.principal_id) continue;
    const list = toOptionList(l);
    if (list.values.length) (principalLists[l.principal_id] ??= []).push(list);
  }

  const products: EditorProduct[] = (variants ?? []).map((v) => {
    const p = v.products as unknown as { name: string; unit: string; principal_id: string };
    const extra = Object.values((v.attributes ?? {}) as Record<string, string>).filter(Boolean).join(", ");
    return {
      id: v.id,
      principal_id: p.principal_id,
      code: v.code,
      name: extra ? `${p.name} — ${extra}` : p.name,
      unit: p.unit,
      tablePrice: tablePrice.get(v.id) ?? null,
      lists: (listsOf.get(v.product_id) ?? []).sort((a, b) => a.position - b.position).map((x) => x.list),
    };
  });
  products.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  // select("*") funciona com ou sem as migrações 006/007 (colunas novas opcionais).
  type C = { id: string; name: string; city?: string | null; state?: string | null; cnpj: string | null; seller_id: string | null };
  const editorCustomers: EditorCustomer[] = ((customers ?? []) as C[]).map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city ?? null,
    state: c.state ?? null,
    cnpj: c.cnpj,
    last_principal_id: lastPrincipal.get(c.id) ?? null,
    seller_id: c.seller_id,
  }));

  const editorPrincipals: EditorPrincipal[] = (principals ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    commission: p.default_commission_pct == null ? null : Number(p.default_commission_pct),
  }));

  const units: EditorUnit[] = UNITS.filter((u) => settings.units.includes(u.value));
  const defaultUnit = settings.units.includes("unidade") ? "unidade" : settings.units[0] ?? "unidade";

  // Administrador e gerente escolhem o vendedor do pedido; o vendedor lança sempre no nome dele.
  const sellers = canManage ? await loadSellers(supabase, orgId) : [];

  return { sellers, customers: editorCustomers, principals: editorPrincipals, products, priceHistory, principalLists, units, defaultUnit, settings };
}
