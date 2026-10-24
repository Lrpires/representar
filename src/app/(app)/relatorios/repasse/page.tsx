import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { resolvePeriod } from "@/lib/cockpit";
import { loadPayouts } from "@/lib/reports";
import { ruleText } from "@/lib/seller-payout";
import { registerPayout, undoPayout } from "../actions";
import { brl, formatDate, pct, todayISO, rangeText } from "@/lib/format";
import { CockpitShell } from "@/components/cockpit/filters";
import { Icon } from "@/components/icons";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit";
import { PageHeader, ErrorNote, OkNote, Notice, Badge, ghostBtn, primaryBtn, iconBtn, quietBtn } from "@/components/ui";

const PATH = "/relatorios/repasse";

// Repasse aos vendedores: do que o escritório recebeu no período, quanto vai para cada vendedor.
export default async function PayoutReport({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; rep?: string; erro?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, canSeeCommissions } = await getContext();
  if (!canSeeCommissions) redirect("/relatorios");
  const today = todayISO();
  const P = resolvePeriod(sp.periodo, sp.de, sp.ate, today);
  const params = new URLSearchParams(Object.entries({ periodo: sp.periodo, de: sp.de, ate: sp.ate, rep: sp.rep }).filter(([, v]) => v) as [string, string][]);
  const here = params.toString() ? `${PATH}?${params}` : PATH;

  const [{ rows, error }, { data: principals }, { data: payoutsData }] = await Promise.all([
    loadPayouts(P, sp.rep),
    supabase.from("principals").select("id, name").order("name"),
    supabase
      .from("seller_payouts")
      .select("id, seller_name, seller_id, amount, paid_at, period_start, period_end, notes")
      .lte("period_start", P.end)
      .gte("period_end", P.start)
      .order("paid_at", { ascending: false }),
  ]);
  const names = new Map(rows.map((r) => [r.key, r.name]));
  const received = rows.reduce((s, r) => s + r.received, 0);
  const pending = rows.reduce((s, r) => s + r.pending, 0);
  const paid = rows.reduce((s, r) => s + r.paid, 0);
  const noRule = rows.filter((r) => !r.rule).length;

  return (
    <>
      <PageHeader
        title="Repasse aos vendedores"
        back={{ href: "/relatorios", label: "Relatórios" }}
        hint="Do que o escritório recebeu das fábricas no período, quanto vai para cada vendedor (regra em Equipe → Comissão dos vendedores)."
        action={
          <div className="flex items-center gap-2">
            <a href={`/relatorios/planilha?r=repasse&${params}`} className={quietBtn} title="Baixar em Excel">
              <Icon name="download" size={15} />
              Planilha
            </a>
            <a href={`/imprimir/relatorio?r=repasse&${params}&auto=1`} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
              <Icon name="printer" size={15} />
              Imprimir / PDF
            </a>
          </div>
        }
      />
      <div className="mb-4 empty:hidden [&>*]:mb-3">
        <ErrorNote message={sp.erro} />
        <OkNote message={sp.ok} />
      </div>

      <CockpitShell principals={(principals ?? []).map((p) => ({ value: p.id, label: p.name }))} sellers={null} periodLabel={rangeText(P.start, P.end)} compareLabel="Pelo dia em que o escritório recebeu">
        {error ? (
          <Notice>Para usar o repasse, rode a migração 029 no Supabase.</Notice>
        ) : (
          <>
            <dl className="mb-5 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4 [&>div]:bg-surface [&>div]:p-4" style={{ gap: 1 }}>
              <div>
                <dt className="text-[13px] text-muted">Recebido pelo escritório</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{brl(received)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">A repassar</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-accent-ink">{brl(pending)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Já repassado</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{brl(paid)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Vendedores sem regra</dt>
                <dd className={`mt-1 text-lg font-semibold tabular-nums ${noRule ? "text-warn" : ""}`}>{noRule}</dd>
              </div>
            </dl>

            {sp.rep ? (
              <p className="mb-3 rounded-lg bg-subtle px-3 py-2 text-[13px] text-ink-2">
                Filtrado por representada: para registrar pagamentos, tire o filtro (o pagamento vale para todas as representadas do período).
              </p>
            ) : null}

            {rows.length === 0 ? (
              <p className="rounded-xl border border-line bg-surface px-5 py-8 text-center text-sm text-muted">
                Nenhum recebimento de comissão no período. O repasse aparece quando a comissão é dada como recebida em Comissões.
              </p>
            ) : (
              <ul className="grid gap-3">
                {rows.map((r) => (
                  <li key={r.key} className="overflow-hidden rounded-xl border border-line bg-surface">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 sm:px-5">
                      <div className="min-w-[12rem] flex-1">
                        <p className="font-medium">{r.name || "Sem vendedor"}</p>
                        <p className="text-xs text-muted">
                          {r.rule ? ruleText(r.rule, (n) => pct(n)) : (
                            <Link href="/equipe#comissao-vendedores" className="font-medium text-warn hover:underline">
                              Sem regra: definir na Equipe
                            </Link>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted">Escritório recebeu</p>
                        <p className="text-sm tabular-nums">{brl(r.received)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted">Repasse</p>
                        <p className="text-sm font-semibold tabular-nums">{brl(r.payout)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted">A pagar</p>
                        <p className={`text-sm font-semibold tabular-nums ${r.pending ? "text-accent-ink" : "text-ok"}`}>
                          {r.pending ? brl(r.pending) : "Pago"}
                        </p>
                      </div>
                      {!sp.rep && r.pending > 0 && r.rule ? (
                        <form action={registerPayout} className="flex items-center gap-2">
                          <input type="hidden" name="key" value={r.key} />
                          <input type="hidden" name="start" value={P.start} />
                          <input type="hidden" name="end" value={P.end} />
                          <input type="hidden" name="back" value={here} />
                          <input type="date" name="paid_at" defaultValue={today} aria-label="Data do pagamento" className="h-9 rounded-md border border-line-strong bg-surface px-2 text-[13px]" />
                          <SubmitButton className={primaryBtn} pending="Registrando…">
                            Registrar pagamento
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                    <details className="group border-t border-line">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-2 text-xs text-muted hover:text-ink sm:px-5 [&::-webkit-details-marker]:hidden">
                        <Icon name="chevron-right" size={12} className="transition group-open:rotate-90" />
                        Ver os {r.items.length} recebimentos
                      </summary>
                      <div className="scroll-thin overflow-x-auto">
                        <table className="w-full min-w-[40rem] text-[13px]">
                          <thead className="bg-subtle text-[11px] text-muted">
                            <tr>
                              <th className="px-4 py-1.5 text-left font-medium sm:px-5">Recebido em</th>
                              <th className="px-2 py-1.5 text-left font-medium">Pedido / NF</th>
                              <th className="px-2 py-1.5 text-left font-medium">Cliente</th>
                              <th className="px-2 py-1.5 text-left font-medium">Representada</th>
                              <th className="px-2 py-1.5 text-right font-medium">Escritório</th>
                              <th className="px-4 py-1.5 text-right font-medium sm:px-5">Repasse</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {r.items.map((i) => (
                              <tr key={i.receiptId}>
                                <td className="px-4 py-1.5 tabular-nums sm:px-5">{formatDate(i.receivedAt)}</td>
                                <td className="px-2 py-1.5 tabular-nums">
                                  {i.order ?? "—"}
                                  {i.invoice ? <span className="text-muted"> · NF {i.invoice}</span> : null}
                                </td>
                                <td className="max-w-[14rem] truncate px-2 py-1.5">{i.customer}</td>
                                <td className="px-2 py-1.5 text-muted">{i.principal}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{brl(i.amount)}</td>
                                <td className="px-4 py-1.5 text-right tabular-nums sm:px-5">
                                  {brl(i.payout)} {i.paid ? <Badge tone="ok">pago</Badge> : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}

            {(payoutsData ?? []).length ? (
              <section className="mt-6">
                <h2 className="mb-2 text-sm font-semibold">Pagamentos de repasse registrados</h2>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-sm">
                  {(payoutsData ?? []).map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{p.seller_name || names.get(`id:${p.seller_id}`) || "Vendedor"}</span>
                        <span className="ml-2 text-xs text-muted">
                          pago em {formatDate(p.paid_at)} · período {formatDate(p.period_start)} a {formatDate(p.period_end)}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{brl(Number(p.amount))}</span>
                      <form>
                        <ConfirmButton
                          message="Desfazer este pagamento? Os recebimentos voltam a ficar pendentes de repasse."
                          formAction={undoPayout.bind(null, p.id, here)}
                          className={iconBtn}
                        >
                          <Icon name="x" size={14} />
                          <span className="sr-only">Desfazer pagamento</span>
                        </ConfirmButton>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </CockpitShell>
    </>
  );
}
