"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { formatCnpj, formatPhone, isValidCnpj, isValidPhone } from "@/lib/br";
import { importDef, type ImportKind, type PreviewResult, type PreviewRow } from "@/lib/import-schema";
import { cepText, filled, lower, num, onlyDigits, readSheet, ufText, unitValue, type Cells } from "@/lib/import-read";

type Planned = PreviewRow & { id?: string; payload?: Record<string, unknown> };

/* ---------------------------------------------------------------- planejamento (prévia) */

type Ctx = Awaited<ReturnType<typeof getContext>>;

async function planPrincipals(ctx: Ctx, rows: { line: number; cells: Cells }[]): Promise<Planned[]> {
  const { data } = await ctx.supabase.from("principals").select("id, name, cnpj");
  const byCnpj = new Map((data ?? []).filter((p) => p.cnpj).map((p) => [onlyDigits(p.cnpj!), p.id] as const));
  const byName = new Map((data ?? []).map((p) => [lower(p.name), p.id] as const));
  const seen = new Map<string, number>();

  return rows.map(({ line, cells: c }) => {
    const errors: string[] = [];
    if (!c.name) errors.push("Nome vazio");
    if (c.cnpj && !isValidCnpj(c.cnpj)) errors.push("CNPJ inválido (os dígitos não conferem)");
    const commission = num(c.commission ?? "");
    if (commission !== null && (Number.isNaN(commission) || commission < 0 || commission > 100)) errors.push("Comissão deve ficar entre 0 e 100");
    const days = num(c.days ?? "");
    if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365)) errors.push("Dias para pagar: de 0 a 365");
    if (c.phone && !isValidPhone(c.phone)) errors.push("Telefone incompleto (inclua o DDD)");
    const zip = cepText(c.zip ?? "", errors);
    const state = ufText(c.state ?? "", errors);

    const key = c.cnpj ? `cnpj:${onlyDigits(c.cnpj)}` : `nome:${lower(c.name ?? "")}`;
    if (seen.has(key)) errors.push(`Repetida na planilha (linha ${seen.get(key)})`);
    else seen.set(key, line);
    const id = (c.cnpj && byCnpj.get(onlyDigits(c.cnpj))) || (c.name ? byName.get(lower(c.name)) : undefined);

    const payload = filled({
      name: c.name,
      legal_name: c.legal_name,
      cnpj: c.cnpj && isValidCnpj(c.cnpj) ? formatCnpj(c.cnpj) : undefined,
      default_commission_pct: commission ?? undefined,
      ...(days !== null ? { commission_trigger: "faturamento", commission_close_mode: "dias_apos_evento", commission_days_after: days } : {}),
      contact: c.contact,
      email: c.email,
      phone: c.phone && isValidPhone(c.phone) ? formatPhone(c.phone) : undefined,
      order_email: c.order_email,
      zip,
      street: c.street,
      street_number: c.street_number,
      complement: c.complement,
      district: c.district,
      city: c.city,
      state,
    });
    return {
      line,
      status: errors.length ? "erro" : id ? "atualizar" : "novo",
      label: c.name || "(sem nome)",
      detail: c.cnpj ? formatCnpj(c.cnpj) : c.city ?? "",
      errors,
      id,
      payload,
    } satisfies Planned;
  });
}

async function planCustomers(ctx: Ctx, rows: { line: number; cells: Cells }[]): Promise<Planned[]> {
  const [{ data }, { data: members }] = await Promise.all([
    ctx.supabase.from("customers").select("id, name, cnpj").limit(50000),
    ctx.supabase.from("members").select("user_id, email").eq("org_id", ctx.orgId),
  ]);
  const byCnpj = new Map((data ?? []).filter((p) => p.cnpj).map((p) => [onlyDigits(p.cnpj!), p.id] as const));
  const byName = new Map((data ?? []).map((p) => [lower(p.name), p.id] as const));
  const byEmail = new Map((members ?? []).filter((m) => m.email).map((m) => [m.email!.toLowerCase(), m.user_id as string] as const));
  const seen = new Map<string, number>();

  return rows.map(({ line, cells: c }) => {
    const errors: string[] = [];
    if (!c.name) errors.push("Razão social vazia");
    if (c.cnpj && !isValidCnpj(c.cnpj)) errors.push("CNPJ inválido (os dígitos não conferem)");
    if (c.phone && !isValidPhone(c.phone)) errors.push("Telefone incompleto (inclua o DDD)");
    const zip = cepText(c.zip ?? "", errors);
    const state = ufText(c.state ?? "", errors);
    let sellerId: string | undefined;
    if (c.seller) {
      sellerId = byEmail.get(c.seller.toLowerCase());
      if (!sellerId) errors.push(`Vendedor "${c.seller}" não está na equipe`);
    }

    const key = c.cnpj ? `cnpj:${onlyDigits(c.cnpj)}` : `nome:${lower(c.name ?? "")}`;
    if (seen.has(key)) errors.push(`Repetido na planilha (linha ${seen.get(key)})`);
    else seen.set(key, line);
    const id = (c.cnpj && byCnpj.get(onlyDigits(c.cnpj))) || (c.name ? byName.get(lower(c.name)) : undefined);

    const payload = filled({
      name: c.name,
      cnpj: c.cnpj && isValidCnpj(c.cnpj) ? formatCnpj(c.cnpj) : undefined,
      contact_name: c.contact_name,
      phone: c.phone && isValidPhone(c.phone) ? formatPhone(c.phone) : undefined,
      seller_id: sellerId,
      zip,
      street: c.street,
      street_number: c.street_number,
      complement: c.complement,
      district: c.district,
      city: c.city,
      state,
      notes: c.notes,
    });
    return {
      line,
      status: errors.length ? "erro" : id ? "atualizar" : "novo",
      label: c.name || "(sem nome)",
      detail: [c.cnpj ? formatCnpj(c.cnpj) : "", [c.city, state].filter(Boolean).join("/")].filter(Boolean).join(" · "),
      errors,
      id,
      payload,
    } satisfies Planned;
  });
}

async function planProducts(ctx: Ctx, rows: { line: number; cells: Cells }[]): Promise<Planned[]> {
  const [{ data: principals }, { data: products }] = await Promise.all([
    ctx.supabase.from("principals").select("id, name, cnpj"),
    ctx.supabase.from("products").select("id, principal_id, code").limit(100000),
  ]);
  const pByName = new Map((principals ?? []).map((p) => [lower(p.name), p.id] as const));
  const pByCnpj = new Map((principals ?? []).filter((p) => p.cnpj).map((p) => [onlyDigits(p.cnpj!), p.id] as const));
  const existing = new Map((products ?? []).map((p) => [`${p.principal_id}|${lower(p.code)}`, p.id] as const));
  const seen = new Map<string, number>();

  return rows.map(({ line, cells: c }) => {
    const errors: string[] = [];
    const principalId = c.principal ? pByName.get(lower(c.principal)) ?? pByCnpj.get(onlyDigits(c.principal) || "-") : undefined;
    if (!c.principal) errors.push("Representada vazia");
    else if (!principalId) errors.push(`Representada "${c.principal}" não cadastrada`);
    if (!c.code) errors.push("Código vazio");
    if (!c.name) errors.push("Nome vazio");
    const unit = unitValue(c.unit ?? "");
    if (!unit) errors.push(`Unidade "${c.unit}" não reconhecida`);
    const numbers: Record<string, number | undefined> = {};
    for (const [k, label, max] of [
      ["ipi_pct", "IPI", 100],
      ["min_order_qty", "Pedido mínimo", Infinity],
      ["order_multiple", "Múltiplo", Infinity],
    ] as const) {
      const v = num(c[k] ?? "");
      if (v === null) continue;
      if (Number.isNaN(v) || v < 0 || v > max || (k !== "ipi_pct" && v === 0)) errors.push(`${label} inválido`);
      else numbers[k] = v;
    }

    const key = `${principalId ?? c.principal}|${lower(c.code ?? "")}`;
    if (seen.has(key)) errors.push(`Repetido na planilha (linha ${seen.get(key)})`);
    else seen.set(key, line);
    const id = principalId && c.code ? existing.get(`${principalId}|${lower(c.code)}`) : undefined;

    const payload = filled({
      principal_id: principalId,
      code: c.code,
      name: c.name,
      unit: c.unit ? unit : undefined,
      short_description: c.short_description,
      brand: c.brand,
      category: c.category,
      line: c.line,
      ean: c.ean,
      ncm: c.ncm,
      ...numbers,
    });
    return {
      line,
      status: errors.length ? "erro" : id ? "atualizar" : "novo",
      label: c.name || "(sem nome)",
      detail: [c.code, c.principal].filter(Boolean).join(" · "),
      errors,
      id,
      payload,
    } satisfies Planned;
  });
}

async function plan(kind: ImportKind, formData: FormData) {
  const ctx = await getContext();
  if (!ctx.canManage) return { ctx, result: { ok: false, error: "Só administrador e gerente podem importar dados." } as PreviewResult, planned: [] as Planned[] };
  const def = importDef(kind)!;
  const file = formData.get("file") as File | null;
  const sheet = await readSheet(def, file as File, ctx.canSeeCommissions);
  if ("error" in sheet) return { ctx, result: { ok: false, error: sheet.error } as PreviewResult, planned: [] };
  if (sheet.missingRequired.length) {
    return {
      ctx,
      result: {
        ok: false,
        error: `Faltam as colunas obrigatórias: ${sheet.missingRequired.join(", ")}. Use o modelo baixado aqui e não mude os títulos da primeira linha.`,
      } as PreviewResult,
      planned: [],
    };
  }
  if (sheet.rows.length === 0) return { ctx, result: { ok: false, error: "Nenhuma linha preenchida abaixo dos títulos." } as PreviewResult, planned: [] };

  const planned =
    kind === "representadas" ? await planPrincipals(ctx, sheet.rows) : kind === "clientes" ? await planCustomers(ctx, sheet.rows) : await planProducts(ctx, sheet.rows);
  const counts = { novo: 0, atualizar: 0, erro: 0 };
  for (const p of planned) counts[p.status]++;
  const result: PreviewResult = {
    ok: true,
    kind,
    fileName: (file as File).name,
    rows: planned.map(({ line, status, label, detail, errors }) => ({ line, status, label, detail, errors })),
    counts,
    ignoredColumns: sheet.ignored,
    missingRequired: [],
  };
  return { ctx, result, planned };
}

/* ---------------------------------------------------------------- ações */

export async function previewImport(kind: ImportKind, _prev: PreviewResult | null, formData: FormData): Promise<PreviewResult> {
  if (!importDef(kind)) return { ok: false, error: "Tipo de importação inválido." };
  return (await plan(kind, formData)).result;
}

const TABLE: Record<ImportKind, string> = { representadas: "principals", clientes: "customers", produtos: "products" };
const PATHS: Record<ImportKind, string> = { representadas: "/representadas", clientes: "/clientes", produtos: "/produtos" };

// Lê a planilha de novo (não confia na prévia que ficou no navegador) e grava as linhas sem erro.
export async function runImport(kind: ImportKind, _prev: PreviewResult | null, formData: FormData): Promise<PreviewResult> {
  if (!importDef(kind)) return { ok: false, error: "Tipo de importação inválido." };
  const { ctx, result, planned } = await plan(kind, formData);
  if (!result.ok) return result;
  const table = TABLE[kind];
  let created = 0;
  let updated = 0;
  let failed = 0;
  const failures = new Map<number, string>();

  // Novos: em lotes.
  const news = planned.filter((p) => p.status === "novo");
  for (let i = 0; i < news.length; i += 200) {
    const chunk = news.slice(i, i + 200);
    const rowsToInsert = chunk.map((p) => ({
      org_id: ctx.orgId,
      ...(kind === "clientes" ? { seller_id: ctx.user.id } : {}),
      ...(kind === "produtos" && !p.payload?.unit ? { unit: "unidade" } : {}),
      ...p.payload,
    }));
    const { error } = await ctx.supabase.from(table).insert(rowsToInsert);
    if (!error) {
      created += chunk.length;
      continue;
    }
    // O lote falhou: tenta um por um para saber qual linha deu problema.
    for (const [j, row] of rowsToInsert.entries()) {
      const { error: e } = await ctx.supabase.from(table).insert(row);
      if (e) {
        failed++;
        failures.set(chunk[j].line, e.code === "23505" ? "Já existe um cadastro igual" : e.message);
      } else created++;
    }
  }

  // Existentes: atualiza só o que veio preenchido.
  const ups = planned.filter((p) => p.status === "atualizar" && p.id);
  for (let i = 0; i < ups.length; i += 20) {
    const chunk = ups.slice(i, i + 20);
    const res = await Promise.all(
      chunk.map((p) => {
        const payload: Record<string, unknown> = { ...p.payload };
        if (kind === "produtos") delete payload.principal_id;
        // Endereço novo: a posição no mapa é recalculada.
        if (kind !== "produtos" && ["zip", "street", "street_number", "district", "city", "state"].some((k) => k in payload)) {
          if (kind === "clientes") Object.assign(payload, { latitude: null, longitude: null, geo_quality: null, geocoded_at: null });
        }
        return ctx.supabase.from(table).update(payload).eq("id", p.id!);
      }),
    );
    res.forEach(({ error }, j) => {
      if (error) {
        failed++;
        failures.set(chunk[j].line, error.message);
      } else updated++;
    });
  }

  revalidatePath(PATHS[kind]);
  revalidatePath("/importar");
  revalidatePath("/");
  return {
    ...result,
    rows: result.rows.map((r) => (failures.has(r.line) ? { ...r, status: "erro" as const, errors: [...r.errors, failures.get(r.line)!] } : r)),
    imported: { created, updated, failed },
  };
}
