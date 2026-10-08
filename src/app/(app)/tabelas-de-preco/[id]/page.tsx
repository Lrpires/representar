import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { upsertPriceItem } from "../actions";
import { brl, formatDate, todayISO } from "@/lib/format";
import { unitLabel } from "@/lib/units";
import { Sheet } from "@/components/sheet";
import { Icon } from "@/components/icons";
import {
  PageHeader, Field, ErrorNote, EmptyState, Badge, SheetForm, NewButton, TableShell, CardList,
  Notice, inputCls, th, td,
} from "@/components/ui";

type Product = { name: string; code: string; unit: string };
type Variant = { code: string; attributes: Record<string, unknown> | null; products: Product };

function variantExtra(v: Variant): string {
  return Object.values(v.attributes ?? {}).filter(Boolean).join(", ");
}

function variantLabel(v: Variant): string {
  const extra = variantExtra(v);
  return `${v.products.name} · ${v.code}${extra ? ` (${extra})` : ""}`;
}

export default async function PriceTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; novo?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, canManage } = await getContext();

  const { data: table } = await supabase
    .from("price_tables")
    .select("id, name, valid_from, valid_to, principal_id, principals(name)")
    .eq("id", id)
    .maybeSingle();
  if (!table) notFound();

  const [{ data: itemsData }, { data: variantsData }] = await Promise.all([
    supabase
      .from("price_items")
      .select("id, price, product_variants(code, attributes, products(name, code, unit))")
      .eq("price_table_id", id),
    supabase
      .from("product_variants")
      .select("id, code, attributes, products!inner(name, code, unit, principal_id)")
      .eq("products.principal_id", table.principal_id)
      .eq("active", true)
      .order("code"),
  ]);

  const items = (itemsData ?? [])
    .map((i) => {
      const variant = i.product_variants as unknown as Variant;
      return { id: i.id as string, price: i.price as number, variant };
    })
    .sort((a, b) => a.variant.products.name.localeCompare(b.variant.products.name, "pt-BR"));

  const variants = (variantsData ?? []).map((v) => ({
    id: v.id as string,
    label: variantLabel(v as unknown as Variant),
  }));

  const principal = table.principals as unknown as { name: string } | null;
  const addPrice = upsertPriceItem.bind(null, id);
  const path = `/tabelas-de-preco/${id}`;

  const today = todayISO();
  const st =
    table.valid_from > today
      ? { label: "Futura", tone: "warn" as const }
      : table.valid_to && table.valid_to < today
        ? { label: "Encerrada", tone: "neutral" as const }
        : { label: "Vigente", tone: "ok" as const };

  const noVariants = variants.length === 0;
  const sheetOpen = canManage && !noVariants && (sp.novo === "1" || !!sp.erro);

  return (
    <>
      <PageHeader
        back={{ href: "/tabelas-de-preco", label: "Tabelas de preço" }}
        title={table.name}
        hint={principal?.name}
        action={canManage && !noVariants ? <NewButton label="Lançar preço" /> : null}
      />

      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <Badge tone={st.tone}>{st.label}</Badge>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="calendar" size={14} />
          {formatDate(table.valid_from)}
          {table.valid_to ? ` até ${formatDate(table.valid_to)}` : " sem data final"}
        </span>
        <span className="tabular-nums">
          {items.length} {items.length === 1 ? "preço lançado" : "preços lançados"}
        </span>
      </div>

      {canManage && noVariants ? (
        <Notice href="/produtos" cta="Cadastrar produtos">
          Essa representada ainda não tem produtos.
        </Notice>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon="tag"
          title="Nenhum preço lançado"
          action={canManage && !noVariants ? <NewButton label="Lançar preço" /> : null}
        >
          Escolha um produto e informe o preço. Você pode lançar vários em sequência.
        </EmptyState>
      ) : (
        <>
          <TableShell>
            <thead className="border-b border-line bg-subtle">
              <tr>
                <th className={th}>Produto</th>
                <th className={th}>Código</th>
                <th className={th}>Unidade</th>
                <th className={`${th} text-right`}>Preço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((i) => (
                <tr key={i.id} className="transition hover:bg-subtle">
                  <td className={td}>
                    <p className="font-medium">{i.variant.products.name}</p>
                    {variantExtra(i.variant) ? (
                      <p className="text-xs text-muted">{variantExtra(i.variant)}</p>
                    ) : null}
                  </td>
                  <td className={`${td} font-mono text-[13px] text-muted`}>{i.variant.code}</td>
                  <td className={td}>
                    <Badge>{unitLabel(i.variant.products.unit)}</Badge>
                  </td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>{brl(i.price)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>

          <CardList>
            {items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{i.variant.products.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    <span className="font-mono text-xs">{i.variant.code}</span>
                    {` · por ${unitLabel(i.variant.products.unit).toLowerCase()}`}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{brl(i.price)}</p>
              </li>
            ))}
          </CardList>
        </>
      )}

      <Sheet
        open={sheetOpen}
        title="Lançar preço"
        description="Se o produto já tem preço nessa tabela, ele é atualizado."
        closeHref={path}
      >
        <SheetForm
          action={addPrice}
          closeHref={path}
          submitLabel="Salvar preço"
          extraSubmit={{ name: "again", value: "1", label: "Salvar e lançar outro" }}
        >
          <div className="sm:col-span-2">
            <ErrorNote message={sp.erro} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Produto">
              <select name="variant_id" required className={inputCls} defaultValue="">
                <option value="" disabled>
                  Escolha
                </option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Preço (R$)">
              <input name="price" inputMode="decimal" required placeholder="12,50" className={inputCls} />
            </Field>
          </div>
        </SheetForm>
      </Sheet>
    </>
  );
}
