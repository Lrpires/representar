import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import {
  updateProduct, addVariant, deleteVariant, setCoverImage, deleteImage, deleteProduct,
} from "./actions";
import { unitGroupsFor, unitLabel } from "@/lib/units";
import { getSettings } from "@/lib/settings";
import { Icon, type IconName } from "@/components/icons";
import {
  PageHeader, Field, FormSection, ErrorNote, OkNote, Badge, inputCls, primaryBtn, ghostBtn, dangerBtn,
 SaveBar,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import ImageManager from "./ImageManager";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { productImageUrl } from "@/lib/storage";
import { brl, formatDate } from "@/lib/format";
import { formatOrderNumber, numText } from "@/lib/orders";
import SpecsEditor from "./SpecsEditor";
import type { ReactNode } from "react";

const PATH = "/produtos";

function Section({
  title, hint, children,
}: { icon?: IconName; title: string; hint?: string; children: ReactNode }) {
  return (
    <FormSection title={title} hint={hint}>
      {children}
    </FormSection>
  );
}

const grid = "grid gap-4 sm:grid-cols-2";
const check = "h-5 w-5 shrink-0 rounded border-line-strong ";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, orgId, canManage, canSeeCommissions } = await getContext();
  const settings = await getSettings();

  const [{ data: p }, { data: variants }, { data: images }] = await Promise.all([
    supabase.from("products").select("*, principals(name)").eq("id", id).maybeSingle(),
    supabase
      .from("product_variants")
      .select("id, code, attributes, ean")
      .eq("product_id", id)
      .order("code"),
    supabase
      .from("product_images")
      .select("id, path, is_cover, position")
      .eq("product_id", id)
      .order("position"),
  ]);
  if (!p) notFound();

  // Vendas deste produto (todas as variações), dos pedidos mais novos para os mais antigos.
  const variantIds = (variants ?? []).map((vr) => vr.id);
  const { data: soldRows } = variantIds.length
    ? await supabase
        .from("order_items")
        .select("qty, list_price, line_total, orders!inner(id, number, order_date, status, customers(name))")
        .in("variant_id", variantIds)
        .neq("orders.status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] as never[] };
  type Sold = {
    qty: number; list_price: number; line_total: number;
    orders: { id: string; number: number; order_date: string; status: string; customers: { name: string } | null };
  };
  const sales = (soldRows ?? []) as unknown as Sold[];
  const soldQty = sales.reduce((s, r) => s + Number(r.qty), 0);
  const soldValue = sales.reduce((s, r) => s + Number(r.line_total), 0);
  const cover = (images ?? []).find((i) => i.is_cover) ?? (images ?? [])[0];

  const principal = p.principals as unknown as { name: string } | null;
  const v = (x: string | number | null | undefined) => (x == null ? "" : String(x));
  const save = updateProduct.bind(null, id);
  const addVariantFor = addVariant.bind(null, id);
  const specs = Object.entries((p.specs ?? {}) as Record<string, string>);
  const tags = ((p.tags ?? []) as string[]).join(", ");

  async function setCover(fd: FormData) {
    "use server";
    await setCoverImage(id, String(fd.get("image_id") ?? ""));
  }
  async function remove(fd: FormData) {
    "use server";
    await deleteImage(id, String(fd.get("image_id") ?? ""));
  }

  return (
    <>
      <PageHeader
        title={p.name}
        back={{ href: PATH, label: "Produtos" }}
        leading={
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-subtle text-faint">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productImageUrl(cover.path)} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon name="image" size={22} />
            )}
          </span>
        }
        meta={
          <>
            <Badge tone={p.active ? "ok" : "neutral"} dot>
              {p.active ? "Ativo" : "Inativo"}
            </Badge>
            <span className="font-mono text-xs">{p.code}</span>
            {principal?.name ? <span>{principal.name}</span> : null}
            <span>Vendido por {unitLabel(p.unit).toLowerCase()}</span>
          </>
        }
      />

      <dl className="mb-6 grid max-w-5xl grid-cols-2 overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4 [&>div]:bg-surface" style={{ gap: 1 }}>
        <div className="p-4">
          <dt className="text-[13px] text-muted">Último preço</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{sales[0] ? brl(Number(sales[0].list_price)) : "—"}</dd>
        </div>
        <div className="p-4">
          <dt className="text-[13px] text-muted">Quantidade vendida</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{numText(soldQty, 3) || "0"}</dd>
        </div>
        <div className="p-4">
          <dt className="text-[13px] text-muted">Valor vendido</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{brl(soldValue)}</dd>
        </div>
        <div className="p-4">
          <dt className="text-[13px] text-muted">Último pedido</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{sales[0] ? formatDate(sales[0].orders.order_date) : "—"}</dd>
        </div>
      </dl>

      <div className="mb-4 max-w-5xl empty:hidden [&>*]:mb-3">
        <ErrorNote message={sp.erro} />
        <OkNote message={sp.ok} />
      </div>

      <div className="grid max-w-5xl gap-6 lg:gap-0">
        <Section icon="image" title="Imagens" hint="As fotos são reduzidas automaticamente. A capa aparece na lista.">
          <ImageManager
            productId={id}
            orgId={orgId}
            images={(images ?? []).map((i) => ({ id: i.id, path: i.path, is_cover: i.is_cover }))}
            canManage={canManage}
            onSetCover={setCover}
            onDelete={remove}
          />
        </Section>

        <form action={save} className="grid gap-6 lg:gap-0">
          <fieldset disabled={!canManage} className="m-0 grid min-w-0 gap-6 border-0 p-0 lg:gap-0">
            <Section icon="box" title="Dados básicos">
              <div className={grid}>
                <Field label="Código">
                  <input name="code" required defaultValue={p.code} className={inputCls} />
                </Field>
                <Field label="Unidade de venda">
                  <select name="unit" defaultValue={p.unit} className={inputCls}>
                    {unitGroupsFor(settings.units, p.unit).map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.units.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Nome do produto">
                    <input name="name" required defaultValue={p.name} className={inputCls} />
                  </Field>
                </div>
                <Field label="Marca">
                  <input name="brand" defaultValue={v(p.brand)} className={inputCls} />
                </Field>
                <Field label="Categoria">
                  <input name="category" defaultValue={v(p.category)} className={inputCls} />
                </Field>
                <Field label="Linha / coleção">
                  <input name="line" defaultValue={v(p.line)} className={inputCls} />
                </Field>
                <label className="flex items-center gap-3 pt-7 text-sm">
                  <input type="checkbox" name="active" defaultChecked={p.active} className={check} />
                  Produto ativo (aparece nos pedidos)
                </label>
              </div>
            </Section>

            <Section icon="file" title="Descrição">
              <div className="grid gap-4">
                <Field label="Descrição curta" hint="Uma frase, aparece em listas.">
                  <input name="short_description" maxLength={200} defaultValue={v(p.short_description)} className={inputCls} />
                </Field>
                <Field label="Descrição completa">
                  <textarea name="description" rows={6} defaultValue={v(p.description)} className={`${inputCls} h-auto py-3`} />
                </Field>
              </div>
            </Section>

            <Section icon="tag" title="Venda e embalagem">
              <div className={grid}>
                <Field label="Unidades por embalagem" hint="Ex.: 12 peças por caixa.">
                  <input name="units_per_pack" inputMode="decimal" defaultValue={v(p.units_per_pack)} className={inputCls} />
                </Field>
                <Field label="Pedido mínimo">
                  <input name="min_order_qty" inputMode="decimal" defaultValue={v(p.min_order_qty)} className={inputCls} />
                </Field>
                <Field label="Vender em múltiplos de" hint="Ex.: 6 — só aceita 6, 12, 18…">
                  <input name="order_multiple" inputMode="decimal" defaultValue={v(p.order_multiple)} className={inputCls} />
                </Field>
                <Field label="Prazo de entrega (dias)">
                  <input name="lead_time_days" inputMode="numeric" defaultValue={v(p.lead_time_days)} className={inputCls} />
                </Field>
                <Field label="IPI (%)">
                  <input name="ipi_pct" inputMode="decimal" defaultValue={v(p.ipi_pct)} className={inputCls} />
                </Field>
                {canSeeCommissions ? (
                  <Field label="Comissão deste produto (%)" hint="Vazio = usa a regra da representada.">
                    <input name="commission_pct" inputMode="decimal" defaultValue={v(p.commission_pct)} className={inputCls} />
                  </Field>
                ) : null}
              </div>
            </Section>

            <Section icon="file" title="Medidas e dados fiscais">
              <div className={grid}>
                <Field label="Peso (kg)">
                  <input name="weight_kg" inputMode="decimal" defaultValue={v(p.weight_kg)} className={inputCls} />
                </Field>
                <Field label="Comprimento (cm)">
                  <input name="length_cm" inputMode="decimal" defaultValue={v(p.length_cm)} className={inputCls} />
                </Field>
                <Field label="Largura (cm)">
                  <input name="width_cm" inputMode="decimal" defaultValue={v(p.width_cm)} className={inputCls} />
                </Field>
                <Field label="Altura (cm)">
                  <input name="height_cm" inputMode="decimal" defaultValue={v(p.height_cm)} className={inputCls} />
                </Field>
                <Field label="Código de barras (EAN)">
                  <input name="ean" inputMode="numeric" defaultValue={v(p.ean)} className={inputCls} />
                </Field>
                <Field label="NCM">
                  <input name="ncm" inputMode="numeric" defaultValue={v(p.ncm)} className={inputCls} />
                </Field>
              </div>
            </Section>

            <Section icon="sparkle" title="Características" hint="Qualquer informação do seu ramo: cor, voltagem, sabor, material, validade…">
              <SpecsEditor initial={specs} disabled={!canManage} />
            </Section>

            <Section icon="tag" title="Etiquetas e observações">
              <div className="grid gap-4">
                <Field label="Etiquetas" hint="Separe por vírgula. Ex.: lançamento, promoção, importado.">
                  <input name="tags" defaultValue={tags} className={inputCls} />
                </Field>
                <Field label="Observações internas">
                  <textarea name="notes" rows={3} defaultValue={v(p.notes)} className={`${inputCls} h-auto py-3`} />
                </Field>
              </div>
            </Section>
          </fieldset>

          {canManage ? (
            <SaveBar note={<span className="hidden sm:inline">Dados do produto: lembre de salvar depois de alterar.</span>}>
              <SubmitButton className={`${primaryBtn} w-full sm:w-auto`} pending="Salvando…">
                Salvar alterações
              </SubmitButton>
            </SaveBar>
          ) : null}
        </form>

        <Section icon="box" title="Variações" hint="Cor, tamanho, sabor… Cada variação recebe seu próprio preço nas tabelas.">
          <ul className="divide-y divide-line">
            {(variants ?? []).map((vr) => {
              const attrs = Object.entries((vr.attributes ?? {}) as Record<string, string>)
                .map(([k, val]) => `${k}: ${val}`)
                .join(" · ");
              return (
                <li key={vr.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[13px]">{vr.code}</p>
                    <p className="text-sm text-muted">
                      {[attrs, vr.ean ? `EAN ${vr.ean}` : ""].filter(Boolean).join(" · ") || "Padrão"}
                    </p>
                  </div>
                  {canManage ? (
                    <form action={deleteVariant.bind(null, id, vr.id)}>
                      <button className={dangerBtn}>Excluir</button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {canManage ? (
            <form action={addVariantFor} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
              <Field label="Código da variação">
                <input name="v_code" required className={inputCls} />
              </Field>
              <Field label="EAN (opcional)">
                <input name="v_ean" inputMode="numeric" className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Atributos" hint="Formato: cor=azul, tamanho=M">
                  <input name="v_attrs" className={inputCls} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <button className={ghostBtn}>+ Adicionar variação</button>
              </div>
            </form>
          ) : null}
        </Section>
        <Section icon="receipt" title="Pedidos com este produto" hint="Os mais recentes primeiro.">
          {sales.length === 0 ? (
            <p className="text-sm text-muted">Este produto ainda não entrou em nenhum pedido.</p>
          ) : (
            <ul className="-mx-4 -my-4 divide-y divide-line sm:-mx-5 sm:-my-5">
              {sales.slice(0, 10).map((r, n) => (
                <li key={n}>
                  <Link href={`/pedidos/${r.orders.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-subtle sm:px-5">
                    <span className="w-20 shrink-0 truncate font-mono text-xs text-muted">
                      {formatOrderNumber(r.orders.number, settings)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.orders.customers?.name}</span>
                      <span className="block text-xs text-muted">{formatDate(r.orders.order_date)}</span>
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      {numText(Number(r.qty), 3)} × {brl(Number(r.list_price))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {canManage ? (
          <Section icon="trash" title="Excluir produto" hint="Produtos que já estão em pedidos não podem ser excluídos, só desativados.">
            <form action={deleteProduct.bind(null, id)} className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">Apaga o produto, as variações e as fotos.</p>
              <ConfirmButton message={`Excluir ${p.name}? Essa ação não pode ser desfeita.`} className={dangerBtn}>
                <Icon name="trash" size={15} />
                Excluir produto
              </ConfirmButton>
            </form>
          </Section>
        ) : null}
      </div>
    </>
  );
}
