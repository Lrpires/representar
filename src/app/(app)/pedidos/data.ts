import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { UNITS } from "@/lib/units";
import type { EditorCustomer, EditorPrincipal, EditorProduct, EditorUnit } from "./editor";

// Tudo o que o editor de pedido precisa para funcionar sem ir ao servidor a cada tecla.
export async function loadEditorData() {
  const { supabase } = await getContext();
  const settings = await getSettings();

  const [{ data: customers }, { data: principals }, { data: variants }, { data: recent }] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("principals").select("id, name, default_commission_pct").eq("active", true).order("name"),
    supabase
      .from("product_variants")
      .select("id, code, attributes, products!inner(name, unit, principal_id, active)")
      .eq("active", true)
      .eq("products.active", true)
      .limit(5000),
    // Último preço praticado de cada produto (os pedidos mais recentes primeiro).
    supabase
      .from("order_items")
      .select("variant_id, list_price, created_at")
      .not("variant_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(3000),
  ]);

  const lastPrice = new Map<string, number>();
  for (const r of recent ?? []) {
    if (r.variant_id && !lastPrice.has(r.variant_id)) lastPrice.set(r.variant_id, Number(r.list_price));
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
      lastPrice: lastPrice.get(v.id) ?? null,
    };
  });
  products.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  // select("*") funciona com ou sem as migrações 006/007 (colunas novas opcionais).
  type C = { id: string; name: string; city?: string | null; state?: string | null; cnpj: string | null; principal_id?: string | null };
  const editorCustomers: EditorCustomer[] = ((customers ?? []) as C[]).map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city ?? null,
    state: c.state ?? null,
    cnpj: c.cnpj,
    principal_id: c.principal_id ?? null,
  }));

  const editorPrincipals: EditorPrincipal[] = (principals ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    commission: p.default_commission_pct == null ? null : Number(p.default_commission_pct),
  }));

  const units: EditorUnit[] = UNITS.filter((u) => settings.units.includes(u.value));
  const defaultUnit = settings.units.includes("unidade") ? "unidade" : settings.units[0] ?? "unidade";

  return { customers: editorCustomers, principals: editorPrincipals, products, units, defaultUnit, settings };
}
