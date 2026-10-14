import Link from "next/link";
import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { CommissionRow, expected, nfValue, type Row } from "./row";
import { formatOrderNumber } from "@/lib/orders";
import { brl, formatDate, todayISO } from "@/lib/format";
import { monthInfo } from "@/lib/month";
import { Icon } from "@/components/icons";
import { UrlSelect } from "@/components/url-select";
import {
  PageHeader, EmptyState, OkNote, ErrorNote, FilterPill, Segmented, iconBtn,
} from "@/components/ui";

const PATH = "/comissoes";

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; rep?: string; status?: string; ok?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await getContext();
  const settings = await getSettings();
  const month = monthInfo(sp.mes);
  const today = todayISO();

  let query = supabase
    .from("commissions")
    .select(
      "id, order_id, value, due_date, status, received_at, received_value, principal_id, orders(number, commission_pct, customers(name)), order_invoices(id, number, series, issued_at, value, file_path), principals(name)",
    )
    .order("due_date");
  // "Atrasadas" mostra as de qualquer mês; os outros filtros, só o mês escolhido (pelo vencimento).
  query =
    sp.status === "atrasadas"
      ? query.eq("status", "a_receber").lt("due_date", today)
      : query.gte("due_date", month.start).lte("due_date", month.end);
  if (sp.rep) query = query.eq("principal_id", sp.rep);

  const [{ data, error }, { data: lateData }, { data: principals }, { data: pipeline }] = await Promise.all([
    query,
    supabase.from("commissions").select("value").eq("status", "a_receber").lt("due_date", today),
    supabase.from("principals").select("id, name").order("name"),
    supabase.from("orders").select("subtotal, discount_pct, commission_pct").eq("status", "enviado"),
  ]);

  const rows = (data ?? []) as unknown as Row[];
  const isLate = (r: Row) => r.status === "a_receber" && r.due_date < today;
  const filtered = rows.filter((r) => (!sp.status ? true : sp.status === "atrasadas" ? isLate(r) : r.status === sp.status));

  const live = rows.filter((r) => r.status !== "cancelada");
  const previsto = live.reduce((s, r) => s + expected(r), 0);
  const aReceber = live.filter((r) => r.status === "a_receber").reduce((s, r) => s + expected(r), 0);
  const recebido = live.filter((r) => r.status === "recebida").reduce((s, r) => s + Number(r.received_value ?? r.value), 0);
  const faturado = live.reduce((s, r) => s + nfValue(r), 0);
  const lateTotal = (lateData ?? []).reduce((s, r) => s + Number(r.value), 0);
  const pipelineTotal = (pipeline ?? []).reduce(
    (s, o) => s + (Number(o.subtotal) * (1 - Number(o.discount_pct) / 100) * Number(o.commission_pct ?? 0)) / 100,
    0,
  );

  const byPrincipal = new Map<string, { name: string; nf: number; previsto: number; aReceber: number; recebido: number }>();
  for (const r of live) {
    const cur = byPrincipal.get(r.principal_id) ?? { name: r.principals?.name ?? "—", nf: 0, previsto: 0, aReceber: 0, recebido: 0 };
    cur.nf += nfValue(r);
    cur.previsto += expected(r);
    if (r.status === "a_receber") cur.aReceber += expected(r);
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
  const backQs = qs({}) || "?";
  const count = (s?: string) => rows.filter((r) => (!s ? true : s === "atrasadas" ? isLate(r) : r.status === s)).length;

  return (
    <>
      <PageHeader
        title="Comissões"
        hint="Cada nota fiscal faturada gera uma comissão: valor da NF × % de comissão do pedido."
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
        <ErrorNote message={sp.erro} />
        <OkNote message={sp.ok} />
      </div>

      {error ? (
        <EmptyState icon="alert" title="Não foi possível carregar as comissões">
          Confira se a migração 009 foi rodada no Supabase.
        </EmptyState>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4 [&>div]:bg-white" style={{ gap: 1 }}>
            <div className="p-4 sm:p-5">
              <dt className="text-[13px] text-muted">Notas faturadas</dt>
              <dd className="mt-1.5 truncate text-lg font-semibold tabular-nums tracking-[-0.02em] sm:text-2xl">{brl(faturado)}</dd>
              <dd className="text-xs text-muted">{live.length} {live.length === 1 ? "nota" : "notas"}</dd>
            </div>
            <div className="p-4 sm:p-5">
              <dt className="text-[13px] text-muted">Previsto</dt>
              <dd className="mt-1.5 truncate text-lg font-semibold tabular-nums tracking-[-0.02em] sm:text-2xl">{brl(previsto)}</dd>
            </div>
            <div className="p-4 sm:p-5">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e09f3e]" />A receber
              </dt>
              <dd className="mt-1.5 truncate text-lg font-semibold tabular-nums tracking-[-0.02em] text-warn sm:text-2xl">{brl(aReceber)}</dd>
            </div>
            <div className="p-4 sm:p-5">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />Recebido
              </dt>
              <dd className="mt-1.5 truncate text-lg font-semibold tabular-nums tracking-[-0.02em] text-ok sm:text-2xl">{brl(recebido)}</dd>
            </div>
          </dl>

          <div className="mb-6 grid gap-3 empty:hidden sm:grid-cols-2">
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
                  <span className="font-semibold text-ink">{brl(pipelineTotal)}</span> previstos em pedidos enviados ainda sem nota
                </span>
                <Icon name="chevron-right" size={16} className="text-faint" />
              </Link>
            ) : null}
          </div>

          {byPrincipal.size > 1 ? (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold">Por representada</h2>
              <div className="overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead className="border-b border-line bg-subtle text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Representada</th>
                      <th className="px-4 py-2 text-right font-medium">Notas</th>
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
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{brl(v.nf)}</td>
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
              Cada nota fiscal registrada num pedido gera uma comissão aqui. O mês é o do vencimento da comissão.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
              {/* Cabeçalho (computador) */}
              <li className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_7rem_6rem_minmax(15rem,1.2fr)] items-center gap-4 bg-subtle px-5 py-2 text-xs font-medium text-muted lg:grid">
                <span>Nota fiscal</span>
                <span>Pedido e cliente</span>
                <span className="text-right">Valor da NF</span>
                <span>Vencimento</span>
                <span className="text-right">Comissão recebida</span>
              </li>
              {filtered.map((r) => (
                <CommissionRow key={r.id} r={r} late={isLate(r)} backQs={backQs} label={r.orders ? formatOrderNumber(r.orders.number, settings) : "—"} today={today} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
