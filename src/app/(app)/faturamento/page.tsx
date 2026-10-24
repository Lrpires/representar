import Link from "next/link";
import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { registerInvoiceFromBilling, deleteInvoice } from "../pedidos/[id]/invoices";
import { ConfirmButton } from "@/components/confirm-button";
import { unitLabel } from "@/lib/units";
import { XmlImport, type OpenOrder } from "./xml-import";
import { ManualInvoice, type ManualOrder } from "./manual-invoice";
import { formatOrderNumber, numText, statusInfo, OPEN_STATUSES } from "@/lib/orders";
import { orderAging, AGING_STYLE } from "@/lib/aging";
import { resolvePeriod } from "@/lib/cockpit";
import { brl, formatDate, safeQ, todayISO } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { SearchBox } from "@/components/search";
import { UrlSelect } from "@/components/url-select";
import { Icon } from "@/components/icons";
import {
  PageHeader, EmptyState, ErrorNote, OkNote, Badge, SheetForm, Tabs, Tab, TableShell, CardList, RowLink, Toolbar,
  primaryBtn, ghostBtn, iconBtn, dangerBtn, th, td, tr,
} from "@/components/ui";

const PATH = "/faturamento";

const PERIODS = [
  { value: "mes", label: "Este mês" },
  { value: "mes_passado", label: "Mês passado" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "trimestre", label: "Trimestre" },
  { value: "ano", label: "Este ano" },
  { value: "tudo", label: "Todo o período" },
];

type Inv = {
  id: string; number: string | null; series: string | null; issued_at: string; value: number; file_path: string | null;
  file_name: string | null; order_id: string;
  orders: { number: number; status: string; principal_id: string; customers: { name: string } | null; principals: { name: string } | null } | null;
  order_invoice_items: { qty: number }[];
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string; periodo?: string; rep?: string; q?: string; xml?: string; manual?: string; pedido?: string; nota?: string; ok?: string; erro?: string;
  }>;
}) {
  const sp = await searchParams;
  const { supabase, isBackOffice, role, user, canSeeCommissions } = await getContext();
  const settings = await getSettings();
  const today = todayISO();
  const tab = sp.aba === "a-faturar" ? "a-faturar" : "notas";
  const q = safeQ(sp.q).toLowerCase();
  const P = sp.periodo === "tudo" ? null : resolvePeriod(sp.periodo ?? "mes", undefined, undefined, today);
  const canLaunch = role !== "finance" || isBackOffice;

  /* ---------- Notas emitidas ---------- */
  let invQuery = supabase
    .from("order_invoices")
    .select("id, number, series, issued_at, value, file_path, file_name, order_id, orders!inner(number, status, principal_id, customers(name), principals(name)), order_invoice_items(qty)")
    .order("issued_at", { ascending: false })
    .limit(2000);
  if (P) invQuery = invQuery.gte("issued_at", P.start).lte("issued_at", P.end);
  if (sp.rep) invQuery = invQuery.eq("orders.principal_id", sp.rep);

  /* ---------- A faturar ---------- */
  let openQuery = supabase
    .from("orders")
    .select("id, number, status, order_date, sent_at, expected_delivery, total, discount_pct, payment_terms, principal_id, customers(name, cnpj), principals(name, legal_name, cnpj), order_items(id, code, description, qty, unit, unit_price, position)")
    .in("status", OPEN_STATUSES)
    .order("order_date")
    .limit(1000);
  if (sp.rep) openQuery = openQuery.eq("principal_id", sp.rep);

  const [{ data: invData, error }, { data: openData }, { data: principals }] = await Promise.all([
    invQuery,
    openQuery,
    supabase.from("principals").select("id, name").order("name"),
  ]);

  // Nota aberta no painel lateral (?nota=…).
  type InvDetail = {
    id: string; number: string | null; series: string | null; issued_at: string; value: number; access_key?: string | null;
    file_path: string | null; file_name: string | null; notes: string | null; created_at: string; order_id: string;
    orders: {
      number: number; status: string; seller_id: string; discount_pct: number;
      customers: { name: string; cnpj: string | null } | null; principals: { name: string; cnpj: string | null } | null;
    } | null;
    order_invoice_items: { qty: number; order_items: { description: string; code: string | null; unit: string; unit_price: number } | null }[];
    commissions: { value: number; pct: number; due_date: string; status: string; received_value: number | null; received_at: string | null }[];
    order_invoice_installments?: { number: string | null; due_date: string; value: number; position: number }[];
  };
  let detail: InvDetail | null = null;
  if (sp.nota) {
    const base =
      "id, number, series, issued_at, value, file_path, file_name, notes, created_at, order_id, orders!inner(number, status, seller_id, discount_pct, customers(name, cnpj), principals(name, cnpj)), order_invoice_items(qty, order_items(description, code, unit, unit_price)), commissions(value, pct, due_date, status, received_value, received_at)";
    // Com chave de acesso (017) e parcelas (021); sem essas migrações, carrega com o que houver.
    let { data, error: e } = await supabase
      .from("order_invoices")
      .select(`${base}, access_key, order_invoice_installments(number, due_date, value, position)`)
      .eq("id", sp.nota)
      .maybeSingle();
    if (e) ({ data, error: e } = await supabase.from("order_invoices").select(`${base}, access_key`).eq("id", sp.nota).maybeSingle());
    if (e) ({ data } = await supabase.from("order_invoices").select(base).eq("id", sp.nota).maybeSingle());
    detail = (data as unknown as InvDetail) ?? null;
  }
  const canDelete = !!detail && (isBackOffice || detail.orders?.seller_id === user.id);
  const commission = detail?.commissions?.[0];
  const commissionsOfNote = [...(detail?.commissions ?? [])].sort((a, b) => a.due_date.localeCompare(b.due_date));
  // Comissão com dinheiro já recebido (no todo ou em parte) trava a exclusão da nota.
  const commissionPaid = commissionsOfNote.some((c) => c.status === "recebida" || Number(c.received_value ?? 0) > 0);
  const installmentsOfNote = [...(detail?.order_invoice_installments ?? [])].sort((a, b) => a.position - b.position);

  const invoices = ((invData ?? []) as unknown as Inv[]).filter((i) =>
    !q
      ? true
      : (i.number ?? "").toLowerCase().includes(q) ||
        (i.orders?.customers?.name ?? "").toLowerCase().includes(q) ||
        String(i.orders?.number ?? "") === q.replace(/\D/g, ""),
  );
  const invTotal = invoices.reduce((s, i) => s + Number(i.value), 0);
  const ordersServed = new Set(invoices.map((i) => i.order_id)).size;

  // Quanto já foi faturado de cada pedido em aberto (quantidade e valor).
  const openIds = (openData ?? []).map((o) => o.id);
  const { data: doneData } = openIds.length
    ? await supabase
        .from("order_invoices")
        .select("order_id, value, order_invoice_items(order_item_id, qty)")
        .in("order_id", openIds)
    : { data: [] as { order_id: string; value: number; order_invoice_items: { order_item_id: string; qty: number }[] }[] };
  const doneQty = new Map<string, number>();
  const doneValue = new Map<string, number>();
  for (const d of doneData ?? []) {
    doneValue.set(d.order_id, (doneValue.get(d.order_id) ?? 0) + Number(d.value));
    for (const l of (d.order_invoice_items ?? []) as { order_item_id: string; qty: number }[]) {
      doneQty.set(l.order_item_id, (doneQty.get(l.order_item_id) ?? 0) + Number(l.qty));
    }
  }
  type OpenRow = {
    id: string; number: number; status: string; order_date: string; sent_at: string | null; expected_delivery: string | null; total: number;
    customers: { name: string; cnpj: string | null } | null; principals: { name: string; legal_name?: string | null; cnpj: string | null } | null;
    discount_pct: number;
    payment_terms: string | null;
    order_items: { id: string; code: string | null; description: string; qty: number; unit: string; unit_price: number; position: number }[];
  };
  const open = ((openData ?? []) as unknown as OpenRow[])
    .map((o) => ({
      o,
      aging: orderAging(o, settings.warnDays, settings.criticalDays, today),
      invoiced: doneValue.get(o.id) ?? 0,
    }))
    .filter(({ o }) => (!q ? true : (o.customers?.name ?? "").toLowerCase().includes(q) || String(o.number) === q.replace(/\D/g, "")))
    .sort((a, b) => (b.aging?.days ?? 0) - (a.aging?.days ?? 0));
  const openBalance = open.reduce((s, x) => s + Math.max(Number(x.o.total) - x.invoiced, 0), 0);
  const critical = open.filter((x) => x.aging?.level === "critico").length;
  const warn = open.filter((x) => x.aging?.level === "aviso").length;

  const xmlOrders: OpenOrder[] = ((openData ?? []) as unknown as OpenRow[]).map((o) => ({
    id: o.id,
    number: o.number,
    label: formatOrderNumber(o.number, settings),
    date: o.order_date,
    status: o.status,
    total: Number(o.total),
    customerName: o.customers?.name ?? "",
    customerCnpj: o.customers?.cnpj ?? null,
    principalName: o.principals?.name ?? "",
    principalLegalName: o.principals?.legal_name ?? null,
    principalCnpj: o.principals?.cnpj ?? null,
    items: o.order_items.map((i) => ({ id: i.id, code: i.code ?? "", description: i.description, qty: Number(i.qty), invoiced: doneQty.get(i.id) ?? 0 })),
  }));

  const manualOrders: ManualOrder[] = ((openData ?? []) as unknown as OpenRow[]).map((o) => ({
    id: o.id,
    label: formatOrderNumber(o.number, settings),
    date: o.order_date,
    status: o.status,
    total: Number(o.total),
    discountPct: Number(o.discount_pct ?? 0),
    paymentTerms: o.payment_terms ?? null,
    customerName: o.customers?.name ?? "",
    customerCnpj: o.customers?.cnpj ?? null,
    principalName: o.principals?.name ?? "",
    principalCnpj: o.principals?.cnpj ?? null,
    items: [...o.order_items]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((i) => ({
        id: i.id,
        code: i.code ?? "",
        description: i.description,
        unit: i.unit,
        qty: Number(i.qty),
        unitPrice: Number(i.unit_price),
        invoiced: doneQty.get(i.id) ?? 0,
      })),
  }));

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { aba: sp.aba, periodo: sp.periodo, rep: sp.rep, q: sp.q, nota: sp.nota, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${PATH}?${s}` : PATH;
  };

  return (
    <>
      <PageHeader
        title="Faturamento"
        hint="As notas fiscais emitidas pelas representadas e os pedidos que ainda esperam nota."
        action={
          canLaunch ? (
            <div className="flex flex-wrap gap-2">
              <Link href={qs({ manual: "1", nota: undefined, pedido: undefined })} scroll={false} className={ghostBtn}>
                <Icon name="edit" size={15} />
                Lançar nota à mão
              </Link>
              <Link href={qs({ xml: "1", nota: undefined })} scroll={false} className={primaryBtn}>
                <Icon name="upload" size={15} />
                Lançar nota pelo XML
              </Link>
            </div>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 empty:hidden">
        {!sp.xml && !sp.nota && !sp.manual ? <ErrorNote message={sp.erro} /> : null}
        <OkNote message={sp.ok} />
      </div>

      {error ? (
        <EmptyState icon="alert" title="Não foi possível carregar o faturamento">
          Confira se as migrações até a 017 foram rodadas no Supabase.
        </EmptyState>
      ) : (
        <>
          <dl className="mb-5 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4 [&>*]:bg-surface" style={{ gap: 1 }}>
            <div className="p-4">
              <dt className="text-[13px] text-muted">Faturado {P ? `(${PERIODS.find((p) => p.value === (sp.periodo ?? "mes"))?.label.toLowerCase()})` : ""}</dt>
              <dd className="mt-1 truncate text-xl font-semibold tabular-nums">{brl(invTotal)}</dd>
              <dd className="text-xs text-muted">{invoices.length} {invoices.length === 1 ? "nota" : "notas"} · {ordersServed} pedidos</dd>
            </div>
            <div className="p-4">
              <dt className="text-[13px] text-muted">A faturar</dt>
              <dd className="mt-1 truncate text-xl font-semibold tabular-nums">{brl(openBalance)}</dd>
              <dd className="text-xs text-muted">{open.length} {open.length === 1 ? "pedido em aberto" : "pedidos em aberto"}</dd>
            </div>
            <Link href={qs({ aba: "a-faturar", nota: undefined })} className="p-4 transition hover:bg-subtle">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-warn-dot" />Em atenção
              </dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${warn ? "text-warn" : ""}`}>{warn}</dd>
              <dd className="text-xs text-muted">a partir de {settings.warnDays} dias</dd>
            </Link>
            <Link href={qs({ aba: "a-faturar", nota: undefined })} className="p-4 transition hover:bg-subtle">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-alert" />Críticos
              </dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${critical ? "text-alert" : ""}`}>{critical}</dd>
              <dd className="text-xs text-muted">a partir de {settings.criticalDays} dias</dd>
            </Link>
          </dl>

          <Tabs>
            <Tab href={qs({ aba: undefined, nota: undefined })} active={tab === "notas"} count={invoices.length}>
              Notas emitidas
            </Tab>
            <Tab href={qs({ aba: "a-faturar", nota: undefined })} active={tab === "a-faturar"} count={open.length}>
              A faturar
            </Tab>
          </Tabs>

          <div className="pt-4">
            <Toolbar>
              <SearchBox placeholder={tab === "notas" ? "Buscar NF, pedido ou cliente" : "Buscar pedido ou cliente"} hint />
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                <UrlSelect
                  param="rep"
                  ariaLabel="Representada"
                  allLabel="Todas as representadas"
                  options={(principals ?? []).map((p) => ({ value: p.id, label: p.name }))}
                />
                {tab === "notas" ? (
                  <UrlSelect param="periodo" ariaLabel="Período" allLabel="Este mês" options={PERIODS.filter((p) => p.value !== "mes")} />
                ) : null}
              </div>
            </Toolbar>

            {tab === "notas" ? (
              invoices.length === 0 ? (
                <EmptyState
                  icon="receipt"
                  title="Nenhuma nota neste período"
                  compact
                  action={
                    canLaunch ? (
                      <Link href={qs({ xml: "1", nota: undefined })} scroll={false} className={ghostBtn}>
                        <Icon name="upload" size={15} />
                        Lançar nota pelo XML
                      </Link>
                    ) : null
                  }
                >
                  Lance as notas pelo XML da NF-e ou à mão, pelos botões acima.
                </EmptyState>
              ) : (
                <>
                  <TableShell>
                    <thead>
                      <tr>
                        <th className={th}>Nota fiscal</th>
                        <th className={th}>Emissão</th>
                        <th className={th}>Pedido</th>
                        <th className={th}>Cliente</th>
                        <th className={th}>Representada</th>
                        <th className={`${th} text-right`}>Quantidade</th>
                        <th className={`${th} text-right`}>Valor</th>
                        <th className={`${th} w-24`}>
                          <span className="sr-only">Arquivo</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((i) => {
                        const qty = i.order_invoice_items.reduce((s, l) => s + Number(l.qty), 0);
                        const st = statusInfo(i.orders?.status ?? "");
                        return (
                          <tr key={i.id} className={tr}>
                            <td className={td}>
                              <RowLink href={qs({ nota: i.id })} className="font-medium text-ink">
                                NF {i.number || "s/n"}
                              </RowLink>
                            </td>
                            <td className={`${td} tabular-nums text-ink-2`}>{formatDate(i.issued_at)}</td>
                            <td className={td}>
                              <span className="font-mono text-[13px]">{i.orders ? formatOrderNumber(i.orders.number, settings) : "—"}</span>
                              {i.orders?.status === "parcial" ? (
                                <span className="ml-1.5">
                                  <Badge tone={st.tone}>Parcial</Badge>
                                </span>
                              ) : null}
                            </td>
                            <td className={`${td} max-w-[14rem] truncate`}>{i.orders?.customers?.name}</td>
                            <td className={`${td} text-ink-2`}>{i.orders?.principals?.name}</td>
                            <td className={`${td} text-right tabular-nums text-ink-2`}>{qty ? numText(qty, 3) : "—"}</td>
                            <td className={`${td} text-right font-medium tabular-nums`}>{brl(Number(i.value))}</td>
                            <td className={`${td} text-right`}>
                              {i.file_path ? (
                                <span className="relative z-10 inline-flex">
                                  <a href={`/nf/${i.id}`} target="_blank" rel="noopener noreferrer" className={iconBtn} title="Ver nota">
                                    <Icon name="file" size={15} />
                                  </a>
                                  <a href={`/nf/${i.id}?baixar=1`} className={iconBtn} title={`Baixar ${i.file_name ?? ""}`}>
                                    <Icon name="download" size={15} />
                                  </a>
                                </span>
                              ) : (
                                <span className="text-[11px] text-faint">sem arquivo</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-line bg-subtle text-[13px]">
                      <tr>
                        <td className="px-5 py-2.5 text-muted" colSpan={6}>
                          {invoices.length} {invoices.length === 1 ? "nota" : "notas"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{brl(invTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </TableShell>
                  <CardList>
                    {invoices.map((i) => (
                      <li key={i.id} className="relative px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={qs({ nota: i.id })} scroll={false} className="block truncate text-[15px] font-medium after:absolute after:inset-0">
                              NF {i.number || "s/n"} · {i.orders?.customers?.name}
                            </Link>
                            <p className="truncate text-[13px] text-muted">
                              {formatDate(i.issued_at)} · {i.orders?.principals?.name}
                            </p>
                          </div>
                          <p className="shrink-0 font-semibold tabular-nums">{brl(Number(i.value))}</p>
                        </div>
                        {i.file_path ? (
                          <a href={`/nf/${i.id}?baixar=1`} className="relative z-10 mt-1 inline-flex items-center gap-1 text-xs font-medium text-pen">
                            <Icon name="download" size={13} />
                            Baixar arquivo
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </CardList>
                </>
              )
            ) : open.length === 0 ? (
              <EmptyState icon="check" title="Nenhum pedido esperando nota" compact>
                Todos os pedidos enviados já foram faturados.
              </EmptyState>
            ) : (
              <>
                <TableShell>
                  <thead>
                    <tr>
                      <th className={th}>Pedido</th>
                      <th className={th}>Cliente</th>
                      <th className={th}>Representada</th>
                      <th className={th}>Enviado em</th>
                      <th className={th}>Atraso</th>
                      <th className={`${th} text-right`}>Faturado</th>
                      <th className={`${th} text-right`}>Falta</th>
                      <th className={`${th} w-32`}>
                        <span className="sr-only">Ação</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.map(({ o, aging, invoiced }) => (
                      <tr key={o.id} className={`${tr} ${aging?.level === "critico" ? "bg-alert-soft/40" : ""}`}>
                        <td className={td}>
                          <RowLink href={`/pedidos/${o.id}`} className="font-mono text-[13px] font-medium text-ink">
                            {formatOrderNumber(o.number, settings)}
                          </RowLink>
                          <span className="ml-1.5">
                            <Badge tone={statusInfo(o.status).tone} dot>
                              {statusInfo(o.status).label}
                            </Badge>
                          </span>
                        </td>
                        <td className={`${td} max-w-[14rem] truncate`}>{o.customers?.name}</td>
                        <td className={`${td} text-ink-2`}>{o.principals?.name}</td>
                        <td className={`${td} tabular-nums text-ink-2`}>{formatDate(String(o.sent_at ?? o.order_date).slice(0, 10))}</td>
                        <td className={td}>
                          {aging ? (
                            <span className={`inline-flex h-[1.375rem] items-center gap-1 rounded-md px-1.5 text-xs font-medium ${AGING_STYLE[aging.level].badge}`}>
                              <Icon name="clock" size={12} />
                              {aging.days} dias
                            </span>
                          ) : null}
                        </td>
                        <td className={`${td} text-right tabular-nums text-ink-2`}>{invoiced ? brl(invoiced) : "—"}</td>
                        <td className={`${td} text-right font-medium tabular-nums`}>{brl(Math.max(Number(o.total) - invoiced, 0))}</td>
                        <td className={`${td} text-right`}>
                          {canLaunch ? (
                            <Link href={qs({ manual: "1", pedido: o.id, nota: undefined })} scroll={false} className={`${ghostBtn} relative z-10`}>
                              Lançar nota
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
                <CardList>
                  {open.map(({ o, aging, invoiced }) => (
                    <li key={o.id} className={`px-4 py-3 ${aging?.level === "critico" ? "bg-alert-soft/40" : ""}`}>
                      <Link href={`/pedidos/${o.id}`} className="block">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs text-muted">{formatOrderNumber(o.number, settings)}</span>
                          {aging ? (
                            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${AGING_STYLE[aging.level].badge}`}>
                              <Icon name="clock" size={12} />
                              {aging.days} dias
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[15px] font-medium">{o.customers?.name}</p>
                        <p className="flex justify-between text-[13px] text-muted">
                          <span className="truncate">{o.principals?.name}</span>
                          <span className="shrink-0 tabular-nums">falta {brl(Math.max(Number(o.total) - invoiced, 0))}</span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </CardList>
              </>
            )}
          </div>
        </>
      )}

      {/* ---------- Lançar nota à mão ---------- */}
      <Sheet
        open={canLaunch && sp.manual === "1"}
        title="Lançar nota à mão"
        description="Escolha o pedido e preencha os dados da nota. Se tiver o XML, solte no campo do arquivo que ele preenche tudo."
        closeHref={qs({ manual: undefined, pedido: undefined })}
      >
        <SheetForm action={registerInvoiceFromBilling} closeHref={qs({ manual: undefined, pedido: undefined })} submitLabel="Lançar nota">
          <ErrorNote message={sp.erro} />
          <ManualInvoice orders={manualOrders} today={today} initialOrderId={sp.pedido} />
        </SheetForm>
      </Sheet>

      {/* ---------- Detalhes da nota ---------- */}
      <Sheet
        open={!!detail}
        title={detail ? `NF ${detail.number || "sem número"}` : "Nota fiscal"}
        description={detail ? `Emitida em ${formatDate(detail.issued_at)}` : undefined}
        closeHref={qs({ nota: undefined })}
      >
        {detail ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="scroll-thin grid flex-1 content-start gap-5 overflow-y-auto px-5 py-5">
              <ErrorNote message={sp.erro} />

              {/* Pedido ligado à nota */}
              <Link
                href={`/pedidos/${detail.order_id}`}
                className="group flex items-center gap-3 rounded-lg border border-line bg-subtle p-3 transition hover:border-line-strong"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted">
                  <Icon name="receipt" size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-muted">Pedido desta nota</span>
                  <span className="block truncate text-sm font-medium">
                    <span className="font-mono">{detail.orders ? formatOrderNumber(detail.orders.number, settings) : "—"}</span>
                    {" · "}
                    {detail.orders?.customers?.name}
                  </span>
                  <span className="block truncate text-xs text-muted">{detail.orders?.principals?.name}</span>
                </span>
                {detail.orders ? <Badge tone={statusInfo(detail.orders.status).tone}>{statusInfo(detail.orders.status).label}</Badge> : null}
                <Icon name="chevron-right" size={16} className="text-faint group-hover:text-ink" />
              </Link>

              {/* Espelho da nota: quem emitiu, para quem, valor e data */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <div>
                  <dt className="text-xs text-muted">Emitente</dt>
                  <dd className="font-medium">{detail.orders?.principals?.name ?? "—"}</dd>
                  {detail.orders?.principals?.cnpj ? <dd className="text-xs text-muted">{detail.orders.principals.cnpj}</dd> : null}
                </div>
                <div>
                  <dt className="text-xs text-muted">Destinatário</dt>
                  <dd className="font-medium">{detail.orders?.customers?.name ?? "—"}</dd>
                  {detail.orders?.customers?.cnpj ? <dd className="text-xs text-muted">{detail.orders.customers.cnpj}</dd> : null}
                </div>
                <div>
                  <dt className="text-xs text-muted">Valor da nota</dt>
                  <dd className="font-mono text-base font-semibold tabular-nums">{brl(Number(detail.value))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Emissão</dt>
                  <dd className="tabular-nums">{formatDate(detail.issued_at)}</dd>
                </div>
                {detail.access_key ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted">Chave de acesso</dt>
                    <dd className="break-all font-mono text-xs">{detail.access_key}</dd>
                  </div>
                ) : null}
                {detail.notes ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted">Observações</dt>
                    <dd className="whitespace-pre-line">{detail.notes}</dd>
                  </div>
                ) : null}
              </dl>

              {/* Parcelas (duplicatas) */}
              {installmentsOfNote.length ? (
                <section>
                  <p className="mb-2 text-xs font-medium text-muted">Parcelas</p>
                  <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line text-[13px]">
                    {installmentsOfNote.map((x) => (
                      <li key={x.position} className="flex items-center gap-3 px-3 py-2">
                        <span className="w-12 font-mono text-xs text-muted">{x.number || x.position}</span>
                        <span className="flex-1 tabular-nums">vence {formatDate(x.due_date)}</span>
                        <span className="font-mono tabular-nums">{brl(Number(x.value))}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Arquivo */}
              {detail.file_path ? (
                <div className="flex flex-wrap gap-2">
                  <a href={`/nf/${detail.id}`} target="_blank" rel="noopener noreferrer" className={ghostBtn}>
                    <Icon name="file" size={15} />
                    Ver arquivo
                  </a>
                  <a href={`/nf/${detail.id}?baixar=1`} className={ghostBtn}>
                    <Icon name="download" size={15} />
                    Baixar {detail.file_name ? "" : "arquivo"}
                  </a>
                  {detail.file_name ? <span className="self-center truncate text-xs text-muted">{detail.file_name}</span> : null}
                </div>
              ) : (
                <p className="text-xs text-muted">Nenhum arquivo (PDF ou XML) anexado a esta nota.</p>
              )}

              {/* Itens faturados nesta nota (preço do pedido, com o desconto geral) */}
              {detail.order_invoice_items.length ? (
                <section>
                  <p className="mb-2 text-xs font-medium text-muted">Itens da nota</p>
                  <div className="overflow-hidden rounded-lg border border-line">
                    <table className="w-full text-[13px]">
                      <thead className="bg-subtle text-[11px] text-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Produto</th>
                          <th className="px-3 py-2 text-right font-medium">Qtd.</th>
                          <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Valor un.</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {detail.order_invoice_items.map((l, n) => {
                          const price = Number(l.order_items?.unit_price ?? 0) * (1 - Number(detail!.orders?.discount_pct ?? 0) / 100);
                          return (
                            <tr key={n}>
                              <td className="px-3 py-2.5">
                                {l.order_items?.code ? <span className="block font-mono text-[11px] text-muted">{l.order_items.code}</span> : null}
                                {l.order_items?.description ?? "Item removido do pedido"}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                                {numText(Number(l.qty), 3)} {l.order_items ? unitLabel(l.order_items.unit).toLowerCase() : ""}
                              </td>
                              <td className="hidden whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums sm:table-cell">{brl(price)}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums">{brl(price * Number(l.qty))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {/* Comissões desta nota (só quem vê comissões): uma por parcela, quando a representada paga na liquidez */}
              {canSeeCommissions && commissionsOfNote.length ? (
                <section>
                  <p className="mb-2 text-xs font-medium text-muted">
                    {commissionsOfNote.length === 1 ? "Comissão desta nota" : `Comissões desta nota (${commissionsOfNote.length}, uma por parcela)`}
                  </p>
                  <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line text-[13px]">
                    {commissionsOfNote.map((c, n) => (
                      <li key={n} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                        <span className="font-mono font-semibold tabular-nums">{brl(Number(c.value))}</span>
                        <span className="text-muted">{numText(Number(c.pct), 2)}%</span>
                        <span className="text-muted">vence {formatDate(c.due_date)}</span>
                        <span className="ml-auto">
                          <Badge tone={c.status === "recebida" ? "ok" : c.status === "a_receber" ? "info" : "neutral"} dot>
                            {c.status === "recebida"
                              ? "Recebida"
                              : c.status === "cancelada"
                                ? "Cancelada"
                                : c.status === "encerrada"
                                  ? "Encerrada"
                                  : Number(c.received_value ?? 0) > 0
                                    ? `Recebido ${brl(Number(c.received_value))}`
                                    : "A receber"}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            <p className="border-t border-line px-5 py-2 text-[11px] text-faint">Lançada no sistema em {formatDate(String(detail.created_at).slice(0, 10))}</p>
            <footer className="flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:pb-3">
              {canDelete ? (
                commissionPaid ? (
                  <span className="text-xs text-muted sm:mr-auto">A comissão já teve recebimento: apague os recebimentos em Comissões para poder excluir.</span>
                ) : (
                  <form className="sm:mr-auto">
                    <ConfirmButton
                      message={`Excluir a NF ${detail.number ?? ""}? A comissão desta nota também será apagada e o pedido volta a esperar essas quantidades. Não dá para desfazer.`}
                      formAction={deleteInvoice.bind(null, detail.id)}
                      className={dangerBtn}
                    >
                      <Icon name="trash" size={15} />
                      Excluir nota
                    </ConfirmButton>
                  </form>
                )
              ) : (
                <span className="sm:mr-auto" />
              )}
              <Link href={qs({ nota: undefined })} replace scroll={false} className={ghostBtn}>
                Fechar
              </Link>
              <Link href={`/pedidos/${detail.order_id}`} className={primaryBtn}>
                Ver pedido
              </Link>
            </footer>
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={canLaunch && sp.xml === "1"}
        title="Lançar nota pelo XML"
        description="Escolha o XML da NF-e. O sistema lê a nota, sugere o pedido e preenche as quantidades."
        closeHref={qs({ xml: undefined })}
      >
        <SheetForm action={registerInvoiceFromBilling} closeHref={qs({ xml: undefined })} submitLabel="Vincular e lançar">
          <ErrorNote message={sp.erro} />
          <XmlImport orders={xmlOrders} />
        </SheetForm>
      </Sheet>
    </>
  );
}
