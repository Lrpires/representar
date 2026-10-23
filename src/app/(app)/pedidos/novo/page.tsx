import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { todayISO } from "@/lib/format";
import { numText } from "@/lib/orders";
import { loadEditorData } from "../data";
import { OrderEditor } from "../editor";
import { EmptyState, PageHeader, primaryBtn } from "@/components/ui";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const sp = await searchParams;
  const { role, canSeeCommissions } = await getContext();
  if (role === "finance") redirect("/pedidos");

  const data = await loadEditorData();
  const customer = data.customers.find((c) => c.id === sp.cliente);
  const principalId = customer?.last_principal_id ?? (data.principals.length === 1 ? data.principals[0].id : "");
  const principal = data.principals.find((p) => p.id === principalId);

  const missing = data.principals.length === 0 ? "representada" : data.customers.length === 0 ? "cliente" : null;

  return (
    <>
      <PageHeader back={{ href: "/pedidos", label: "Pedidos" }} title="Novo pedido" />
      {missing ? (
        <EmptyState
          icon="receipt"
          title={missing === "representada" ? "Cadastre sua primeira representada para começar" : "Cadastre um cliente para fazer o pedido"}
          action={
            <Link href={missing === "representada" ? "/representadas?novo=1" : "/clientes?novo=1"} className={primaryBtn}>
              {missing === "representada" ? "Nova representada" : "Novo cliente"}
            </Link>
          }
        >
          Todo pedido tem um cliente e uma representada.
        </EmptyState>
      ) : (
        <OrderEditor
          showCommission={canSeeCommissions}
          initial={{
            customer_id: customer?.id ?? "",
            principal_id: principalId,
            order_date: todayISO(),
            expected_delivery: "",
            payment_terms: "",
            freight_mode: "",
            freight_value: "",
            discount_pct: "",
            commission_pct: principal?.commission != null ? numText(principal.commission, 2) : "",
            notes: "",
            items: [],
          }}
          customers={data.customers}
          principals={data.principals}
          products={data.products}
          priceHistory={data.priceHistory}
          units={data.units}
          defaultUnit={data.defaultUnit}
        />
      )}
    </>
  );
}
