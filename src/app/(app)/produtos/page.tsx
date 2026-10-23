import Link from "next/link";
import { getContext } from "@/lib/session";
import { createProduct } from "./actions";
import { unitGroupsFor, unitLabel } from "@/lib/units";
import { getSettings } from "@/lib/settings";
import { productImageUrl } from "@/lib/storage";
import { numText } from "@/lib/orders";
import { brl, safeQ } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { SearchBox } from "@/components/search";
import { UrlSelect } from "@/components/url-select";
import {
  PageHeader, Toolbar, Field, ErrorNote, OkNote, EmptyState, Badge, SheetForm, NewButton, TableShell,
  CardList, RowLink, FilterPill, Segmented, inputCls, primaryBtn, ghostBtn, th, td, tr,
} from "@/components/ui";

const PATH = "/produtos";

type Img = { path: string; is_cover: boolean; position: number };

function coverOf(images: Img[] | null) {
  const list = images ?? [];
  return list.find((i) => i.is_cover) ?? [...list].sort((a, b) => a.position - b.position)[0];
}

function Thumb({ images, size }: { images: Img[] | null; size: number }) {
  const img = coverOf(images);
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-subtle text-faint"
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={productImageUrl(img.path)} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Icon name="image" size={Math.round(size * 0.38)} />
      )}
    </span>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    erro?: string; ok?: string; novo?: string; q?: string; rep?: string; cat?: string; status?: string; ver?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = safeQ(sp.q);
  const { supabase, canManage } = await getContext();
  const settings = await getSettings();
  const view = sp.ver === "lista" ? "lista" : "grade";
  const status = sp.status === "inativos" || sp.status === "todos" ? sp.status : "ativos";

  let productsQuery = supabase
    .from("products")
    .select("id, code, name, unit, active, brand, category, principal_id, principals(name), product_images(path, is_cover, position)")
    .order("name");
  if (q) productsQuery = productsQuery.or(`name.ilike.*${q}*,code.ilike.*${q}*,brand.ilike.*${q}*`);
  if (sp.rep) productsQuery = productsQuery.eq("principal_id", sp.rep);
  if (sp.cat) productsQuery = productsQuery.eq("category", sp.cat);

  const [{ data: principalsData }, { data: productsData }, { data: cats }, { data: sold }] = await Promise.all([
    supabase.from("principals").select("id, name").eq("active", true).order("name"),
    productsQuery,
    supabase.from("products").select("category").not("category", "is", null),
    // Vendas recentes para mostrar último preço e quantidade vendida de cada produto.
    supabase
      .from("order_items")
      .select("qty, list_price, created_at, product_variants(product_id), orders!inner(status)")
      .not("variant_id", "is", null)
      .neq("orders.status", "cancelado")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  const principals = principalsData ?? [];
  const all = productsData ?? [];
  const categories = [...new Set((cats ?? []).map((c) => c.category as string).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  const stats = new Map<string, { last: number; qty: number }>();
  for (const s of sold ?? []) {
    const pid = (s.product_variants as unknown as { product_id: string } | null)?.product_id;
    if (!pid) continue;
    const cur = stats.get(pid);
    if (cur) cur.qty += Number(s.qty);
    else stats.set(pid, { last: Number(s.list_price), qty: Number(s.qty) });
  }

  const nActive = all.filter((p) => p.active).length;
  const products = status === "todos" ? all : all.filter((p) => (status === "ativos" ? p.active : !p.active));

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, rep: sp.rep, cat: sp.cat, status: sp.status, ver: sp.ver, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${PATH}?${s}` : PATH;
  };

  const sheetOpen = canManage && principals.length > 0 && (sp.novo === "1" || !!sp.erro);
  const filtering = !!q || !!sp.rep || !!sp.cat;
  const noPrincipals = principals.length === 0;

  return (
    <>
      <PageHeader
        title="Produtos"
        hint="O catálogo de cada representada, com foto, unidade e o último preço praticado."
        action={
          <div className="flex items-center gap-2">
            <Link href="/produtos/opcoes" className={ghostBtn}>
              <Icon name="sparkle" size={15} />
              Cores, tamanhos e opções
            </Link>
            {canManage && !noPrincipals ? <NewButton label="Novo produto" fab /> : null}
          </div>
        }
      />

      {sp.ok ? (
        <div className="mb-4">
          <OkNote message={sp.ok} />
        </div>
      ) : null}

      {noPrincipals ? (
        <EmptyState
          icon="box"
          title="Cadastre sua primeira representada para começar"
          action={
            <Link href="/representadas?novo=1" className={primaryBtn}>
              Nova representada
            </Link>
          }
        >
          Todo produto pertence a uma fábrica. Cadastre a primeira para começar o catálogo.
        </EmptyState>
      ) : all.length === 0 && !filtering ? (
        <EmptyState icon="box" title="Nenhum produto ainda" action={canManage ? <NewButton label="Novo produto" /> : null}>
          O catálogo é opcional: nos pedidos você também pode digitar os itens à mão. Com ele, o
          pedido fica mais rápido e você mostra fotos ao cliente.
        </EmptyState>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented>
              <FilterPill href={qs({ status: undefined })} active={status === "ativos"} count={nActive}>
                Ativos
              </FilterPill>
              <FilterPill href={qs({ status: "inativos" })} active={status === "inativos"} count={all.length - nActive}>
                Inativos
              </FilterPill>
              <FilterPill href={qs({ status: "todos" })} active={status === "todos"} count={all.length}>
                Todos
              </FilterPill>
            </Segmented>
            <div className="ml-auto inline-flex rounded-[0.6rem] bg-hover p-0.5" role="group" aria-label="Modo de exibição">
              {(["grade", "lista"] as const).map((v) => (
                <Link
                  key={v}
                  href={qs({ ver: v === "grade" ? undefined : v })}
                  scroll={false}
                  aria-current={view === v ? "true" : undefined}
                  title={v === "grade" ? "Grade com fotos" : "Lista"}
                  className={`inline-flex h-9 w-10 items-center justify-center rounded-lg transition sm:h-8 sm:w-9 ${
                    view === v ? "bg-surface text-ink shadow-panel" : "text-muted hover:text-ink-2"
                  }`}
                >
                  <Icon name={v === "grade" ? "grid" : "menu"} size={16} />
                  <span className="sr-only">{v === "grade" ? "Grade" : "Lista"}</span>
                </Link>
              ))}
            </div>
          </div>

          <Toolbar>
            <SearchBox placeholder="Buscar por nome, código ou marca" hint />
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              <UrlSelect
                param="rep"
                ariaLabel="Representada"
                allLabel="Todas as representadas"
                options={principals.map((p) => ({ value: p.id, label: p.name }))}
              />
              <UrlSelect
                param="cat"
                ariaLabel="Categoria"
                allLabel="Todas as categorias"
                options={categories.map((c) => ({ value: c, label: c }))}
              />
            </div>
          </Toolbar>

          {products.length === 0 ? (
            <EmptyState icon="search" title="Nada encontrado" compact>
              Nenhum produto combina com os filtros escolhidos.
            </EmptyState>
          ) : view === "grade" ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((p) => {
                const principal = p.principals as unknown as { name: string } | null;
                const img = coverOf(p.product_images as unknown as Img[]);
                const st = stats.get(p.id);
                return (
                  <li key={p.id}>
                    <Link
                      href={`${PATH}/${p.id}`}
                      className="group block overflow-hidden rounded-xl border border-line bg-surface transition hover:border-line-strong hover:shadow-panel"
                    >
                      <span className="relative block aspect-square overflow-hidden bg-subtle">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={productImageUrl(img.path)}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-faint">
                            <Icon name="image" size={28} />
                          </span>
                        )}
                        {!p.active ? (
                          <span className="absolute left-2 top-2">
                            <Badge>Inativo</Badge>
                          </span>
                        ) : null}
                      </span>
                      <span className="block p-3">
                        <span className="block truncate font-mono text-[11px] text-muted">{p.code}</span>
                        <span className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight text-ink">
                          {p.name}
                        </span>
                        <span className="mt-2 flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted">{principal?.name}</span>
                          <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">
                            {st ? brl(st.last) : <span className="text-xs font-normal text-faint">{unitLabel(p.unit)}</span>}
                          </span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <TableShell>
                <thead>
                  <tr>
                    <th className={th}>Produto</th>
                    <th className={th}>Representada</th>
                    <th className={th}>Categoria</th>
                    <th className={th}>Unidade</th>
                    <th className={`${th} text-right`}>Último preço</th>
                    <th className={`${th} text-right`}>Vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const principal = p.principals as unknown as { name: string } | null;
                    const st = stats.get(p.id);
                    return (
                      <tr key={p.id} className={`${tr} ${p.active ? "" : "text-muted"}`}>
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <Thumb images={p.product_images as unknown as Img[]} size={36} />
                            <div className="min-w-0">
                              <RowLink href={`${PATH}/${p.id}`} className={`block truncate font-medium ${p.active ? "text-ink" : "text-ink-2"}`}>
                                {p.name}
                              </RowLink>
                              <p className="truncate font-mono text-xs text-muted">
                                {p.code}
                                {p.brand ? <span className="font-sans"> · {p.brand}</span> : null}
                              </p>
                            </div>
                            {!p.active ? <Badge>Inativo</Badge> : null}
                          </div>
                        </td>
                        <td className={`${td} text-ink-2`}>{principal?.name}</td>
                        <td className={`${td} text-ink-2`}>{p.category || <span className="text-faint">—</span>}</td>
                        <td className={`${td} text-ink-2`}>{unitLabel(p.unit)}</td>
                        <td className={`${td} text-right font-medium tabular-nums`}>
                          {st ? brl(st.last) : <span className="font-normal text-faint">—</span>}
                        </td>
                        <td className={`${td} text-right tabular-nums text-ink-2`}>
                          {st ? numText(st.qty, 3) : <span className="text-faint">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>

              <CardList>
                {products.map((p) => {
                  const principal = p.principals as unknown as { name: string } | null;
                  const st = stats.get(p.id);
                  return (
                    <li key={p.id}>
                      <Link href={`${PATH}/${p.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-hover">
                        <Thumb images={p.product_images as unknown as Img[]} size={48} />
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-[15px] font-medium ${p.active ? "" : "text-muted"}`}>{p.name}</p>
                          <p className="truncate text-[13px] text-muted">
                            <span className="font-mono text-xs">{p.code}</span>
                            {principal?.name ? ` · ${principal.name}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-semibold tabular-nums">{st ? brl(st.last) : ""}</span>
                          <span className="block text-xs text-muted">{unitLabel(p.unit)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </CardList>
            </>
          )}
        </>
      )}

      <Sheet
        open={sheetOpen}
        title="Novo produto"
        description="Só o básico. Na ficha você completa fotos, descrição, medidas e variações."
        closeHref={PATH}
      >
        <SheetForm action={createProduct} closeHref={PATH} submitLabel="Salvar produto">
          <ErrorNote message={sp.erro} />
          <Field label="Representada" className="sm:col-span-2">
            <select name="principal_id" required className={inputCls} defaultValue={sp.rep ?? (principals.length === 1 ? principals[0].id : "")}>
              <option value="" disabled>
                Escolha
              </option>
              {principals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nome do produto" className="sm:col-span-2">
            <input name="name" required placeholder="Ex.: Camiseta básica algodão" className={inputCls} />
          </Field>
          <Field label="Código" hint="O código da fábrica.">
            <input name="code" required className={`${inputCls} font-mono`} />
          </Field>
          <Field label="Unidade de venda">
            <select name="unit" required className={inputCls} defaultValue={settings.units.includes("unidade") ? "unidade" : settings.units[0]}>
              {unitGroupsFor(settings.units).map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.units.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </SheetForm>
      </Sheet>
    </>
  );
}
