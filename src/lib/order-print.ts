// Dados do pedido para impressão e PDF (as duas saídas mostram exatamente a mesma coisa).
import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatOrderNumber, statusInfo } from "@/lib/orders";
import { logoUrl } from "@/lib/storage";

type Row = Record<string, string | null>;

export type PrintableOrder = NonNullable<Awaited<ReturnType<typeof loadPrintableOrder>>>;

export async function loadPrintableOrder(id: string) {
  const { supabase } = await getContext();
  const settings = await getSettings();

  const { data: o } = await supabase.from("orders").select("*, customers(*), principals(*)").eq("id", id).maybeSingle();
  if (!o) return null;

  const [{ data: items }, { data: seller }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).order("position"),
    supabase.from("members").select("full_name, email").eq("user_id", o.seller_id).eq("org_id", o.org_id).maybeSingle(),
  ]);

  const c = (o.customers ?? {}) as Row;
  const p = (o.principals ?? {}) as Row;
  const subtotal = Number(o.subtotal);
  const address =
    [
      [c.street, c.street_number].filter(Boolean).join(", "),
      c.complement,
      c.district,
      [c.city, c.state].filter(Boolean).join(" / "),
      c.zip ? `CEP ${c.zip}` : null,
    ]
      .filter(Boolean)
      .join(" · ") ||
    c.address ||
    "";

  return {
    settings,
    label: formatOrderNumber(o.number, settings),
    status: statusInfo(o.status).label,
    orderDate: o.order_date as string,
    sellerName: (seller?.full_name || seller?.email || "") as string,
    customer: {
      name: c.name ?? "",
      cnpj: c.cnpj,
      address,
      contact: [c.contact_name, c.phone].filter(Boolean).join(" · "),
      logo: logoUrl(c.logo_path),
    },
    principal: {
      name: p.name ?? "",
      legalName: p.legal_name,
      cnpj: p.cnpj,
      orderEmail: p.order_email,
      logo: logoUrl(p.logo_path),
    },
    paymentTerms: o.payment_terms as string | null,
    expectedDelivery: o.expected_delivery as string | null,
    freightMode: o.freight_mode ? String(o.freight_mode).toUpperCase() : null,
    items: (items ?? []).map((i) => ({
      id: i.id as string,
      code: (i.code ?? "") as string,
      description: i.description as string,
      unit: i.unit as string,
      qty: Number(i.qty),
      listPrice: Number(i.list_price),
      discountPct: Number(i.discount_pct),
      total: Number(i.line_total),
    })),
    subtotal,
    discountPct: Number(o.discount_pct),
    discountValue: Math.round(subtotal * Number(o.discount_pct)) / 100,
    freightValue: Number(o.freight_value),
    total: Number(o.total),
    notes: o.notes as string | null,
  };
}

// Nome do arquivo: "Pedido-AUR-12-Confeccoes-Serra-Azul.pdf" (sem acentos nem símbolos).
export function orderFileName(order: Pick<PrintableOrder, "label" | "customer">) {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const customer = clean(order.customer.name).split("-").slice(0, 4).join("-");
  return `Pedido-${clean(order.label)}${customer ? `-${customer}` : ""}.pdf`;
}
