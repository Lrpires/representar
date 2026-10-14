"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { fail } from "@/lib/flash";
import { text, optional, parseNumber } from "@/lib/format";
import { round2 } from "@/lib/orders";
import { brl } from "@/lib/format";
import { METRICS, closes, metricInfo, parsePlanKey, type Dimension } from "@/lib/goals";

const PATH = "/metas";

const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, "0");

// Converte o período escolhido no formulário em início/fim. "shift" avança N períodos (repetição).
function periodFrom(formData: FormData, back: string, shift = 0): { start: string; end: string } {
  const type = text(formData, "period_type");
  if (type === "personalizado") {
    const start = text(formData, "start");
    const end = text(formData, "end");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) fail(back, "Informe o início e o fim da meta.");
    if (end < start) fail(back, "O fim da meta precisa ser depois do início.");
    return { start, end };
  }
  if (type === "ano") {
    const y = Number(text(formData, "year"));
    if (!Number.isInteger(y) || y < 2000 || y > 2100) fail(back, "Informe o ano da meta.");
    return { start: `${y + shift}-01-01`, end: `${y + shift}-12-31` };
  }
  const ym = text(formData, "month");
  if (!/^\d{4}-\d{2}$/.test(ym)) fail(back, "Informe o mês da meta.");
  const [y0, m0] = ym.split("-").map(Number);
  const months = type === "trimestre" ? 3 : 1;
  const startIdx = y0 * 12 + (m0 - 1) + shift * months;
  const endIdx = startIdx + months - 1;
  const sy = Math.floor(startIdx / 12), sm = (startIdx % 12) + 1;
  const ey = Math.floor(endIdx / 12), em = (endIdx % 12) + 1;
  return { start: `${sy}-${pad(sm)}-01`, end: `${ey}-${pad(em)}-${pad(lastDay(ey, em))}` };
}

function readTarget(formData: FormData, back: string) {
  const target = parseNumber(text(formData, "target"));
  if (!Number.isFinite(target) || target <= 0) fail(back, "Informe o valor da meta do escritório.");
  return round2(target);
}

function done(month: string, message: string): never {
  revalidatePath(PATH);
  revalidatePath("/");
  redirect(`${PATH}?mes=${month}&ok=${encodeURIComponent(message)}`);
}

/* ---------- Meta do escritório (o total do plano) ---------- */

export async function createGoal(formData: FormData) {
  const { supabase, orgId, canManage } = await getContext();
  const back = `${PATH}?nova=1`;
  if (!canManage) fail(PATH, "Só administrador e gerente lançam metas.");

  const metric = text(formData, "metric");
  if (!METRICS.some((m) => m.value === metric)) fail(back, "Escolha o indicador da meta.");
  const target = readTarget(formData, back);
  const type = text(formData, "period_type");
  const repeat = type === "mes" || type === "trimestre" ? Math.min(Math.max(Number(text(formData, "repeat") || "1"), 1), 12) : 1;
  const periods = Array.from({ length: repeat }, (_, i) => periodFrom(formData, back, i));

  // Um plano (indicador + período) só tem uma meta do escritório.
  const { data: existing } = await supabase
    .from("goals")
    .select("period_start")
    .eq("metric", metric)
    .is("principal_id", null)
    .is("seller_id", null)
    .in("period_start", periods.map((p) => p.start));
  const taken = new Set((existing ?? []).map((e) => e.period_start));
  const rows = periods
    .filter((p) => !taken.has(p.start))
    .map((p) => ({
      org_id: orgId,
      metric,
      target,
      notes: optional(formData, "notes"),
      period_start: p.start,
      period_end: p.end,
      principal_id: null,
      seller_id: null,
    }));
  if (rows.length === 0) fail(back, "Já existe meta do escritório para esse indicador e período. Edite a existente.");

  const { error } = await supabase.from("goals").insert(rows);
  if (error) {
    if (error.message.includes("goals")) fail(back, "Falta rodar a migração 011 no Supabase.");
    fail(back, `Não foi possível salvar: ${error.message}`);
  }
  const skipped = periods.length - rows.length;
  done(
    rows[0].period_start.slice(0, 7),
    `${rows.length > 1 ? `${rows.length} metas lançadas` : "Meta lançada"}${skipped ? ` (${skipped} já existia${skipped > 1 ? "m" : ""})` : ""}. Agora distribua por vendedor ou representada.`,
  );
}

// Altera o total do escritório. As distribuições que não fecharem mais ficam com aviso.
export async function updateOfficeGoal(id: string, formData: FormData) {
  const { supabase, canManage } = await getContext();
  const back = `${PATH}?total=${id}`;
  if (!canManage) fail(PATH, "Só administrador e gerente alteram metas.");
  const target = readTarget(formData, back);
  const { data: g, error } = await supabase
    .from("goals")
    .update({ target, notes: optional(formData, "notes") })
    .eq("id", id)
    .select("period_start")
    .single();
  if (error || !g) fail(back, `Não foi possível salvar: ${error?.message}`);
  done(g.period_start.slice(0, 7), "Meta do escritório atualizada.");
}

// Exclui o plano inteiro: meta do escritório e todas as distribuições.
export async function deletePlan(key: string) {
  const { supabase, canManage } = await getContext();
  const plan = parsePlanKey(key);
  if (!canManage || !plan) fail(PATH, "Não foi possível excluir.");
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("metric", plan.metric)
    .eq("period_start", plan.start)
    .eq("period_end", plan.end);
  if (error) fail(PATH, `Não foi possível excluir: ${error.message}`);
  done(plan.start.slice(0, 7), "Meta excluída.");
}

/* ---------- Distribuição: a soma precisa dar o total do escritório ---------- */

export async function saveDistribution(key: string, dimension: Dimension, formData: FormData) {
  const { supabase, orgId, canManage } = await getContext();
  const plan = parsePlanKey(key);
  const back = `${PATH}?plano=${key}&distribuir=${dimension}`;
  if (!canManage || !plan) fail(PATH, "Não foi possível salvar a distribuição.");
  const money = metricInfo(plan.metric).money;
  const show = (n: number) => (money ? brl(n) : String(n));

  // Campos "t__<vendedor>__<representada>" (vazio onde não se aplica).
  const rows: { seller_id: string | null; principal_id: string | null; target: number }[] = [];
  for (const [name, raw] of formData.entries()) {
    if (!name.startsWith("t__") || typeof raw !== "string" || !raw.trim()) continue;
    const value = parseNumber(raw);
    if (!Number.isFinite(value) || value < 0) fail(back, "Há um valor inválido na distribuição.");
    if (value === 0) continue;
    const [, seller, principal] = name.split("__");
    rows.push({ seller_id: seller || null, principal_id: principal || null, target: round2(value) });
  }
  const sum = round2(rows.reduce((s, r) => s + r.target, 0));
  if (rows.length === 0) fail(back, "Informe a meta de pelo menos um.");

  // Meta do escritório: a soma precisa bater, ou vira a soma se a pessoa pediu.
  const { data: office } = await supabase
    .from("goals")
    .select("id, target")
    .eq("metric", plan.metric)
    .eq("period_start", plan.start)
    .eq("period_end", plan.end)
    .is("principal_id", null)
    .is("seller_id", null)
    .maybeSingle();
  const useSum = formData.get("use_sum") === "on" || !office;
  if (!useSum && !closes(sum, Number(office!.target))) {
    const diff = round2(Number(office!.target) - sum);
    fail(
      back,
      `A soma (${show(sum)}) precisa ser igual à meta do escritório (${show(Number(office!.target))}). ${
        diff > 0 ? `Faltam ${show(diff)}` : `Passou ${show(-diff)}`
      }. Ou marque “usar a soma como meta do escritório”.`,
    );
  }
  if (useSum) {
    if (office) await supabase.from("goals").update({ target: sum }).eq("id", office.id);
    else {
      await supabase.from("goals").insert({
        org_id: orgId, metric: plan.metric, period_start: plan.start, period_end: plan.end, target: sum,
        principal_id: null, seller_id: null,
      });
    }
  }

  // Troca a distribuição desta fatia inteira de uma vez.
  let del = supabase.from("goals").delete().eq("metric", plan.metric).eq("period_start", plan.start).eq("period_end", plan.end);
  if (dimension === "vendedor") del = del.not("seller_id", "is", null).is("principal_id", null);
  if (dimension === "representada") del = del.is("seller_id", null).not("principal_id", "is", null);
  if (dimension === "vendedor_representada") del = del.not("seller_id", "is", null).not("principal_id", "is", null);
  const { error: delError } = await del;
  if (delError) fail(back, `Não foi possível salvar: ${delError.message}`);

  const { error } = await supabase.from("goals").insert(
    rows.map((r) => ({ org_id: orgId, metric: plan.metric, period_start: plan.start, period_end: plan.end, ...r })),
  );
  if (error) fail(back, `Não foi possível salvar: ${error.message}`);
  done(plan.start.slice(0, 7), useSum && office && !closes(sum, Number(office.target))
    ? `Distribuição salva. A meta do escritório passou para ${show(sum)}.`
    : "Distribuição salva.");
}
