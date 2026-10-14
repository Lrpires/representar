import Link from "next/link";
import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { markReceived, undoReceived } from "./actions";
import { formatOrderNumber, numText, priceText } from "@/lib/orders";
import { brl, formatDate, todayISO } from "@/lib/format";
import { monthInfo } from "@/lib/month";
import { Sheet } from "@/components/sheet";
import { Icon } from "@/components/icons";
import { UrlSelect } from "@/components/url-select";
import { SubmitButton } from "@/components/submit";
import {
  PageHeader, EmptyState, Badge, OkNote, ErrorNote, Field, SheetForm, TableShell, CardList,
  FilterPill, Segmented, inputCls, th, td, tr, ghostBtn, quietBtn, iconBtn,
} from "@/components/ui";

const PATH = "/comissoes";

type Row = {
  id: string; order_id: string; base_value: number; pct: number; value: number; due_date: string;
  status: string; received_at: string | null; received_value: number | null; principal_id: string;
  orders: { number: number; customers: { name: string } | null } | null;
  order_invoices: { number: string | null } | null;
  principals: { name: string } | null;
};

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; rep?: string; status?: string; receber?: string; ok?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await getContext();
  const settings = await getSettings();
  const month = monthInfo(sp.mes);
  const today = todayISO();

  let query = supabase
    .from("commissions")
    .select("id, order_id, base_value, pct, value, due_date, status, received_at, received_value, principal_id, orders(number, customers(name)), order_invoices(number), principals(name)")
    .order("due_date");
  // "Atrasadas" mostra as de qualquer mês; os outros filtros, só o mês escolhido.
  query =
    sp.status === "atrasadas"
      ? query.eq("status", "a_receber").lt("due_date", today)
      : query.gte("due_date", month.start).lte("due_date", month.end);
  if (sp.rep) query = query.eq("principal_id", sp.rep);

  const [{ data, error }, { data: lateData }, { data: principals }, { data: pipeline }] = await Promise.all([
    query,
    // Atrasadas de qualquer mês.
    supabase.from("commissions").select("value").eq("status", "a_receber").lt("due_date", today),
    supabase.from("principals").select("id, name").order("name"),
    // Comissão prevista em pedidos enviados que ainda não foram faturados.
    supabase.from("orders").select("subtotal, discount_pct, commission_pct").eq("status", "enviado"),
  ]);

  const rows = (data ?? []) as unknown as Row[];
  const isLate = (r: Row) => r.status === "a_receber" && r.due_date < today;
  const filtered = rows.filter((r) =>
    !sp.status ? true : sp.status === "atrasadas" ? isLate(r) : r.status === sp.status,
  );

  const live = rows.filter((r) => r.status !== "cancelada");
  const previsto = live.reduce((s, r) => s + Number(r.value), 0);
  const aReceber = live.filter((r) => r.status === "a_receber").reduce((s, r) => s + Number(r.value), 0);
  const recebido = live
    .filter((r) => r.status === "recebida")
    .reduce((s, r) => s + Number(r.received_value ?? r.value), 0);
  const lateTotal = (lateData ?? []).reduce((s, r) => s + Number(r.value), 0);
  const pipelineTotal = (pipeline ?? []).reduce(
    (s, o) => s + (Number(o.subtotal) * (1 - Number(o.discount_pct) / 100) * Number(o.commission_pct ?? 0)) / 100,
    0,
  );

  // Totais por representada (do mês).
  const byPrincipal = new Map<string, { name: string; previsto: number; aReceber: number; recebido: number }>();
  for (const r of live) {
    const cur = byPrincipal.get(r.principal_id) ?? { name: r.principals?.name ?? "—", previsto: 0, aReceber: 0, recebido: 0 };
    cur.previsto += Number(r.value);
    if (r.status === "a_receber") cur.aReceber += Number(r.value);
    if (r.status === "recebida") cur.recebido += Number(r.received_value ?? r.value);
    byPrincipal.set(r.principal_id, cur);
  }

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { mes: sp.mes, rep: sp.rep, status: sp.status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const backQs = qs({});
  const receiving = rows.find((r) => r.id === sp.receber && r.status === "a_receber");
  const count = (s?: string) =>
    rows.filter((r) => (!s ? true : s === "atrasadas" ? isLate(r) : r.status === s)).length;

  return (
    <>
      <PageHeader
        title="Comissões"
        hint="O que cada representada tem para te pagar, mês a mês."
        action={
          <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-white p-0.5 shadow-field">
            <Link href={`${PATH}${qs({ mes: month.prev })}`} className={`${iconBtn} h-9 w-9 sm:h-7 sm:w-7`} aria-label="Mês anterior">
              <Icon name="chevron-left" size={16} />
            </Link>
            <span className="min-w-[8.5rem] text-center text-[13px] font-medium">{month.label}</span>
            <Link href={`${PATH}${qs({ mes: month.next })}`} className={`${iconBtn} h-9 w-9 sm:h-7 sm:w-7`} aria-label="Próximo mês">
              <Icon name="chevron-right" size={16} />
            </Link>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 empty:hidden">
        {!sp.receber ? <ErrorNote message={sp.erro} /> : null}
        <OkNote message={sp.ok} />
      </div>

      {error ? (
        <EmptyState icon="alert" title="Não foi possível carregar as comissões">
          Confira se a migração 009 foi rodada no Supabase.
        </EmptyState>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-line [&>div]:bg-white" style={{ gap: 1 }}>
            <div className="p-3.5 sm:p-5">
              <dt className="text-xs text-muted sm:text-[13px]">Previsto</dt>
              <dd className="mt-1.5 truncate text-base font-semibold tabular-nums tracking-[-0.02em] sm:text-2xl">{brl(previsto)}</dd>
            </div>
            <div className="p-3.5 sm:p-5">
              <dt className="flex items-center gap-1.5 text-xs text-muted sm:text-[13px]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e09f3e]" />A receber
              </dt>
              <dd className="mt-1.5 truncate text-base font-semibold tabular-nums tracking-[-0.02em] text-warn sm:text-2xl">{brl(aReceber)}</dd>
            </div>
            <div className="p-3.5 sm:p-5">
              <dt className="flex items-center gap-1.5 text-xs text-muted sm:text-[13px]">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />Recebido
              </dt>
              <dd className="mt-1.5 truncate text-base font-semibold tabular-nums tracking-[-0.02em] text-ok sm:text-2xl">{brl(recebido)}</dd>
            </div>
          </dl>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {lateTotal > 0 ? (
              <Link
                href={`${PATH}${qs({ status: "atrasadas", mes: undefined })}`}
                className="flex items-center gap-3 rounded-xl border border-alert/20 bg-alert-soft px-4 py-3 text-sm text-alert transition hover:border-alert/40"
              >
                <Icon name="alert" size={18} />
                <span className="flex-1">
                  <span className="font-semibold">{brl(lateTotal)}</span> em comissões atrasadas
                </span>
                <Icon name="chevron-right" size={16} />
              </Link>
            ) : null}
            {pipelineTotal > 0 ? (
              <Link
                href="/pedidos?status=enviado"
                className="flex items-center gap-3 rounded-xl border border-line bg-subtle px-4 py-3 text-sm text-ink-2 transition hover:border-line-strong"
              >
                <Icon name="clock" size={18} className="text-muted" />
                <span className="flex-1">
                  <span className="font-semibold text-ink">{brl(pipelineTotal)}</span> previstos em pedidos enviados ainda não faturados
                </span>
                <Icon name="chevron-right" size={16} className="text-faint" />
              </Link>
            ) : null}
          </div>

          {byPrincipal.size > 1 ? (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold">Por representada</h2>
              <div className="overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead className="border-b border-line bg-subtle text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Representada</th>
                      <th className="px-4 py-2 text-right font-medium">Previsto</th>
                      <th className="px-4 py-2 text-right font-medium">A receber</th>
                      <th className="px-4 py-2 text-right font-medium">Recebido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...byPrincipal.entries()].map(([pid, v]) => (
                      <tr key={pid} className="border-b border-line last:border-b-0">
                        <td className="px-4 py-2.5">
                          <Link href={`${PATH}${qs({ rep: pid })}`} className="font-medium hover:text-pen">
                            {v.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{brl(v.previsto)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-warn">{brl(v.aReceber)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ok">{brl(v.recebido)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented>
              <FilterPill href={`${PATH}${qs({ status: undefined })}`} active={!sp.status} count={count()}>
                Todas
              </FilterPill>
              <FilterPill href={`${PATH}${qs({ status: "a_receber" })}`} active={sp.status === "a_receber"} count={count("a_receber")}>
                A receber
              </FilterPill>
              <FilterPill href={`${PATH}${qs({ status: "atrasadas" })}`} active={sp.status === "atrasadas"} count={count("atrasadas")}>
                Atrasadas
              </FilterPill>
              <FilterPill href={`${PATH}${qs({ status: "recebida" })}`} active={sp.status === "recebida"} count={count("recebida")}>
                Recebidas
              </FilterPill>
              <FilterPill href={`${PATH}${qs({ status: "cancelada" })}`} active={sp.status === "cancelada"} count={count("cancelada")}>
                Canceladas
              </FilterPill>
            </Segmented>
            <div className="ml-auto w-full sm:w-auto">
              <UrlSelect
                param="rep"
                ariaLabel="Representada"
                allLabel="Todas as representadas"
                options={(principals ?? []).map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="percent" title="Sem comissões no mês" compact>
              As comissões aparecem aqui quando um pedido é marcado como faturado. O mês é o do vencimento.
            </EmptyState>
          ) : (
            <>
              <TableShell>
                <thead>
                  <tr>
                    <th className={th}>Vencimento</th>
                    <th className={th}>Pedido</th>
                    <th className={th}>Cliente</th>
                    <th className={th}>Representada</th>
                    <th className={`${th} text-right`}>Faturado</th>
                    <th className={`${th} text-right`}>Comissão</th>
                    <th className={th}>Situação</th>
                    <th className={`${th} w-40 text-right`}>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const late = isLate(r);
                    return (
                      <tr key={r.id} className={`${tr} ${late ? "bg-alert-soft/40" : ""}`}>
                        <td className={`${td} whitespace-nowrap tabular-nums ${late ? "font-medium text-alert" : "text-ink-2"}`}>
                          {formatDate(r.due_date)}
                        </td>
                        <td className={`${td} whitespace-nowrap`}>
                          <Link href={`/pedidos/${r.order_id}`} className="font-mono text-[13px] font-medium hover:text-pen">
                            {r.orders ? formatOrderNumber(r.orders.number, settings) : "—"}
                          </Link>
                          {r.order_invoices?.number ? <p className="text-xs text-muted">NF {r.order_invoices.number}</p> : null}
                        </td>
                        <td className={`${td} max-w-[14rem] truncate`}>{r.orders?.customers?.name}</td>
                        <td className={`${td} text-ink-2`}>{r.principals?.name}</td>
                        <td className={`${td} text-right tabular-nums text-ink-2`}>
                          {brl(Number(r.base_value))}
                          <p className="text-xs text-muted">{numText(Number(r.pct), 2)}%</p>
                        </td>
                        <td className={`${td} text-right font-semibold tabular-nums`}>{brl(Number(r.value))}</td>
                        <td className={td}>
                          <StatusBadge row={r} late={late} />
                        </td>
                        <td className={`${td} text-right`}>
                          <RowAction row={r} backQs={backQs} receiveHref={`${PATH}${qs({ receber: r.id })}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>

              <CardList>
                {filtered.map((r) => {
                  const late = isLate(r);
                  return (
                    <li key={r.id} className={`px-4 py-3 ${late ? "bg-alert-soft/40" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-medium">{r.orders?.customers?.name}</p>
                          <p className="text-[13px] text-muted">
                            <Link href={`/pedidos/${r.order_id}`} className="font-mono text-xs">
                              {r.orders ? formatOrderNumber(r.orders.number, settings) : "—"}
                            </Link>{" "}
                            · {r.principals?.name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold tabular-nums">{brl(Number(r.value))}</p>
                          <p className={`text-xs tabular-nums ${late ? "font-medium text-alert" : "text-muted"}`}>
                            vence {formatDate(r.due_date)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <StatusBadge row={r} late={late} />
                        <RowAction row={r} backQs={backQs} receiveHref={`${PATH}${qs({ receber: r.id })}`} />
                      </div>
                    </li>
                  );
                })}
              </CardList>
            </>
          )}
        </>
      )}

      <Sheet
        open={!!receiving}
        title="Marcar como recebida"
        description={
          receiving
            ? `${receiving.principals?.name ?? ""} · pedido ${receiving.orders ? formatOrderNumber(receiving.orders.number, settings) : ""}`
            : undefined
        }
        closeHref={`${PATH}${qs({ receber: undefined })}`}
      >
        {receiving ? (
          <SheetForm
            action={markReceived.bind(null, receiving.id)}
            closeHref={`${PATH}${qs({ receber: undefined })}`}
            submitLabel="Confirmar recebimento"
          >
            <input type="hidden" name="back" value={qs({ receber: undefined }) || "?"} />
            <ErrorNote message={sp.erro} />
            <Field label="Data do recebimento">
              <input name="received_at" type="date" required defaultValue={today} className={inputCls} />
            </Field>
            <Field label="Valor recebido (R$)" hint={`Previsto: ${brl(Number(receiving.value))}`}>
              <input
                name="received_value"
                inputMode="decimal"
                defaultValue={priceText(Number(receiving.value))}
                className={`${inputCls} text-right tabular-nums`}
              />
            </Field>
          </SheetForm>
        ) : null}
      </Sheet>
    </>
  );
}

function StatusBadge({ row, late }: { row: Row; late: boolean }) {
  if (row.status === "recebida") {
    return (
      <span className="flex flex-col items-start">
        <Badge tone="ok" dot>Recebida</Badge>
        {row.received_at ? <span className="mt-0.5 text-[11px] text-muted">em {formatDate(row.received_at)}</span> : null}
      </span>
    );
  }
  if (row.status === "cancelada") return <Badge tone="neutral" dot>Cancelada</Badge>;
  return late ? <Badge tone="alert" dot>Atrasada</Badge> : <Badge tone="warn" dot>A receber</Badge>;
}

function RowAction({ row, backQs, receiveHref }: { row: Row; backQs: string; receiveHref: string }) {
  if (row.status === "a_receber") {
    return (
      <Link href={receiveHref} scroll={false} className={`${ghostBtn} relative z-10`}>
        <Icon name="check" size={14} strokeWidth={2.2} />
        Marcar como recebida
      </Link>
    );
  }
  if (row.status === "recebida") {
    return (
      <form action={undoReceived.bind(null, row.id)} className="relative z-10 inline">
        <input type="hidden" name="back" value={backQs || "?"} />
        <SubmitButton className={quietBtn} pending="Desfazendo…">
          Desfazer
        </SubmitButton>
      </form>
    );
  }
  return null;
}
