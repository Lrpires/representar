import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { MAIN_STATUSES, formatOrderNumber, statusInfo } from "@/lib/orders";
import { orderAging, AGING_STYLE } from "@/lib/aging";
import { brl, formatDate, safeQ, todayISO } from "@/lib/format";
import { SearchBox } from "@/components/search";
import { UrlSelect } from "@/components/url-select";
import { Icon } from "@/components/icons";
import {
  PageHeader, Toolbar, EmptyState, Badge, NewButton, TableShell, CardList, RowLink, OkNote,
  FilterPill, Segmented, primaryBtn, th, td, tr,
} from "@/components/ui";

const PATH = "/pedidos";

const PERIODS = [
  { value: "mes", label: "Este mês" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "ano", label: "Este ano" },
];

function periodStart(p: string | undefined): string | null {
  const today = todayISO();
  if (p === "mes") return `${today.slice(0, 7)}-01`;
  if (p === "ano") return `${today.slice(0, 4)}-01-01`;
  if (p === "30d") {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; novo?: string; q?: string; status?: string; rep?: string; periodo?: string; cliente?: string }>;
}) {
  const sp = await searchParams;
  // Links antigos (?novo=1) vão para a tela cheia de novo pedido.
  if (sp.novo === "1") redirect(`${PATH}/novo${sp.cliente ? `?cliente=${sp.cliente}` : ""}`);

  const q = safeQ(sp.q).toLowerCase();
  const { supabase, role, isBackOffice } = await getContext();
  const settings = await getSettings();
  const canCreate = role !== "finance";

  let query = supabase
    .from("orders")
    .select("id, number, status, order_date, sent_at, total, seller_id, principal_id, customers(name), principals(name)")
    .order("number", { ascending: false })
    .limit(500);
  if (sp.rep) query = query.eq("principal_id", sp.rep);
  const start = periodStart(sp.periodo);
  if (start) query = query.gte("order_date", start);

  const [{ data: ordersData, error }, { data: principals }, { data: members }, { count: nCustomers }] = await Promise.all([
    query,
    supabase.from("principals").select("id, name").order("name"),
    isBackOffice
      ? supabase.from("members").select("user_id, full_name, email")
      : Promise.resolve({ data: [] as { user_id: string; full_name: string | null; email: string | null }[] }),
    supabase.from("customers").select("id", { count: "exact", head: true }),
  ]);

  const sellerName = new Map((members ?? []).map((m) => [m.user_id, m.full_name || m.email || "—"] as const));

  const all = (ordersData ?? []).map((o) => {
    return {
      id: o.id as string,
      number: o.number as number,
      label: formatOrderNumber(o.number, settings),
      status: o.status as string,
      order_date: o.order_date as string,
      aging: orderAging({ status: o.status, sent_at: o.sent_at, order_date: o.order_date }, settings.warnDays, settings.criticalDays, todayISO()),
      total: Number(o.total),
      seller_id: o.seller_id as string,
      customer: (o.customers as unknown as { name: string } | null)?.name ?? "",
      principal: (o.principals as unknown as { name: string } | null)?.name ?? "",
    };
  });

  const searched = q
    ? all.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          String(o.number) === q.replace(/\D/g, "") ||
          o.customer.toLowerCase().includes(q) ||
          o.principal.toLowerCase().includes(q),
      )
    : all;
  const isLate = (o: { aging: ReturnType<typeof orderAging> }) => !!o.aging && o.aging.level !== "ok";
  const orders =
    sp.status === "atraso"
      ? searched.filter(isLate).sort((a, b) => (b.aging?.days ?? 0) - (a.aging?.days ?? 0))
      : sp.status
        ? searched.filter((o) => o.status === sp.status || (sp.status === "faturado" && o.status === "entregue"))
        : searched;
  const lateList = searched.filter(isLate);
  const criticalCount = lateList.filter((o) => o.aging?.level === "critico").length;
  const countOf = (s: string) => searched.filter((o) => o.status === s || (s === "faturado" && o.status === "entregue")).length;

  // Indicadores do recorte atual (sem rascunhos e cancelados no que foi vendido).
  const sold = searched.filter((o) => o.status !== "rascunho" && o.status !== "cancelado");
  const soldTotal = sold.reduce((s, o) => s + o.total, 0);
  const toInvoiceTotal = searched.filter((o) => o.status === "enviado").reduce((s, o) => s + o.total, 0);
  const drafts = searched.filter((o) => o.status === "rascunho");
  const toInvoice = searched.filter((o) => o.status === "enviado" || o.status === "parcial");

  const listTotal = orders.reduce((s, o) => s + o.total, 0);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, rep: sp.rep, periodo: sp.periodo, status: sp.status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${PATH}?${s}` : PATH;
  };

  const noBase = (principals ?? []).length === 0 || !nCustomers;
  const filtering = !!q || !!sp.status || !!sp.rep || !!sp.periodo;

  return (
    <>
      <PageHeader
        title="Pedidos"
        hint="Do rascunho ao faturamento, com a situação de cada venda."
        action={canCreate && !noBase ? <NewButton label="Novo pedido" href={`${PATH}/novo`} fab /> : null}
      />

      {sp.ok ? (
        <div className="mb-4">
          <OkNote message={sp.ok} />
        </div>
      ) : null}

      {error ? (
        <EmptyState icon="alert" title="Não foi possível carregar os pedidos">
          Confira se as migrações do banco (até a 008) foram rodadas no Supabase.
        </EmptyState>
      ) : noBase ? (
        <EmptyState
          icon="receipt"
          title={(principals ?? []).length === 0 ? "Cadastre sua primeira representada para começar" : "Cadastre um cliente para fazer pedidos"}
          action={
            <Link href={(principals ?? []).length === 0 ? "/representadas?novo=1" : "/clientes?novo=1"} className={primaryBtn}>
              {(principals ?? []).length === 0 ? "Nova representada" : "Novo cliente"}
            </Link>
          }
        >
          Todo pedido tem um cliente e uma representada.
        </EmptyState>
      ) : all.length === 0 && !filtering ? (
        <EmptyState
          icon="receipt"
          title="Nenhum pedido ainda"
          action={canCreate ? <NewButton label="Fazer o primeiro pedido" href={`${PATH}/novo`} /> : null}
        >
          Escolha o cliente e a representada, lance os itens e pronto: o total é calculado na hora.
        </EmptyState>
      ) : (
        <>
          {/* Indicadores */}
          <dl className="mb-5 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4 [&>div]:bg-surface" style={{ gap: 1 }}>
            <Kpi label="Vendido" value={brl(soldTotal)} sub={`${sold.length} ${sold.length === 1 ? "pedido" : "pedidos"}`} />
            <Kpi label="Aguardando faturamento" value={brl(toInvoiceTotal)} sub="Pedidos enviados sem nota" />
            <Kpi label="Ticket médio" value={brl(sold.length ? soldTotal / sold.length : 0)} sub="Por pedido vendido" />
            <Kpi
              label="Em atraso"
              value={`${lateList.length}`}
              sub={
                lateList.length
                  ? `${criticalCount} crítico${criticalCount === 1 ? "" : "s"} · ${lateList.length - criticalCount} em atenção`
                  : `${drafts.length} rascunho${drafts.length === 1 ? "" : "s"} · ${toInvoice.length} a faturar`
              }
              tone={criticalCount ? "alert" : lateList.length ? "warn" : undefined}
            />
          </dl>

          <div className="mb-3">
            <Segmented>
              {lateList.length ? (
                <FilterPill href={qs({ status: "atraso" })} active={sp.status === "atraso"} count={lateList.length}>
                  <span className={`h-1.5 w-1.5 rounded-full ${criticalCount ? "bg-alert" : "bg-warn-dot"}`} />
                  Em atraso
                </FilterPill>
              ) : null}
              <FilterPill href={qs({ status: undefined })} active={!sp.status} count={searched.length}>
                Todos
              </FilterPill>
              {MAIN_STATUSES.map((s) => (
                <FilterPill key={s.value} href={qs({ status: s.value })} active={sp.status === s.value} count={countOf(s.value)}>
                  {s.label}
                </FilterPill>
              ))}
            </Segmented>
          </div>

          <Toolbar>
            <SearchBox placeholder="Buscar nº, cliente ou representada" hint />
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              <UrlSelect
                param="rep"
                ariaLabel="Filtrar por representada"
                allLabel="Todas as representadas"
                options={(principals ?? []).map((p) => ({ value: p.id, label: p.name }))}
              />
              <UrlSelect param="periodo" ariaLabel="Período" allLabel="Todo o período" options={PERIODS} />
            </div>
          </Toolbar>

          {orders.length === 0 ? (
            <EmptyState icon="search" title="Nenhum pedido nesse filtro" compact>
              Troque o status, a representada ou o período.
            </EmptyState>
          ) : (
            <>
              <TableShell>
                <thead>
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
                <tbody>
                  {orders.map((o) => {
                    const st = statusInfo(o.status);
                    return (
                      <tr key={o.id} className={tr}>
                        <td className={`${td} whitespace-nowrap`}>
                          <RowLink href={`${PATH}/${o.id}`} className="font-mono text-[13px] font-medium text-ink">
                            {o.label}
                          </RowLink>
                        </td>
                        <td className={`${td} max-w-[16rem] truncate font-medium`}>{o.customer}</td>
                        <td className={`${td} text-ink-2`}>{o.principal}</td>
                        {isBackOffice ? <td className={`${td} text-ink-2`}>{sellerName.get(o.seller_id) ?? "—"}</td> : null}
                        <td className={`${td} whitespace-nowrap tabular-nums text-ink-2`}>{formatDate(o.order_date)}</td>
                        <td className={td}>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={st.tone} dot>
                              {st.label}
                            </Badge>
                            <AgingChip aging={o.aging} />
                          </span>
                        </td>
                        <td className={`${td} text-right font-medium tabular-nums ${o.status === "cancelado" ? "text-faint line-through" : ""}`}>
                          {brl(o.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-line bg-subtle text-[13px]">
                  <tr>
                    <td className="px-5 py-2.5 text-muted" colSpan={isBackOffice ? 6 : 5}>
                      {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} na lista
                    </td>
                    <td className="py-2.5 pl-4 pr-5 text-right font-semibold tabular-nums">{brl(listTotal)}</td>
                  </tr>
                </tfoot>
              </TableShell>

              <CardList>
                {orders.map((o) => {
                  const st = statusInfo(o.status);
                  return (
                    <li key={o.id}>
                      <Link href={`${PATH}/${o.id}`} className="block px-4 py-3 active:bg-hover">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs text-muted">{o.label}</span>
                          <span className="flex items-center gap-1.5">
                            <AgingChip aging={o.aging} />
                            <Badge tone={st.tone} dot>
                              {st.label}
                            </Badge>
                          </span>
                        </div>
                        <div className="mt-1 flex items-end justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-medium">{o.customer}</p>
                            <p className="truncate text-[13px] text-muted">
                              {o.principal} · {formatDate(o.order_date)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`font-semibold tabular-nums ${o.status === "cancelado" ? "text-faint line-through" : ""}`}>{brl(o.total)}</p>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
                <li className="flex justify-between bg-subtle px-4 py-3 text-[13px]">
                  <span className="text-muted">{orders.length} pedidos</span>
                  <span className="font-semibold tabular-nums">{brl(listTotal)}</span>
                </li>
              </CardList>
            </>
          )}
        </>
      )}
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "ok" | "warn" | "alert" }) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <dt className="flex items-center gap-1.5 truncate text-[13px] text-muted">
        {tone ? <span className={`h-1.5 w-1.5 rounded-full ${tone === "ok" ? "bg-ok" : tone === "alert" ? "bg-alert" : "bg-warn-dot"}`} /> : null}
        {label}
      </dt>
      <dd className={`mt-1.5 truncate text-lg font-semibold tabular-nums tracking-[-0.02em] sm:text-xl ${tone === "ok" ? "text-ok" : tone === "alert" ? "text-alert" : "text-ink"}`}>
        {value}
      </dd>
      <dd className="mt-0.5 truncate text-xs text-muted">{sub}</dd>
    </div>
  );
}

// Selo de atraso: só aparece em amarelo (atenção) ou vermelho (crítico).
function AgingChip({ aging }: { aging: ReturnType<typeof orderAging> }) {
  if (!aging || aging.level === "ok") return null;
  const st = AGING_STYLE[aging.level];
  return (
    <span className={`inline-flex h-[1.375rem] items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs font-medium ${st.badge}`} title={`${st.label}: ${aging.days} dias sem faturar`}>
      <Icon name="clock" size={12} />
      {aging.days}d
    </span>
  );
}
