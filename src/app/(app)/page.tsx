import { numberText } from "@/lib/number-format";
import Link from "next/link";
import { getContext } from "@/lib/session";
import { getCounts } from "@/lib/counts";
import { getSettings } from "@/lib/settings";
import { getProfile } from "@/lib/profile";
import { formatOrderNumber, statusInfo, SOLD_STATUSES, OPEN_STATUSES } from "@/lib/orders";
import { orderAging, AGING_STYLE } from "@/lib/aging";
import { stageLabel } from "@/lib/leads";
import { brl, formatDate, todayISO } from "@/lib/format";
import { resolvePeriod, buildSeries, delta, rank, addDays, fetchAll } from "@/lib/cockpit";
import { unitShort } from "@/lib/units";
import { goalProgress, goalScope, type GoalRow } from "@/lib/goals";
import { loadGoals } from "@/lib/goals-data";
import { CockpitShell } from "@/components/cockpit/filters";
import { SalesChart } from "@/components/cockpit/sales-chart";
import { Kpi, RankList } from "@/components/cockpit/parts";
import { Icon } from "@/components/icons";
import { WhatsAppButton } from "@/components/whatsapp";
import { Badge, EmptyState, NewButton, PageHeader, primaryBtn } from "@/components/ui";
import { GoalCard } from "./metas/card";

const SOLD = SOLD_STATUSES;

function greeting(): string {
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

type Order = {
  id: string; number: number; status: string; order_date: string; total: number;
  principal_id: string; seller_id: string; customer_id: string;
  customers: { name: string } | null; principals: { name: string } | null;
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; rep?: string; vend?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, canManage, role, isBackOffice, user } = await getContext();
  const [counts, settings, profile] = await Promise.all([getCounts(), getSettings(), getProfile()]);
  const today = todayISO();
  const P = resolvePeriod(sp.periodo, sp.de, sp.ate, today);
  const rep = sp.rep || null;
  // Vendedor só enxerga o que é dele: pedidos, clientes e a própria meta.
  const isSeller = role === "seller";
  const vend = isBackOffice ? sp.vend || null : isSeller ? user.id : null;
  const canOrder = role !== "finance";

  if (counts.representadas === 0) {
    return (
      <>
        <PageHeader title={`${greeting()}, ${profile.firstName}`} />
        <EmptyState
          icon="factory"
          title="Cadastre sua primeira representada para começar"
          action={canManage ? <Link href="/representadas?novo=1" className={primaryBtn}>Nova representada</Link> : null}
        >
          Informe as empresas que você representa. Depois é só cadastrar os clientes e fazer o primeiro pedido.
        </EmptyState>
      </>
    );
  }

  // Aplica os filtros de representada e vendedor numa consulta.
  function scoped<T>(q: T, prefix = ""): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let r = q as any;
    if (rep) r = r.eq(`${prefix}principal_id`, rep);
    if (vend) r = r.eq(`${prefix}seller_id`, vend);
    return r as T;
  }

  const [
    { data: curData },
    { data: prevData },
    { data: invCur },
    { data: invPrev },
    { data: items },
    { data: history },
    { data: principals },
    { data: members },
    { data: payables },
    { data: leadsDue },
    { data: customersDue },
    goalData,
    { data: openData },
  ] = await Promise.all([
    fetchAll((a, b) =>
      scoped(
        supabase
          .from("orders")
          .select("id, number, status, order_date, total, principal_id, seller_id, customer_id, customers(name), principals(name)")
          .gte("order_date", P.start)
          .lte("order_date", P.end),
      )
        .order("number", { ascending: false })
        .range(a, b),
    ),
    fetchAll((a, b) =>
      scoped(supabase.from("orders").select("order_date, total, customer_id").in("status", SOLD).gte("order_date", P.prevStart).lte("order_date", P.prevEnd))
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      scoped(
        supabase.from("order_invoices").select("value, issued_at, orders!inner(principal_id, seller_id, status)").neq("orders.status", "cancelado").gte("issued_at", P.start).lte("issued_at", P.end),
        "orders.",
      )
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      scoped(
        supabase.from("order_invoices").select("value, orders!inner(principal_id, seller_id, status)").neq("orders.status", "cancelado").gte("issued_at", P.prevStart).lte("issued_at", P.prevEnd),
        "orders.",
      )
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      scoped(
        supabase
          .from("order_items")
          .select("description, code, unit, qty, line_total, orders!inner(order_date, status, principal_id, seller_id)")
          .in("orders.status", SOLD)
          .gte("orders.order_date", P.start)
          .lte("orders.order_date", P.end),
        "orders.",
      )
        .order("id")
        .range(a, b),
    ),
    // Últimos 12 meses: base para clientes novos e clientes para reativar.
    fetchAll((a, b) =>
      scoped(
        supabase.from("orders").select("customer_id, order_date, total, customers(name, phone)").in("status", SOLD).gte("order_date", addDays(today, -365)),
      )
        .order("id")
        .range(a, b),
    ),
    supabase.from("principals").select("id, name").order("name"),
    isBackOffice
      ? supabase.from("members").select("user_id, full_name, email, role")
      : Promise.resolve({ data: [] as { user_id: string; full_name: string | null; email: string | null; role: string }[] }),
    isBackOffice
      ? supabase.from("payables").select("amount, due_date").eq("status", "pendente").lte("due_date", addDays(today, 7))
      : Promise.resolve({ data: [] as { amount: number; due_date: string }[] }),
    supabase.from("leads").select("id, name, company, phone, stage, next_contact").lte("next_contact", today).not("stage", "in", "(ganho,perdido)").order("next_contact").limit(20),
    supabase.from("customers").select("id, name, contact_name, phone, next_contact").lte("next_contact", today).order("next_contact").limit(20),
    loadGoals(P.start, P.end),
    // Pedidos esperando faturamento (qualquer data): base dos avisos de atraso.
    scoped(
      supabase
        .from("orders")
        .select("id, number, status, order_date, sent_at, expected_delivery, total, customers(name), principals(name)")
        .in("status", OPEN_STATUSES),
    ).limit(5000),
  ]);

  const orders = (curData ?? []) as unknown as Order[];
  const sold = orders.filter((o) => SOLD.includes(o.status));
  const prevSold = prevData ?? [];
  const pName = new Map((principals ?? []).map((p) => [p.id, p.name] as const));
  const sName = new Map((members ?? []).map((m) => [m.user_id, m.full_name || m.email || "Vendedor"] as const));

  /* ---------- Indicadores ---------- */
  const soldTotal = sold.reduce((s, o) => s + Number(o.total), 0);
  const prevTotal = prevSold.reduce((s, o) => s + Number(o.total), 0);
  const ticket = sold.length ? soldTotal / sold.length : 0;
  const prevTicket = prevSold.length ? prevTotal / prevSold.length : 0;
  const invoiced = (invCur ?? []).reduce((s, i) => s + Number(i.value), 0);
  const prevInvoiced = (invPrev ?? []).reduce((s, i) => s + Number(i.value), 0);
  const customers = new Set(sold.map((o) => o.customer_id));
  const prevCustomers = new Set(prevSold.map((o) => o.customer_id));

  // Clientes novos: compraram no período e não tinham comprado nos 12 meses anteriores ao início.
  const before = new Set((history ?? []).filter((h) => h.order_date < P.start).map((h) => h.customer_id));
  const newCustomers = [...customers].filter((c) => !before.has(c)).length;

  /* ---------- Gráfico ---------- */
  const series = buildSeries(
    P,
    sold.map((o) => ({ date: o.order_date, value: Number(o.total) })),
    prevSold.map((o) => ({ date: o.order_date, value: Number(o.total) })),
  );

  /* ---------- Situação dos pedidos do período ---------- */
  const funnel = [
    { key: "rascunho", label: "Rascunho", hint: "ainda não enviados" },
    { key: "enviado", label: "Enviado", hint: "aguardando faturamento" },
    { key: "parcial", label: "Faturado parcial", hint: "falta parte" },
    { key: "faturado", label: "Faturado", hint: "com nota fiscal" },
    { key: "cancelado", label: "Cancelado", hint: "" },
  ].map((f) => {
    const list = orders.filter((o) => o.status === f.key || (f.key === "faturado" && o.status === "entregue"));
    return { ...f, n: list.length, value: list.reduce((s, o) => s + Number(o.total), 0), tone: statusInfo(f.key).tone };
  });
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  /* ---------- Rankings ---------- */
  const link = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | null | undefined> = { periodo: sp.periodo, de: sp.de, ate: sp.ate, rep: sp.rep, vend: sp.vend, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };
  const share = (v: number) => (soldTotal ? v / soldTotal : 0);
  const byPrincipal = rank(sold, (o) => o.principal_id, (o) => Number(o.total)).slice(0, 6);
  const bySeller = rank(sold, (o) => o.seller_id, (o) => Number(o.total)).slice(0, 6);
  const byCustomer = rank(sold, (o) => o.customer_id, (o) => Number(o.total)).slice(0, 6);
  const customerName = new Map(sold.map((o) => [o.customer_id, o.customers?.name ?? "Cliente"] as const));
  const productRows = (items ?? []).map((i) => ({ k: `${i.code ?? ""}|${i.description}`, v: Number(i.line_total), q: Number(i.qty), u: String(i.unit ?? "unidade") }));
  const byProduct = rank(productRows, (r) => r.k, (r) => r.v).slice(0, 6);
  const productQty = new Map<string, number>();
  for (const r of productRows) productQty.set(r.k, (productQty.get(r.k) ?? 0) + r.q);
  const productTotal = productRows.reduce((s, r) => s + r.v, 0);
  // Produtos vendidos = quantos produtos DIFERENTES saíram no período (não a soma das quantidades).
  const productUnit = new Map(productRows.map((r) => [r.k, r.u] as const));
  const distinctProducts = productQty.size;
  const qtyText = (q: number, u: string) => `${numberText(q, 3)} ${unitShort(u)}`;

  /* ---------- Clientes para reativar (sem comprar há 60+ dias) ---------- */
  const lastBuy = new Map<string, { date: string; total: number; name: string; phone: string | null }>();
  for (const h of history ?? []) {
    const c = h.customers as unknown as { name: string; phone: string | null } | null;
    const cur = lastBuy.get(h.customer_id);
    lastBuy.set(h.customer_id, {
      date: !cur || h.order_date > cur.date ? h.order_date : cur.date,
      total: (cur?.total ?? 0) + Number(h.total),
      name: c?.name ?? "Cliente",
      phone: c?.phone ?? null,
    });
  }
  const limitDate = addDays(today, -60);
  const toReactivate = [...lastBuy.entries()]
    .filter(([, v]) => v.date < limitDate)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6);

  /* ---------- Meta do recorte ---------- */
  const wantScope = rep && vend ? "vendedor_representada" : vend ? "vendedor" : rep ? "representada" : "geral";
  const covers = (g: GoalRow) => (g.period_start <= P.start && g.period_end >= P.end ? 0 : 1);
  const goal = goalData.goals
    .filter((g) => g.metric === "vendido" && goalScope(g) === wantScope && (!rep || g.principal_id === rep) && (!vend || g.seller_id === vend))
    .sort((a, b) => covers(a) - covers(b))[0];
  const goalP = goal ? goalProgress(goal, goalData.sales, goalData.invoices, today) : null;

  /* ---------- Atrasos ---------- */
  const late = (openData ?? [])
    .map((o) => ({ o, a: orderAging(o, settings.warnDays, settings.criticalDays, today) }))
    .filter((x) => x.a && x.a.level !== "ok")
    .sort((a, b) => (b.a!.level === "critico" ? 1 : 0) - (a.a!.level === "critico" ? 1 : 0) || b.a!.days - a.a!.days);
  const lateCritical = late.filter((x) => x.a!.level === "critico");
  const lateValue = late.reduce((s, x) => s + Number(x.o.total), 0);

  /* ---------- Agenda ---------- */
  const followUps = [
    ...(leadsDue ?? []).map((l) => ({
      kind: "lead" as const, id: l.id, name: l.name, sub: [l.company, stageLabel(l.stage)].filter(Boolean).join(" · "),
      phone: l.phone, date: l.next_contact as string, href: `/leads?lead=${l.id}`,
    })),
    ...(customersDue ?? []).map((c) => ({
      kind: "cliente" as const, id: c.id, name: c.name, sub: c.contact_name ? `Cliente · ${c.contact_name}` : "Cliente",
      phone: c.phone, date: c.next_contact as string, href: `/clientes/${c.id}?aba=interacoes`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const pay7 = (payables ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const payLate = (payables ?? []).filter((p) => p.due_date < today);

  const sellersOpt = isBackOffice
    ? (members ?? []).filter((m) => m.role !== "finance").map((m) => ({ value: m.user_id, label: m.full_name || m.email || "Vendedor" }))
    : null;
  const recent = orders.slice(0, 6);
  const goalTitle = isSeller
    ? rep
      ? `Sua meta · ${pName.get(rep)}`
      : "Sua meta"
    : wantScope === "geral"
      ? "Meta do escritório"
      : wantScope === "representada"
        ? `Meta · ${pName.get(rep!)}`
        : `Meta · ${sName.get(vend!) ?? "vendedor"}`;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${profile.firstName}`}
        hint={
          isSeller
            ? `Seus números: só os seus pedidos e clientes${rep ? ` · ${pName.get(rep)}` : ""}.`
            : rep || vend
              ? `Vendo ${[rep ? pName.get(rep) : null, vend ? sName.get(vend) : null].filter(Boolean).join(" · ")}`
              : "O resumo do escritório. Use os filtros para olhar um período, uma representada ou um vendedor."
        }
        action={canOrder ? <NewButton label="Novo pedido" href="/pedidos/novo" fab /> : null}
      />

      <CockpitShell
        principals={(principals ?? []).map((p) => ({ value: p.id, label: p.name }))}
        sellers={sellersOpt}
        periodLabel={P.label}
        compareLabel={`Comparações ${P.compareLabel}`}
      >
        {/* Indicadores */}
        <dl className="mb-5 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3" style={{ gap: 1 }}>
          <div className="col-span-2 md:col-span-1">
            <Kpi big label="Vendido" icon="receipt" value={brl(soldTotal)} delta={delta(soldTotal, prevTotal)} sub={`antes ${brl(prevTotal)}`} href="/pedidos" />
          </div>
          <Kpi label="Pedidos" icon="file" value={String(sold.length)} delta={delta(sold.length, prevSold.length)} sub={`antes ${prevSold.length}`} href="/pedidos" />
          <Kpi label="Ticket médio" icon="tag" value={brl(ticket)} delta={delta(ticket, prevTicket)} />
          <Kpi label="Faturado (NF)" icon="receipt" value={brl(invoiced)} delta={delta(invoiced, prevInvoiced)} href="/faturamento" />
          <Kpi
            label="Produtos vendidos"
            icon="tag"
            value={String(distinctProducts)}
            sub={distinctProducts === 1 ? "produto diferente no período" : "produtos diferentes no período"}
            href="/produtos"
          />
          <div className="col-span-2 md:col-span-1">
          <Kpi
            label="Clientes atendidos"
            icon="users"
            value={String(customers.size)}
            delta={delta(customers.size, prevCustomers.size)}
            sub={newCustomers ? `${newCustomers} ${newCustomers === 1 ? "novo" : "novos"}` : undefined}
            href="/clientes"
          />
          </div>
        </dl>

        {/* Pedidos em atraso (não dependem do período: todo pedido ainda sem faturar) */}
        {late.length ? (
          <section
            className={`mb-5 overflow-hidden rounded-xl border ${lateCritical.length ? "border-alert/30" : "border-warn-dot/40"} bg-surface`}
          >
            <header className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${lateCritical.length ? "bg-alert-soft" : "bg-warn-soft"}`}>
              <Icon name="alert" size={18} className={lateCritical.length ? "text-alert" : "text-warn"} />
              <h2 className={`text-sm font-semibold ${lateCritical.length ? "text-alert" : "text-warn"}`}>
                {late.length} {late.length === 1 ? "pedido em atraso" : "pedidos em atraso"}
              </h2>
              <span className="text-[13px] text-ink-2">
                {lateCritical.length ? <span className="font-medium text-alert">{lateCritical.length} crítico{lateCritical.length === 1 ? "" : "s"}</span> : null}
                {lateCritical.length && late.length - lateCritical.length ? " · " : ""}
                {late.length - lateCritical.length ? `${late.length - lateCritical.length} em atenção` : ""}
                {" · "}
                {brl(lateValue)} esperando nota
              </span>
              <Link href="/pedidos?status=atraso" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink">
                Ver todos <Icon name="arrow-right" size={12} />
              </Link>
            </header>
            <ul className="divide-y divide-line">
              {late.slice(0, 5).map(({ o, a }) => (
                <li key={o.id}>
                  <Link href={`/pedidos/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-subtle">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${AGING_STYLE[a!.level].dot}`} />
                    <span className="w-20 shrink-0 truncate font-mono text-xs text-muted">{formatOrderNumber(o.number, settings)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{(o.customers as unknown as { name: string } | null)?.name}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {(o.principals as unknown as { name: string } | null)?.name} · {o.status === "parcial" ? "faturado em parte" : "sem nota"}
                      </span>
                    </span>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${AGING_STYLE[a!.level].badge}`}>
                      <Icon name="clock" size={12} />
                      {a!.days} dias
                    </span>
                    <span className="hidden w-24 shrink-0 text-right text-[13px] tabular-nums sm:block">{brl(Number(o.total))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Gráfico + meta + situação */}
        <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <section className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Vendas por {series.unit}</h2>
            <p className="mb-3 text-xs text-muted">Pedidos enviados e faturados, pela data do pedido.</p>
            {sold.length || prevSold.length ? (
              <SalesChart points={series.points} unit={series.unit} compareLabel={P.compareLabel} />
            ) : (
              <p className="py-16 text-center text-sm text-muted">Nenhuma venda neste período.</p>
            )}
          </section>

          <div className="grid content-start gap-4">
            {goal && goalP ? (
              <GoalCard goal={goal} progress={goalP} title={goalTitle} />
            ) : (
              <Link
                href="/metas"
                className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-4 text-sm text-muted transition hover:border-pen hover:text-ink"
              >
                <Icon name="target" size={18} className="text-faint" />
                <span className="flex-1">Sem meta de vendas para este recorte.</span>
                <span className="font-medium text-accent-ink">{canManage ? "Lançar" : "Ver metas"}</span>
              </Link>
            )}

            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold">Situação dos pedidos do período</h2>
              <ul className="grid gap-2.5">
                {funnel.map((f) => (
                  <li key={f.key}>
                    <Link href={`/pedidos?status=${f.key}`} className="group block">
                      <span className="flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge tone={f.tone} dot>
                            {f.label}
                          </Badge>
                          <span className="truncate text-xs text-muted">
                            {f.n} {f.hint}
                          </span>
                        </span>
                        <span className="tabular-nums text-ink group-hover:text-pen">{brl(f.value)}</span>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-active">
                        <span className="block h-full rounded-full bg-pen/70" style={{ width: `${(f.value / funnelMax) * 100}%` }} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {/* Rankings */}
        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <RankList
            title="Representadas"
            empty="Sem vendas no período."
            rows={byPrincipal.map(([id, v]) => ({
              key: id,
              name: pName.get(id) ?? "—",
              value: brl(v),
              share: share(v),
              href: link({ rep: rep === id ? null : id }),
              active: rep === id,
            }))}
          />
          {isBackOffice && !vend ? (
            <RankList
              title="Vendedores"
              empty="Sem vendas no período."
              rows={bySeller.map(([id, v]) => ({
                key: id,
                name: sName.get(id) ?? "Vendedor",
                value: brl(v),
                share: share(v),
                href: link({ vend: id }),
              }))}
            />
          ) : (
            <RankList
              title={isSeller ? "Seus pedidos recentes" : "Pedidos recentes"}
              empty="Nenhum pedido no período."
              more={{ href: "/pedidos", label: "Pedidos" }}
              rows={recent.map((o) => ({
                key: o.id,
                name: (o.customers as unknown as { name: string } | null)?.name ?? "Cliente",
                value: brl(Number(o.total)),
                share: soldTotal ? Math.min(Number(o.total) / Math.max(...recent.map((r) => Number(r.total)), 1), 1) : 0,
                sub: `${formatOrderNumber(o.number, settings)} · ${formatDate(o.order_date)}`,
                href: `/pedidos/${o.id}`,
              }))}
            />
          )}
          <RankList
            title="Clientes"
            empty="Sem vendas no período."
            more={{ href: "/clientes", label: "Carteira" }}
            rows={byCustomer.map(([id, v]) => ({ key: id, name: customerName.get(id) ?? "Cliente", value: brl(v), share: share(v), href: `/clientes/${id}` }))}
          />
          <RankList
            title="Produtos"
            empty="Sem itens vendidos no período."
            rows={byProduct.map(([k, v]) => ({
              key: k,
              name: k.split("|").slice(1).join("|"),
              value: brl(v),
              share: productTotal ? v / productTotal : 0,
              sub: qtyText(productQty.get(k) ?? 0, productUnit.get(k) ?? "unidade"),
            }))}
          />
        </div>

        {/* Financeiro, agenda e reativação */}
        <div className="mb-5 grid gap-4 lg:grid-cols-3">
          {isBackOffice ? (
            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold">Contas a pagar</h2>
              <MiniStat label="Contas nos próximos 7 dias" value={brl(pay7)} href="/contas-a-pagar?status=pendentes" />
              <MiniStat label="Contas vencidas" value={String(payLate.length)} alert={payLate.length > 0} href="/contas-a-pagar?status=vencidas" />
              <p className="mt-2 text-[11px] text-muted">As contas a pagar são do escritório e não mudam com os filtros.</p>
            </section>
          ) : null}

          <section className="flex flex-col rounded-xl border border-line bg-surface">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">
                Contatos de hoje <span className="ml-1 font-normal text-muted">{followUps.length}</span>
              </h2>
              <Link href="/leads?filtro=hoje" className="text-xs text-muted hover:text-ink">
                Prospecção
              </Link>
            </header>
            {followUps.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">Nenhum contato pendente para hoje.</p>
            ) : (
              <ul className="divide-y divide-line">
                {followUps.slice(0, 6).map((f) => {
                  const late = f.date < today;
                  return (
                    <li key={`${f.kind}-${f.id}`} className="relative flex items-center gap-3 px-4 py-2.5 hover:bg-subtle">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${late ? "bg-alert-soft text-alert" : "bg-warn-soft text-warn"}`}>
                        <Icon name={f.kind === "lead" ? "kanban" : "users"} size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <Link href={f.href} className="block truncate text-[13px] font-medium after:absolute after:inset-0">
                          {f.name}
                        </Link>
                        <span className="block truncate text-[11px] text-muted">{f.sub}</span>
                      </span>
                      <span className={`shrink-0 text-[11px] font-medium ${late ? "text-alert" : "text-warn"}`}>
                        {late ? `Atrasado · ${formatDate(f.date).slice(0, 5)}` : "Hoje"}
                      </span>
                      <WhatsAppButton phone={f.phone} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="flex flex-col rounded-xl border border-line bg-surface">
            <header className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Clientes para reativar</h2>
              <p className="text-[11px] text-muted">Compraram no último ano, mas não há mais de 60 dias.</p>
            </header>
            {toReactivate.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">Nenhum cliente parado.</p>
            ) : (
              <ul className="divide-y divide-line">
                {toReactivate.map(([id, c]) => (
                  <li key={id} className="relative flex items-center gap-3 px-4 py-2.5 hover:bg-subtle">
                    <span className="min-w-0 flex-1">
                      <Link href={`/clientes/${id}`} className="block truncate text-[13px] font-medium after:absolute after:inset-0">
                        {c.name}
                      </Link>
                      <span className="block text-[11px] text-muted">
                        Última compra {formatDate(c.date)} · {brl(c.total)} em 12 meses
                      </span>
                    </span>
                    <WhatsAppButton phone={c.phone} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Pedidos do período */}
        <section className="rounded-xl border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">Pedidos do período</h2>
            <Link href="/pedidos" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
              Ver todos <Icon name="arrow-right" size={12} />
            </Link>
          </header>
          {recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted">Nenhum pedido neste período.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((o) => {
                const st = statusInfo(o.status);
                return (
                  <li key={o.id}>
                    <Link href={`/pedidos/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-subtle sm:px-5">
                      <span className="w-20 shrink-0 truncate font-mono text-xs text-muted">{formatOrderNumber(o.number, settings)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{o.customers?.name}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {o.principals?.name} · {formatDate(o.order_date)}
                        </span>
                      </span>
                      <span className="hidden sm:block">
                        <Badge tone={st.tone} dot>
                          {st.label}
                        </Badge>
                      </span>
                      <span className="w-24 shrink-0 text-right text-[13px] tabular-nums">{brl(Number(o.total))}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </CockpitShell>
    </>
  );
}

function MiniStat({ label, value, alert, ok, href }: { label: string; value: string; alert?: boolean; ok?: boolean; href?: string }) {
  const inner = (
    <>
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${alert ? "text-alert" : ok ? "text-ok" : "text-ink"}`}>{value}</span>
    </>
  );
  return href ? (
    <Link href={href} className="-mx-2 flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-hover">
      {inner}
    </Link>
  ) : (
    <div className="flex items-center justify-between py-1.5">{inner}</div>
  );
}

