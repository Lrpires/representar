import Link from "next/link";
import { getContext } from "@/lib/session";
import { createOrder } from "./actions";
import { STATUS_LIST, statusInfo } from "@/lib/orders";
import { brl, formatDate, safeQ, todayISO } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { SearchBox } from "@/components/search";
import {
  PageHeader, Toolbar, Field, ErrorNote, EmptyState, Badge, SheetForm, NewButton, TableShell,
  CardList, inputCls, primaryBtn, th, td,
} from "@/components/ui";

const PATH = "/pedidos";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; novo?: string; q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = safeQ(sp.q).toLowerCase();
  const { supabase, role, isBackOffice } = await getContext();
  const canCreate = role !== "finance";

  let query = supabase
    .from("orders")
    .select("id, number, status, order_date, total, seller_id, customers(name), principals(name)")
    .order("number", { ascending: false })
    .limit(300);
  if (sp.status && STATUS_LIST.some((s) => s.value === sp.status)) query = query.eq("status", sp.status);

  const [{ data: ordersData }, { data: principals }, { data: customers }, { data: members }] =
    await Promise.all([
      query,
      supabase.from("principals").select("id, name").eq("active", true).order("name"),
      supabase.from("customers").select("id, name").order("name"),
      isBackOffice
        ? supabase.from("members").select("user_id, full_name, email")
        : Promise.resolve({ data: [] as { user_id: string; full_name: string | null; email: string | null }[] }),
    ]);

  const sellerName = new Map(
    (members ?? []).map((m) => [m.user_id, m.full_name || m.email || "—"] as const),
  );

  type Row = {
    id: string; number: number; status: string; order_date: string; total: number; seller_id: string;
    customer: string; principal: string;
  };
  let orders: Row[] = (ordersData ?? []).map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    order_date: o.order_date,
    total: Number(o.total),
    seller_id: o.seller_id,
    customer: (o.customers as unknown as { name: string } | null)?.name ?? "",
    principal: (o.principals as unknown as { name: string } | null)?.name ?? "",
  }));
  if (q) {
    orders = orders.filter(
      (o) =>
        String(o.number) === q.replace("#", "") ||
        o.customer.toLowerCase().includes(q) ||
        o.principal.toLowerCase().includes(q),
    );
  }

  const noBase = (principals ?? []).length === 0 || (customers ?? []).length === 0;
  const sheetOpen = canCreate && !noBase && (sp.novo === "1" || !!sp.erro);
  const filtering = !!q || !!sp.status;

  const chip = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[13px] transition ${
      active ? "bg-ink font-medium text-white" : "border border-line bg-white text-ink-2 hover:bg-subtle"
    }`;
  const withQ = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <>
      <PageHeader
        title="Pedidos"
        hint="Monte o pedido com a tabela de preço certa e acompanhe até a entrega."
        action={canCreate && !noBase ? <NewButton label="Novo pedido" /> : null}
      />

      {noBase ? (
        <EmptyState
          icon="file"
          title="Falta cadastrar a base"
          action={
            <Link href={(principals ?? []).length === 0 ? "/representadas" : "/clientes"} className={primaryBtn}>
              {(principals ?? []).length === 0 ? "Ir para representadas" : "Ir para clientes"}
            </Link>
          }
        >
          Para fazer um pedido você precisa de ao menos uma representada, uma tabela de preço e um
          cliente.
        </EmptyState>
      ) : orders.length === 0 && !filtering ? (
        <EmptyState icon="file" title="Nenhum pedido ainda" action={canCreate ? <NewButton label="Novo pedido" /> : null}>
          O pedido nasce como rascunho. Quando estiver certo, você marca como enviado.
        </EmptyState>
      ) : (
        <>
          <Toolbar>
            <div className="lg:hidden"><SearchBox placeholder="Buscar pedido" /></div>
            <span className="ml-auto hidden text-sm tabular-nums text-muted sm:block">
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
            </span>
          </Toolbar>

          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
            <Link href={q ? `${PATH}?q=${encodeURIComponent(q)}` : PATH} className={chip(!sp.status)}>Todos</Link>
            {STATUS_LIST.map((s) => (
              <Link key={s.value} href={`${PATH}?status=${s.value}${withQ}`} className={chip(sp.status === s.value)}>
                {s.label}
              </Link>
            ))}
          </div>

          {orders.length === 0 ? (
            <EmptyState icon="search" title="Nada encontrado">Nenhum pedido combina com os filtros.</EmptyState>
          ) : (
            <>
              <TableShell>
                <thead className="border-b border-line bg-subtle">
                  <tr>
                    <th className={th}>Pedido</th>
                    <th className={th}>Cliente</th>
                    <th className={th}>Representada</th>
                    {isBackOffice ? <th className={th}>Vendedor</th> : null}
                    <th className={th}>Data</th>
                    <th className={th}>Status</th>
                    <th className={`${th} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {orders.map((o) => {
                    const st = statusInfo(o.status);
                    return (
                      <tr key={o.id} className="transition hover:bg-subtle">
                        <td className={`${td} font-mono text-[13px]`}>
                          <Link href={`${PATH}/${o.id}`} className="font-medium hover:underline">#{o.number}</Link>
                        </td>
                        <td className={`${td} font-medium`}>{o.customer}</td>
                        <td className={`${td} text-ink-2`}>{o.principal}</td>
                        {isBackOffice ? <td className={`${td} text-ink-2`}>{sellerName.get(o.seller_id) ?? "—"}</td> : null}
                        <td className={`${td} text-ink-2`}>{formatDate(o.order_date)}</td>
                        <td className={td}><Badge tone={st.tone}>{st.label}</Badge></td>
                        <td className={`${td} text-right tabular-nums`}>{brl(o.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>

              <CardList>
                {orders.map((o) => {
                  const st = statusInfo(o.status);
                  return (
                    <li key={o.id}>
                      <Link href={`${PATH}/${o.id}`} className="flex items-start justify-between gap-3 px-4 py-3.5">
                        <div className="min-w-0">
                          <p className="font-medium leading-snug">
                            <span className="font-mono text-[13px] text-muted">#{o.number}</span> {o.customer}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            {o.principal} · {formatDate(o.order_date)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium tabular-nums">{brl(o.total)}</p>
                          <div className="mt-1"><Badge tone={st.tone}>{st.label}</Badge></div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </CardList>
            </>
          )}
        </>
      )}

      <Sheet open={sheetOpen} title="Novo pedido" description="Escolha a fábrica e o cliente. Os itens você lança na próxima tela." closeHref={PATH}>
        <SheetForm action={createOrder} closeHref={PATH} submitLabel="Criar pedido">
          <div className="sm:col-span-2"><ErrorNote message={sp.erro} /></div>
          <div className="sm:col-span-2">
            <Field label="Representada">
              <select name="principal_id" required className={inputCls} defaultValue="">
                <option value="" disabled>Escolha</option>
                {(principals ?? []).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Cliente">
              <select name="customer_id" required className={inputCls} defaultValue="">
                <option value="" disabled>Escolha</option>
                {(customers ?? []).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </Field>
          </div>
          <Field label="Data do pedido">
            <input name="order_date" type="date" defaultValue={todayISO()} className={inputCls} />
          </Field>
        </SheetForm>
      </Sheet>
    </>
  );
}
