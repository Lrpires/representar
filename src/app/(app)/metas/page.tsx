import Link from "next/link";
import { getContext } from "@/lib/session";
import { createGoal, updateOfficeGoal, deletePlan, saveDistribution } from "./actions";
import { OfficeGoalFields, TargetField, DistributionEditor, type DistEntity } from "./fields";
import { GoalCard, periodLabel } from "./card";
import {
  DIMENSIONS, closes, goalProgress, goalScope, groupPlans, metricInfo, parsePlanKey, realizedFor, sumTargets,
  type Dimension, type GoalRow, type Plan,
} from "@/lib/goals";
import { fetchActivity, loadGoals } from "@/lib/goals-data";
import { monthInfo } from "@/lib/month";
import { brl, todayISO } from "@/lib/format";
import { numText } from "@/lib/orders";
import { avatarUrl } from "@/lib/storage";
import { Sheet } from "@/components/sheet";
import { Icon } from "@/components/icons";
import { ConfirmButton } from "@/components/confirm-button";
import {
  PageHeader, EmptyState, ErrorNote, OkNote, NewButton, SheetForm, Badge, Field, textareaCls, ghostBtn, dangerBtn, iconBtn,
} from "@/components/ui";

const PATH = "/metas";

const shiftDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Período anterior de mesmo tamanho (mês anterior, trimestre anterior…).
function previousPeriod(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const wholeMonths = sd === 1 && end === new Date(Date.UTC(ey, em, 0)).toISOString().slice(0, 10);
  if (wholeMonths) {
    const months = (ey - sy) * 12 + (em - sm) + 1;
    const ps = new Date(Date.UTC(sy, sm - 1 - months, 1));
    const pe = new Date(Date.UTC(sy, sm - 1, 0));
    return { start: ps.toISOString().slice(0, 10), end: pe.toISOString().slice(0, 10), label: months === 1 ? "Mês anterior" : "Período anterior" };
  }
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  return { start: shiftDays(start, -days), end: shiftDays(start, -1), label: "Período anterior" };
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; nova?: string; total?: string; plano?: string; distribuir?: string; ok?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, canManage, isBackOffice, orgId } = await getContext();
  const month = monthInfo(sp.mes);
  const today = todayISO();

  const [{ goals, sales, invoices, error }, { data: principals }, { data: members }] = await Promise.all([
    loadGoals(month.start, month.end),
    supabase.from("principals").select("id, name, active").order("name"),
    supabase.from("members").select("*").eq("org_id", orgId),
  ]);

  const principalName = new Map((principals ?? []).map((p) => [p.id, p.name] as const));
  type M = { user_id: string; full_name: string | null; email: string | null; avatar_path?: string | null; role: string };
  const people = (members ?? []) as M[];
  const person = new Map(people.map((m) => [m.user_id, m] as const));
  const nameOf = (id: string) => person.get(id)?.full_name || person.get(id)?.email || "Vendedor";
  const photoOf = (id: string) => {
    const p = person.get(id)?.avatar_path;
    return p ? avatarUrl(p) : null;
  };

  const progress = (g: GoalRow) => goalProgress(g, sales, invoices, today);
  const plans = groupPlans(goals);

  const titleOf = (g: GoalRow) => {
    const s = goalScope(g);
    if (s === "geral") return "Escritório";
    if (s === "representada") return principalName.get(g.principal_id!) ?? "Representada";
    if (s === "vendedor") return nameOf(g.seller_id!);
    return `${nameOf(g.seller_id!)} · ${principalName.get(g.principal_id!) ?? ""}`;
  };
  const avatarOf = (g: GoalRow) => {
    const s = goalScope(g);
    if (s === "vendedor" || s === "vendedor_representada") return { name: nameOf(g.seller_id!), src: photoOf(g.seller_id!), round: true };
    if (s === "representada") return { name: principalName.get(g.principal_id!) ?? "?", src: null };
    return undefined;
  };

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { mes: sp.mes, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${PATH}?${s}` : PATH;
  };
  const closeHref = qs({});

  const all = goals.map((g) => progress(g));
  const reached = all.filter((p) => p.status === "atingida").length;
  const onTrack = all.filter((p) => p.status === "no_ritmo").length;
  const behind = all.filter((p) => p.status === "abaixo" || p.status === "encerrada").length;

  /* ---------- Editor de distribuição (quando aberto) ---------- */
  const planParts = parsePlanKey(sp.plano);
  const distDim = DIMENSIONS.find((d) => d.value === sp.distribuir)?.value;
  const editingPlan = planParts && distDim ? plans.find((p) => p.key === sp.plano) ?? {
    key: sp.plano!, metric: planParts.metric, start: planParts.start, end: planParts.end, office: null,
    parts: { vendedor: [], representada: [], vendedor_representada: [] },
  } : null;
  let editor: React.ReactNode = null;
  if (canManage && editingPlan && distDim) {
    const prev = previousPeriod(editingPlan.start, editingPlan.end);
    const hist = await fetchActivity(prev.start, prev.end);
    const sellerRows: DistEntity[] = people
      .filter((m) => m.role !== "finance")
      .map((m) => ({ id: m.user_id, name: nameOf(m.user_id), photo: photoOf(m.user_id), round: true }));
    const principalRows: DistEntity[] = (principals ?? [])
      .filter((p) => p.active || editingPlan.parts.representada.some((g) => g.principal_id === p.id))
      .map((p) => ({ id: p.id, name: p.name }));
    const rows = distDim === "representada" ? principalRows : sellerRows;
    const cols = distDim === "vendedor_representada" ? principalRows : [];
    const initial: Record<string, number> = {};
    for (const g of editingPlan.parts[distDim]) initial[`${g.seller_id ?? ""}__${g.principal_id ?? ""}`] = Number(g.target);
    const reference: Record<string, number> = {};
    const keys = distDim === "vendedor_representada"
      ? rows.flatMap((r) => cols.map((c) => [r.id, c.id] as const))
      : rows.map((r) => (distDim === "vendedor" ? ([r.id, ""] as const) : (["", r.id] as const)));
    for (const [s, p] of keys) {
      reference[`${s}__${p}`] = realizedFor(editingPlan.metric, prev.start, prev.end, { seller_id: s || null, principal_id: p || null }, hist.sales, hist.invoices);
    }
    const sellerGoals = Object.fromEntries(editingPlan.parts.vendedor.map((g) => [g.seller_id!, Number(g.target)]));
    editor = (
      <SheetForm action={saveDistribution.bind(null, editingPlan.key, distDim)} closeHref={closeHref} submitLabel="Salvar distribuição">
        <ErrorNote message={sp.erro} />
        <DistributionEditor
          dimension={distDim}
          money={metricInfo(editingPlan.metric).money}
          total={editingPlan.office ? Number(editingPlan.office.target) : null}
          rows={rows}
          cols={cols}
          initial={initial}
          reference={reference}
          referenceLabel={prev.label}
          sellerGoals={sellerGoals}
        />
      </SheetForm>
    );
  }
  const editingOffice = goals.find((g) => g.id === sp.total && goalScope(g) === "geral");

  return (
    <>
      <PageHeader
        title="Metas"
        hint={
          isBackOffice
            ? "A meta do escritório e como ela se divide entre vendedores e representadas. Cada divisão soma o total."
            : "As suas metas e quanto já foi feito."
        }
        action={
          <>
            <div className="hidden items-center gap-1 rounded-lg border border-line-strong bg-surface p-0.5 shadow-field sm:flex">
              <Link href={qs({ mes: month.prev })} className={`${iconBtn} h-7 w-7`} aria-label="Mês anterior">
                <Icon name="chevron-left" size={16} />
              </Link>
              <span className="min-w-[8.5rem] text-center text-[13px] font-medium">{month.label}</span>
              <Link href={qs({ mes: month.next })} className={`${iconBtn} h-7 w-7`} aria-label="Próximo mês">
                <Icon name="chevron-right" size={16} />
              </Link>
            </div>
            {canManage ? <NewButton label="Nova meta" href={qs({ nova: "1" })} fab /> : null}
          </>
        }
      />

      <div className="-mt-3 mb-4 flex items-center justify-between rounded-lg border border-line-strong bg-surface p-0.5 sm:hidden">
        <Link href={qs({ mes: month.prev })} className={iconBtn} aria-label="Mês anterior">
          <Icon name="chevron-left" size={18} />
        </Link>
        <span className="text-sm font-medium">{month.label}</span>
        <Link href={qs({ mes: month.next })} className={iconBtn} aria-label="Próximo mês">
          <Icon name="chevron-right" size={18} />
        </Link>
      </div>

      <div className="mb-4 grid gap-3 empty:hidden">
        {!sp.nova && !sp.total && !sp.distribuir ? <ErrorNote message={sp.erro} /> : null}
        <OkNote message={sp.ok} />
      </div>

      {error ? (
        <EmptyState icon="alert" title="Não foi possível carregar as metas">
          Confira se a migração 011 foi rodada no Supabase.
        </EmptyState>
      ) : goals.length === 0 ? (
        <EmptyState
          icon="target"
          title="Nenhuma meta neste período"
          action={canManage ? <NewButton label="Lançar meta do escritório" href={qs({ nova: "1" })} /> : null}
        >
          {canManage
            ? "Comece pela meta do escritório. Depois divida por vendedor, por representada ou pelos dois: cada divisão precisa somar o total."
            : "Quando o escritório lançar metas para você, elas aparecem aqui."}
        </EmptyState>
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4 [&>div]:bg-surface" style={{ gap: 1 }}>
            <div className="p-4">
              <dt className="text-[13px] text-muted">Metas no período</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{goals.length}</dd>
            </div>
            <div className="p-4">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-ok" />Atingidas</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-ok">{reached}</dd>
            </div>
            <div className="p-4">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-info" />No ritmo</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{onTrack}</dd>
            </div>
            <div className="p-4">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-warn-dot" />Abaixo do ritmo</dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${behind ? "text-warn" : ""}`}>{behind}</dd>
            </div>
          </dl>

          {isBackOffice ? (
            <div className="grid gap-10">
              {plans.map((plan) => (
                <PlanBlock
                  key={plan.key}
                  plan={plan}
                  canManage={canManage}
                  progress={progress}
                  titleOf={titleOf}
                  avatarOf={avatarOf}
                  qs={qs}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {goals.map((g) => (
                <GoalCard key={g.id} goal={g} progress={progress(g)} title={titleOf(g)} avatar={avatarOf(g)} />
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={canManage && sp.nova === "1"} title="Nova meta do escritório" description="Depois você divide entre vendedores e representadas." closeHref={closeHref}>
        <SheetForm action={createGoal} closeHref={closeHref} submitLabel="Lançar meta">
          <ErrorNote message={sp.erro} />
          <OfficeGoalFields month={month.ym} />
        </SheetForm>
      </Sheet>

      <Sheet
        open={canManage && !!editingOffice}
        title="Meta do escritório"
        description={editingOffice ? `${metricInfo(editingOffice.metric).label} · ${periodLabel(editingOffice.period_start, editingOffice.period_end)}` : undefined}
        closeHref={closeHref}
      >
        {editingOffice ? (
          <SheetForm action={updateOfficeGoal.bind(null, editingOffice.id)} closeHref={closeHref} submitLabel="Salvar">
            <ErrorNote message={sp.erro} />
            <TargetField money={metricInfo(editingOffice.metric).money} metric={editingOffice.metric} label="Meta do escritório" defaultValue={Number(editingOffice.target)} />
            <p className="text-xs text-muted sm:col-span-2">
              Se mudar o total, as divisões que não somarem mais o novo valor ficam marcadas para você ajustar.
            </p>
            <Field label="Observação" className="sm:col-span-2">
              <textarea name="notes" rows={2} defaultValue={editingOffice.notes ?? ""} className={textareaCls} />
            </Field>
          </SheetForm>
        ) : null}
      </Sheet>

      <Sheet
        open={!!editor}
        title={editingPlan && distDim ? DIMENSIONS.find((d) => d.value === distDim)!.action : "Distribuir"}
        description={editingPlan ? `${metricInfo(editingPlan.metric).label} · ${periodLabel(editingPlan.start, editingPlan.end)}` : undefined}
        closeHref={closeHref}
      >
        {editor}
      </Sheet>
    </>
  );
}

function PlanBlock({
  plan,
  canManage,
  progress,
  titleOf,
  avatarOf,
  qs,
}: {
  plan: Plan;
  canManage: boolean;
  progress: (g: GoalRow) => ReturnType<typeof goalProgress>;
  titleOf: (g: GoalRow) => string;
  avatarOf: (g: GoalRow) => { name: string; src: string | null; round?: boolean } | undefined;
  qs: (patch: Record<string, string | undefined>) => string;
}) {
  const m = metricInfo(plan.metric);
  const show = (n: number) => (m.money ? brl(n) : numText(n, 2));
  const total = plan.office ? Number(plan.office.target) : null;

  return (
    <section>
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-base font-semibold tracking-[-0.01em]">{m.label}</h2>
        <span className="text-sm text-muted">{periodLabel(plan.start, plan.end)}</span>
        {canManage ? (
          <form action={deletePlan.bind(null, plan.key)} className="ml-auto">
            <ConfirmButton message="Excluir esta meta do escritório e todas as divisões dela?" className={`${iconBtn} hover:!text-alert`}>
              <Icon name="trash" size={15} />
              <span className="sr-only">Excluir meta</span>
            </ConfirmButton>
          </form>
        ) : null}
      </header>

      {plan.office ? (
        <GoalCard
          goal={plan.office}
          progress={progress(plan.office)}
          title="Meta do escritório"
          editHref={canManage ? qs({ total: plan.office.id }) : undefined}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-warn-dot/60 bg-warn-soft px-4 py-3 text-sm text-warn">
          <Icon name="alert" size={16} />
          <span className="flex-1">Este plano não tem meta do escritório. Abra uma divisão e salve: o total passa a ser a soma dela.</span>
        </div>
      )}

      <div className="mt-4 grid gap-5">
        {DIMENSIONS.map((d) => {
          const list = plan.parts[d.value];
          const sum = sumTargets(list);
          const status: { tone: "ok" | "warn" | "neutral"; text: string } =
            list.length === 0
              ? { tone: "neutral", text: "Não dividida" }
              : total == null
                ? { tone: "warn", text: `Soma ${show(sum)}` }
                : closes(sum, total)
                  ? { tone: "ok", text: "Fechada" }
                  : sum < total
                    ? { tone: "warn", text: `Faltam ${show(total - sum)}` }
                    : { tone: "warn", text: `Passou ${show(sum - total)}` };
          if (list.length === 0 && !canManage) return null;
          return (
            <div key={d.value} className="rounded-xl border border-line bg-subtle/60 p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[13px] font-semibold">{d.label}</h3>
                <Badge tone={status.tone} dot>
                  {status.tone === "ok" ? (
                    <>
                      <Icon name="check" size={11} strokeWidth={2.6} />
                      {status.text}
                    </>
                  ) : (
                    status.text
                  )}
                </Badge>
                {list.length ? <span className="text-xs tabular-nums text-muted">{show(sum)} em {list.length}</span> : null}
                {canManage ? (
                  <Link href={qs({ plano: plan.key, distribuir: d.value })} scroll={false} className={`${ghostBtn} ml-auto`}>
                    <Icon name={list.length ? "edit" : "plus"} size={14} />
                    {list.length ? (status.tone === "warn" ? "Ajustar" : "Editar") : d.action.replace("Distribuir ", "Dividir ")}
                  </Link>
                ) : null}
              </div>
              {list.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list
                    .slice()
                    .sort((a, b) => Number(b.target) - Number(a.target))
                    .map((g) => (
                      <GoalCard key={g.id} goal={g} progress={progress(g)} title={titleOf(g)} avatar={avatarOf(g)} subtitle={total ? `${Math.round((Number(g.target) / total) * 100)}% do escritório` : undefined} />
                    ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
