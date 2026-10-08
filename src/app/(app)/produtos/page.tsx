import Link from "next/link";
import { getContext } from "@/lib/session";
import { createProduct } from "./actions";
import { UNITS, unitLabel } from "@/lib/units";
import { safeQ } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { SearchBox } from "@/components/search";
import {
  PageHeader, Toolbar, Field, ErrorNote, EmptyState, Badge, SheetForm, NewButton, TableShell,
  CardList, inputCls, primaryBtn, th, td,
} from "@/components/ui";

const PATH = "/produtos";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; novo?: string; q?: string; rep?: string }>;
}) {
  const sp = await searchParams;
  const q = safeQ(sp.q);
  const { supabase, canManage } = await getContext();

  let productsQuery = supabase
    .from("products")
    .select("id, code, name, unit, principal_id, principals(name)")
    .order("name");
  if (q) productsQuery = productsQuery.or(`name.ilike.*${q}*,code.ilike.*${q}*`);
  if (sp.rep) productsQuery = productsQuery.eq("principal_id", sp.rep);

  const [{ data: principalsData }, { data: productsData }] = await Promise.all([
    supabase.from("principals").select("id, name").eq("active", true).order("name"),
    productsQuery,
  ]);
  const principals = principalsData ?? [];
  const products = productsData ?? [];

  const sheetOpen = canManage && principals.length > 0 && (sp.novo === "1" || !!sp.erro);
  const filtering = !!q || !!sp.rep;
  const empty = products.length === 0;

  const chip = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[13px] transition ${
      active
        ? "bg-ink font-medium text-white"
        : "border border-line bg-white text-ink-2 hover:bg-subtle"
    }`;

  const noPrincipals = principals.length === 0;

  return (
    <>
      <PageHeader
        title="Produtos"
        hint="Cada produto pertence a uma representada e é vendido em uma unidade."
        action={canManage && !noPrincipals ? <NewButton label="Novo produto" /> : null}
      />

      {noPrincipals ? (
        <EmptyState
          icon="box"
          title="Cadastre uma representada primeiro"
          action={
            <Link href="/representadas" className={primaryBtn}>
              Ir para representadas
            </Link>
          }
        >
          Todo produto pertence a uma fábrica. Cadastre a primeira para começar o catálogo.
        </EmptyState>
      ) : empty && !filtering ? (
        <EmptyState
          icon="box"
          title="Nenhum produto ainda"
          action={canManage ? <NewButton label="Novo produto" /> : null}
        >
          Cadastre os produtos de cada representada. Cada um nasce com uma variação padrão onde
          você poderá lançar preço.
        </EmptyState>
      ) : (
        <>
          <Toolbar>
            <div className="lg:hidden"><SearchBox placeholder="Buscar produto" /></div>
            <span className="ml-auto hidden text-sm tabular-nums text-muted sm:block">
              {products.length} {products.length === 1 ? "produto" : "produtos"}
            </span>
          </Toolbar>

          {principals.length > 1 ? (
            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
              <Link href={q ? `${PATH}?q=${encodeURIComponent(q)}` : PATH} className={chip(!sp.rep)}>
                Todas
              </Link>
              {principals.map((p) => (
                <Link
                  key={p.id}
                  href={`${PATH}?rep=${p.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={chip(sp.rep === p.id)}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          ) : null}

          {empty ? (
            <EmptyState icon="search" title="Nada encontrado">
              Nenhum produto combina com os filtros escolhidos.
            </EmptyState>
          ) : (
            <>
              <TableShell>
                <thead className="border-b border-line bg-subtle">
                  <tr>
                    <th className={th}>Código</th>
                    <th className={th}>Produto</th>
                    <th className={th}>Representada</th>
                    <th className={th}>Unidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {products.map((p) => {
                    const principal = p.principals as unknown as { name: string } | null;
                    return (
                      <tr key={p.id} className="transition hover:bg-subtle">
                        <td className={`${td} font-mono text-[13px] text-muted`}>{p.code}</td>
                        <td className={`${td} font-medium`}>{p.name}</td>
                        <td className={`${td} text-ink-2`}>{principal?.name}</td>
                        <td className={td}>
                          <Badge>{unitLabel(p.unit)}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>

              <CardList>
                {products.map((p) => {
                  const principal = p.principals as unknown as { name: string } | null;
                  return (
                    <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="font-medium leading-snug">{p.name}</p>
                        <p className="mt-1 text-sm text-muted">
                          <span className="font-mono text-xs">{p.code}</span>
                          {principal?.name ? ` · ${principal.name}` : ""}
                        </p>
                      </div>
                      <Badge>{unitLabel(p.unit)}</Badge>
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
        description="Escolha a representada e a unidade de venda."
        closeHref={PATH}
      >
        <SheetForm action={createProduct} closeHref={PATH} submitLabel="Salvar">
          <div className="sm:col-span-2">
            <ErrorNote message={sp.erro} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Representada">
              <select name="principal_id" required className={inputCls} defaultValue={sp.rep ?? ""}>
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
          </div>
          <Field label="Código">
            <input name="code" required className={inputCls} />
          </Field>
          <Field label="Unidade de venda">
            <select name="unit" required className={inputCls} defaultValue="unidade">
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nome do produto">
              <input name="name" required className={inputCls} />
            </Field>
          </div>
        </SheetForm>
      </Sheet>
    </>
  );
}
