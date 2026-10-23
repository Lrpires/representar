import { currencySymbol } from "@/lib/number-format";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { createPayable, updatePayable, markPaid, undoPaid, deletePayable } from "./actions";
import { PAYABLE_CATEGORIES, categoryInfo, type PayableOption } from "@/lib/payables";
import { brl, formatDate, todayISO } from "@/lib/format";
import { priceText } from "@/lib/orders";
import { monthInfo } from "@/lib/month";
import { Sheet } from "@/components/sheet";
import { Icon } from "@/components/icons";
import { UrlSelect } from "@/components/url-select";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit";
import {
  PageHeader, EmptyState, Badge, OkNote, ErrorNote, Field, SheetForm, NewButton, TableShell, CardList,
  FilterPill, Segmented, Checkbox, inputCls, textareaCls, th, td, tr, ghostBtn, quietBtn, iconBtn, dangerBtn,
} from "@/components/ui";

const PATH = "/contas-a-pagar";

type Payable = {
  id: string; description: string; category: string; amount: number; due_date: string;
  status: string; paid_at: string | null; notes: string | null;
  type_id?: string | null; cost_center_id?: string | null; payment_method_id?: string | null; supplier?: string | null;
};

// Listas do escritório (tipos, centros de custo, formas de pagamento). Sem a migração 018, usa as categorias antigas.
type Lists = { legacy: boolean; byId: Map<string, PayableOption>; tipos: PayableOption[]; centros: PayableOption[]; formas: PayableOption[] };

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; status?: string; cat?: string; tipo?: string; centro?: string; novo?: string; editar?: string; pagar?: string; ok?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, isBackOffice } = await getContext();
  if (!isBackOffice) redirect("/");
  const month = monthInfo(sp.mes);
  const today = todayISO();
  const in7 = addDays(today, 7);

  const { data: optionData, error: optionError } = await supabase
    .from("payable_options")
    .select("id, kind, name, active, sort")
    .order("sort");
  const all = (optionData ?? []) as PayableOption[];
  const lists: Lists = {
    legacy: !!optionError,
    byId: new Map(all.map((o) => [o.id, o] as const)),
    tipos: all.filter((o) => o.kind === "tipo"),
    centros: all.filter((o) => o.kind === "centro"),
    formas: all.filter((o) => o.kind === "forma"),
  };

  let query = supabase
    .from("payables")
    .select(
      lists.legacy
        ? "id, description, category, amount, due_date, status, paid_at, notes"
        : "id, description, category, amount, due_date, status, paid_at, notes, type_id, cost_center_id, payment_method_id, supplier",
    )
    .order("due_date");
  // "Vencidas" mostra as de qualquer mês.
  query =
    sp.status === "vencidas"
      ? query.eq("status", "pendente").lt("due_date", today)
      : query.gte("due_date", month.start).lte("due_date", month.end);
  if (lists.legacy && sp.cat) query = query.eq("category", sp.cat);
  if (!lists.legacy && sp.tipo) query = query.eq("type_id", sp.tipo);
  if (!lists.legacy && sp.centro) query = query.eq("cost_center_id", sp.centro);

  const [{ data, error }, { data: overdueData }, { data: weekData }] = await Promise.all([
    query,
    supabase.from("payables").select("amount").eq("status", "pendente").lt("due_date", today),
    supabase.from("payables").select("amount").eq("status", "pendente").gte("due_date", today).lte("due_date", in7),
  ]);
  const rows = (data ?? []) as unknown as Payable[];
  const overdue = (r: Payable) => r.status === "pendente" && r.due_date < today;
  const filtered = rows.filter((r) =>
    !sp.status || sp.status === "vencidas" ? true : sp.status === "pendentes" ? r.status === "pendente" : r.status === "paga",
  );

  const toPay = rows.filter((r) => r.status === "pendente").reduce((s, r) => s + Number(r.amount), 0);
  const paid = rows.filter((r) => r.status === "paga").reduce((s, r) => s + Number(r.amount), 0);
  const overdueTotal = (overdueData ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const weekTotal = (weekData ?? []).reduce((s, r) => s + Number(r.amount), 0);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { mes: sp.mes, status: sp.status, cat: sp.cat, tipo: sp.tipo, centro: sp.centro, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const backQs = qs({ novo: undefined, editar: undefined, pagar: undefined }) || "?";
  const closeHref = `${PATH}${qs({})}`;
  const editing = rows.find((r) => r.id === sp.editar);
  const paying = rows.find((r) => r.id === sp.pagar && r.status === "pendente");
  const typeLabel = (r: Payable) =>
    lists.legacy ? categoryInfo(r.category).label : (r.type_id && lists.byId.get(r.type_id)?.name) || categoryInfo(r.category).label;
  const detail = (r: Payable) =>
    lists.legacy
      ? ""
      : [r.cost_center_id && lists.byId.get(r.cost_center_id)?.name, r.payment_method_id && lists.byId.get(r.payment_method_id)?.name]
          .filter(Boolean)
          .join(" · ");
  // Quanto cada centro de custo gastou no mês (pagas + a pagar).
  const byCenter = lists.legacy
    ? []
    : [...rows.reduce((m, r) => m.set(r.cost_center_id ?? "", (m.get(r.cost_center_id ?? "") ?? 0) + Number(r.amount)), new Map<string, number>())]
        .sort((a, b) => b[1] - a[1]);
  const monthTotal = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <>
      <PageHeader
        title="Contas a pagar"
        hint="Despesas do escritório por tipo, centro de custo e forma de pagamento. As listas ficam em Configurações."
        action={
          <>
            <div className="hidden items-center gap-1 rounded-lg border border-line-strong bg-surface p-0.5 shadow-field sm:flex">
              <Link href={`${PATH}${qs({ mes: month.prev })}`} className={`${iconBtn} h-7 w-7`} aria-label="Mês anterior">
                <Icon name="chevron-left" size={16} />
              </Link>
              <span className="min-w-[8.5rem] text-center text-[13px] font-medium">{month.label}</span>
              <Link href={`${PATH}${qs({ mes: month.next })}`} className={`${iconBtn} h-7 w-7`} aria-label="Próximo mês">
                <Icon name="chevron-right" size={16} />
              </Link>
            </div>
            <NewButton label="Nova conta" href={`${PATH}${qs({ novo: "1" })}`} fab />
          </>
        }
      />

      {/* Seletor de mês no celular */}
      <div className="-mt-3 mb-4 flex items-center justify-between rounded-lg border border-line-strong bg-surface p-0.5 sm:hidden">
        <Link href={`${PATH}${qs({ mes: month.prev })}`} className={iconBtn} aria-label="Mês anterior">
          <Icon name="chevron-left" size={18} />
        </Link>
        <span className="text-sm font-medium">{month.label}</span>
        <Link href={`${PATH}${qs({ mes: month.next })}`} className={iconBtn} aria-label="Próximo mês">
          <Icon name="chevron-right" size={18} />
        </Link>
      </div>

      <div className="mb-4 grid gap-3 empty:hidden">
        {!sp.novo && !sp.editar && !sp.pagar ? <ErrorNote message={sp.erro} /> : null}
        <OkNote message={sp.ok} />
      </div>

      {error ? (
        <EmptyState icon="alert" title="Não foi possível carregar as contas">
          Confira se a migração 009 foi rodada no Supabase.
        </EmptyState>
      ) : (
        <>
          <dl className="mb-5 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4 [&>div]:bg-surface" style={{ gap: 1 }}>
            <div className="p-4">
              <dt className="text-[13px] text-muted">A pagar no mês</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{brl(toPay)}</dd>
            </div>
            <Link href={`${PATH}${qs({ status: "vencidas" })}`} className="p-4 transition hover:bg-subtle">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">
                {overdueTotal ? <span className="h-1.5 w-1.5 rounded-full bg-alert" /> : null}Vencidas
              </dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${overdueTotal ? "text-alert" : ""}`}>{brl(overdueTotal)}</dd>
            </Link>
            <div className="p-4">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-warn-dot" />Próximos 7 dias
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{brl(weekTotal)}</dd>
            </div>
            <div className="p-4">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />Pago no mês
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-ok">{brl(paid)}</dd>
            </div>
          </dl>

          {byCenter.length > 1 || (byCenter.length === 1 && byCenter[0][0]) ? (
            <section className="mb-5 rounded-xl border border-line bg-surface p-4">
              <p className="mb-3 text-[13px] font-medium text-ink-2">Por centro de custo no mês</p>
              <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {byCenter.slice(0, 8).map(([id, v]) => (
                  <li key={id || "sem"}>
                    <Link href={`${PATH}${qs({ centro: id || undefined })}`} className="group block">
                      <span className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="truncate group-hover:text-ink">{id ? lists.byId.get(id)?.name ?? "—" : "Sem centro de custo"}</span>
                        <span className="shrink-0 font-mono tabular-nums">{brl(v)}</span>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-active">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${monthTotal ? (v / monthTotal) * 100 : 0}%` }} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented>
              <FilterPill href={`${PATH}${qs({ status: undefined })}`} active={!sp.status}>
                Todas
              </FilterPill>
              <FilterPill href={`${PATH}${qs({ status: "pendentes" })}`} active={sp.status === "pendentes"}>
                Pendentes
              </FilterPill>
              <FilterPill href={`${PATH}${qs({ status: "vencidas" })}`} active={sp.status === "vencidas"}>
                Vencidas
              </FilterPill>
              <FilterPill href={`${PATH}${qs({ status: "pagas" })}`} active={sp.status === "pagas"}>
                Pagas
              </FilterPill>
            </Segmented>
            {lists.legacy ? (
              <div className="ml-auto w-full sm:w-auto">
                <UrlSelect
                  param="cat"
                  ariaLabel="Categoria"
                  allLabel="Todas as categorias"
                  options={PAYABLE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                />
              </div>
            ) : (
              <div className="ml-auto grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                <UrlSelect param="tipo" ariaLabel="Tipo de despesa" allLabel="Todos os tipos" options={lists.tipos.map((o) => ({ value: o.id, label: o.name }))} />
                <UrlSelect param="centro" ariaLabel="Centro de custo" allLabel="Todos os centros" options={lists.centros.map((o) => ({ value: o.id, label: o.name }))} />
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="wallet"
              title={rows.length === 0 && !sp.status ? "Nenhuma conta cadastrada" : "Nenhuma conta nesse filtro"}
              compact
              action={<NewButton label="Nova conta" href={`${PATH}${qs({ novo: "1" })}`} />}
            >
              Lance as despesas com vencimento para saber o que sai do caixa no mês.
            </EmptyState>
          ) : (
            <>
              <TableShell>
                <thead>
                  <tr>
                    <th className={th}>Vencimento</th>
                    <th className={th}>Descrição</th>
                    <th className={th}>{lists.legacy ? "Categoria" : "Tipo"}</th>
                    <th className={`${th} text-right`}>Valor</th>
                    <th className={th}>Situação</th>
                    <th className={`${th} w-48 text-right`}>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const late = overdue(r);
                    return (
                      <tr key={r.id} className={`${tr} ${late ? "bg-alert-soft/50" : ""}`}>
                        <td className={`${td} whitespace-nowrap tabular-nums ${late ? "font-medium text-alert" : "text-ink-2"}`}>
                          {formatDate(r.due_date)}
                        </td>
                        <td className={`${td} max-w-xs`}>
                          <Link href={`${PATH}${qs({ editar: r.id })}`} scroll={false} className="block truncate font-medium hover:text-pen">
                            {r.description}
                          </Link>
                          {r.supplier || r.notes ? <p className="truncate text-xs text-muted">{[r.supplier, r.notes].filter(Boolean).join(" · ")}</p> : null}
                        </td>
                        <td className={td}>
                          <span className="block text-ink-2">{typeLabel(r)}</span>
                          {detail(r) ? <span className="block truncate text-xs text-muted">{detail(r)}</span> : null}
                        </td>
                        <td className={`${td} text-right font-semibold tabular-nums ${late ? "text-alert" : ""}`}>{brl(Number(r.amount))}</td>
                        <td className={td}>
                          <PayableStatus row={r} late={late} />
                        </td>
                        <td className={`${td} text-right`}>
                          <PayableAction row={r} backQs={backQs} payHref={`${PATH}${qs({ pagar: r.id })}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-line bg-subtle text-[13px]">
                  <tr>
                    <td className="px-5 py-2.5 text-muted" colSpan={3}>
                      {filtered.length} {filtered.length === 1 ? "conta" : "contas"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {brl(filtered.reduce((s, r) => s + Number(r.amount), 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </TableShell>

              <CardList>
                {filtered.map((r) => {
                  const late = overdue(r);
                  const cat = categoryInfo(r.category);
                  return (
                    <li key={r.id} className={`px-4 py-3 ${late ? "bg-alert-soft/50" : ""}`}>
                      <Link href={`${PATH}${qs({ editar: r.id })}`} scroll={false} className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hover text-muted">
                            <Icon name={cat.icon} size={16} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-medium">{r.description}</span>
                            <span className={`block text-[13px] tabular-nums ${late ? "font-medium text-alert" : "text-muted"}`}>
                              {late ? "Venceu em " : "Vence em "}
                              {formatDate(r.due_date)} · {typeLabel(r)}
                            </span>
                          </span>
                        </span>
                        <span className={`shrink-0 font-semibold tabular-nums ${late ? "text-alert" : ""}`}>{brl(Number(r.amount))}</span>
                      </Link>
                      <div className="mt-2 flex items-center justify-between gap-3 pl-11">
                        <PayableStatus row={r} late={late} />
                        <PayableAction row={r} backQs={backQs} payHref={`${PATH}${qs({ pagar: r.id })}`} />
                      </div>
                    </li>
                  );
                })}
              </CardList>
            </>
          )}
        </>
      )}

      {/* Nova conta */}
      <Sheet open={sp.novo === "1"} title="Nova conta" closeHref={closeHref}>
        <SheetForm action={createPayable} closeHref={closeHref} submitLabel="Salvar conta">
          <input type="hidden" name="back" value={backQs} />
          <ErrorNote message={sp.erro} />
          <PayableFields today={today} lists={lists} />
          <Field label="Repetir" hint="Para contas fixas, como aluguel ou telefone.">
            <select name="repeat" defaultValue="1" className={inputCls}>
              <option value="1">Só esta vez</option>
              {[2, 3, 6, 12].map((n) => (
                <option key={n} value={n}>
                  Todo mês, por {n} meses
                </option>
              ))}
            </select>
          </Field>
          <div className="self-end pb-1">
            <Checkbox name="paid">Já está paga</Checkbox>
          </div>
        </SheetForm>
      </Sheet>

      {/* Editar conta */}
      <Sheet open={!!editing} title="Editar conta" closeHref={closeHref}>
        {editing ? (
          <SheetForm action={updatePayable.bind(null, editing.id)} closeHref={closeHref} submitLabel="Salvar alterações">
            <input type="hidden" name="back" value={backQs} />
            <ErrorNote message={sp.erro} />
            <PayableFields today={today} row={editing} lists={lists} />
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-alert/20 p-3 sm:col-span-2">
              <p className="text-[13px] text-muted">Excluir apaga só esta conta.</p>
              <ConfirmButton
                message={`Excluir "${editing.description}"?`}
                formAction={deletePayable.bind(null, editing.id)}
                className={dangerBtn}
              >
                Excluir
              </ConfirmButton>
            </div>
          </SheetForm>
        ) : null}
      </Sheet>

      {/* Marcar como paga */}
      <Sheet open={!!paying} title="Marcar como paga" description={paying ? `${paying.description} · ${brl(Number(paying.amount))}` : undefined} closeHref={closeHref}>
        {paying ? (
          <SheetForm action={markPaid.bind(null, paying.id)} closeHref={closeHref} submitLabel="Confirmar pagamento">
            <input type="hidden" name="back" value={backQs} />
            <ErrorNote message={sp.erro} />
            <Field label="Data do pagamento" className="sm:col-span-2">
              <input name="paid_at" type="date" required defaultValue={today} className={inputCls} />
            </Field>
          </SheetForm>
        ) : null}
      </Sheet>
    </>
  );
}

function PayableFields({ today, row, lists }: { today: string; row?: Payable; lists: Lists }) {
  // Itens arquivados só aparecem se a conta já usava.
  const opts = (items: PayableOption[], current?: string | null) => items.filter((o) => o.active || o.id === current);
  return (
    <>
      <Field label="Descrição" className="sm:col-span-2">
        <input name="description" required defaultValue={row?.description ?? ""} placeholder="Ex.: Combustível viagem Caruaru" className={inputCls} />
      </Field>
      {lists.legacy ? (
        <Field label="Categoria">
          <select name="category" defaultValue={row?.category ?? "combustivel"} className={inputCls}>
            {PAYABLE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <>
          <Field label="Tipo de despesa">
            <select name="type_id" required defaultValue={row?.type_id ?? ""} className={inputCls}>
              <option value="" disabled>
                Escolha…
              </option>
              {opts(lists.tipos, row?.type_id).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Centro de custo">
            <select name="cost_center_id" defaultValue={row?.cost_center_id ?? ""} className={inputCls}>
              <option value="">Nenhum</option>
              {opts(lists.centros, row?.cost_center_id).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Forma de pagamento">
            <select name="payment_method_id" defaultValue={row?.payment_method_id ?? ""} className={inputCls}>
              <option value="">Nenhuma</option>
              {opts(lists.formas, row?.payment_method_id).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fornecedor" hint="Opcional.">
            <input name="supplier" defaultValue={row?.supplier ?? ""} placeholder="Ex.: Posto Ipiranga" className={inputCls} />
          </Field>
        </>
      )}
      <Field label={`Valor (${currencySymbol()})`}>
        <input
          name="amount"
          inputMode="decimal"
          required
          defaultValue={row ? priceText(Number(row.amount)) : ""}
          placeholder="0,00"
          className={`${inputCls} text-right tabular-nums`}
        />
      </Field>
      <Field label="Vencimento" className="sm:col-span-2">
        <input name="due_date" type="date" required defaultValue={row?.due_date ?? today} className={inputCls} />
      </Field>
      <Field label="Observações" className="sm:col-span-2">
        <textarea name="notes" rows={2} defaultValue={row?.notes ?? ""} className={textareaCls} />
      </Field>
    </>
  );
}

function PayableStatus({ row, late }: { row: Payable; late: boolean }) {
  if (row.status === "paga") {
    return (
      <span className="flex flex-col items-start">
        <Badge tone="ok" dot>Paga</Badge>
        {row.paid_at ? <span className="mt-0.5 text-[11px] text-muted">em {formatDate(row.paid_at)}</span> : null}
      </span>
    );
  }
  return late ? <Badge tone="alert" dot>Vencida</Badge> : <Badge tone="warn" dot>Pendente</Badge>;
}

function PayableAction({ row, backQs, payHref }: { row: Payable; backQs: string; payHref: string }) {
  if (row.status === "pendente") {
    return (
      <Link href={payHref} scroll={false} className={`${ghostBtn} relative z-10`}>
        <Icon name="check" size={14} strokeWidth={2.2} />
        Marcar como paga
      </Link>
    );
  }
  return (
    <form action={undoPaid.bind(null, row.id)} className="inline">
      <input type="hidden" name="back" value={backQs} />
      <SubmitButton className={quietBtn} pending="Desfazendo…">
        Desfazer
      </SubmitButton>
    </form>
  );
}
