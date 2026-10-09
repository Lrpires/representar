import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import {
  updateProduct, addVariant, deleteVariant, setCoverImage, deleteImage,
} from "./actions";
import { UNIT_GROUPS } from "@/lib/units";
import { Icon, type IconName } from "@/components/icons";
import {
  PageHeader, Field, ErrorNote, OkNote, Badge, inputCls, primaryBtn, ghostBtn,
} from "@/components/ui";
import ImageManager from "./ImageManager";
import SpecsEditor from "./SpecsEditor";
import type { ReactNode } from "react";

const PATH = "/produtos";

function Section({
  icon, title, hint, children,
}: { icon: IconName; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-subtle text-pen">
          <Icon name={icon} size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {hint ? <p className="mt-0.5 text-[13px] leading-snug text-muted">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

const grid = "grid gap-4 sm:grid-cols-2";
const check = "h-5 w-5 shrink-0 rounded border-line-strong accent-[#0b0b0f]";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, orgId, canManage } = await getContext();

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

  const principal = p.principals as unknown as { name: string } | null;
  const v = (x: string | number | null | undefined) => (x == null ? "" : String(x));
  const save = updateProduct.bind(null, id);
  const addVariantFor = addVariant.bind(null, id);
  const specs = Object.entries((p.specs ?? {}) as Record<string, string>);
  const tags = ((p.tags ?? []) as string[]).join(", ");

  async function cover(fd: FormData) {
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
        hint={[principal?.name, p.code].filter(Boolean).join(" · ")}
        back={{ href: PATH, label: "Produtos" }}
        action={<Badge tone={p.active ? "ok" : "neutral"}>{p.active ? "Ativo" : "Inativo"}</Badge>}
      />

      <div className="mb-4 max-w-3xl empty:hidden [&>*]:mb-3">
        <ErrorNote message={sp.erro} />
        <OkNote message={sp.ok} />
      </div>

      <div className="grid max-w-3xl gap-4 lg:gap-5">
        <Section icon="image" title="Imagens" hint="As fotos são reduzidas automaticamente. A capa aparece na lista.">
          <ImageManager
            productId={id}
            orgId={orgId}
            images={(images ?? []).map((i) => ({ id: i.id, path: i.path, is_cover: i.is_cover }))}
            canManage={canManage}
            onSetCover={cover}
            onDelete={remove}
          />
        </Section>

        <form action={save} className="grid gap-4 lg:gap-5">
          <fieldset disabled={!canManage} className="m-0 grid min-w-0 gap-4 border-0 p-0 lg:gap-5">
            <Section icon="box" title="Dados básicos">
              <div className={grid}>
                <Field label="Código">
                  <input name="code" required defaultValue={p.code} className={inputCls} />
                </Field>
                <Field label="Unidade de venda">
                  <select name="unit" defaultValue={p.unit} className={inputCls}>
                    {UNIT_GROUPS.map((g) => (
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
                <Field label="Comissão deste produto (%)" hint="Vazio = usa a regra da representada.">
                  <input name="commission_pct" inputMode="decimal" defaultValue={v(p.commission_pct)} className={inputCls} />
                </Field>
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
            <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 flex justify-end lg:bottom-4">
              <button className={`${primaryBtn} w-full shadow-float sm:w-auto sm:px-8`}>Salvar alterações</button>
            </div>
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
                      <button className="rounded-lg px-2 py-1 text-[13px] text-alert hover:bg-subtle">Excluir</button>
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
      </div>
    </>
  );
}
