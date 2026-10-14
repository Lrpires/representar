import Link from "next/link";
import { getContext } from "@/lib/session";
import { createCustomer } from "./actions";
import { CustomerFields } from "./fields";
import { safeQ } from "@/lib/format";
import { digits } from "@/lib/br";
import { WhatsAppButton } from "@/components/whatsapp";
import { Sheet } from "@/components/sheet";
import { SearchBox } from "@/components/search";
import { Icon } from "@/components/icons";
import {
  PageHeader, Toolbar, ErrorNote, OkNote, EmptyState, Badge, Avatar, SheetForm, NewButton,
  TableShell, CardList, RowLink, Count, th, td, tr,
} from "@/components/ui";

const PATH = "/clientes";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; novo?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const q = safeQ(sp.q);
  const { supabase, canManage } = await getContext();

  let query = supabase
    .from("customers")
    .select("id, name, cnpj, contact_name, phone, city, state, status, principals(name)")
    .order("name");
  if (q) {
    // CNPJ é guardado formatado; quem digita só números também encontra.
    const d = digits(q);
    const cnpjPattern = d.length >= 3 && d.length === q.replace(/[.\-/\s]/g, "").length ? `*${d.split("").join("*")}*` : `*${q}*`;
    query = query.or(`name.ilike.*${q}*,cnpj.ilike.${cnpjPattern}`);
  }

  const [{ data }, { data: principals }] = await Promise.all([
    query,
    supabase.from("principals").select("id, name").eq("active", true).order("name"),
  ]);
  const customers = data ?? [];

  const sheetOpen = sp.novo === "1";
  const empty = customers.length === 0;

  return (
    <>
      <PageHeader
        title="Clientes"
        hint={canManage ? "Todos os clientes do escritório." : "Os clientes da sua carteira."}
        action={<NewButton label="Novo cliente" fab />}
      />

      {sp.ok ? (
        <div className="mb-4">
          <OkNote message={sp.ok} />
        </div>
      ) : null}

      {empty && !q ? (
        <EmptyState icon="users" title="Nenhum cliente cadastrado" action={<NewButton label="Novo cliente" />}>
          Cadastre as lojas e empresas que você atende. Elas ficam disponíveis na hora de fazer um
          pedido.
        </EmptyState>
      ) : (
        <>
          <Toolbar>
            <SearchBox placeholder="Buscar por nome ou CNPJ" hint />
            <Count n={customers.length} one="cliente" many="clientes" />
          </Toolbar>

          {empty ? (
            <EmptyState icon="search" title="Nada encontrado" compact>
              Nenhum cliente combina com “{q}”. Confira a grafia ou busque pelo CNPJ.
            </EmptyState>
          ) : (
            <>
              <TableShell>
                <thead>
                  <tr>
                    <th className={th}>Cliente</th>
                    <th className={th}>Cidade</th>
                    <th className={th}>Telefone</th>
                    <th className={th}>Representada</th>
                    <th className={`${th} w-14`}>
                      <span className="sr-only">WhatsApp</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const principal = (c.principals as unknown as { name: string } | null)?.name;
                    return (
                      <tr key={c.id} className={tr}>
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} size={30} />
                            <div className="min-w-0">
                              <RowLink href={`${PATH}/${c.id}`} className="block truncate font-medium text-ink">
                                {c.name}
                              </RowLink>
                              <p className="truncate text-xs text-muted">
                                {c.contact_name || (c.cnpj ? <span className="font-mono">{c.cnpj}</span> : "Sem contato")}
                              </p>
                            </div>
                            {c.status !== "ativo" ? <Badge>Inativo</Badge> : null}
                          </div>
                        </td>
                        <td className={`${td} text-ink-2`}>{[c.city, c.state].filter(Boolean).join(" / ") || <span className="text-faint">—</span>}</td>
                        <td className={`${td} tabular-nums text-ink-2`}>{c.phone || <span className="text-faint">—</span>}</td>
                        <td className={`${td} text-ink-2`}>{principal || <span className="text-faint">—</span>}</td>
                        <td className={`${td} text-right`}>
                          <WhatsAppButton phone={c.phone} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>

              <CardList>
                {customers.map((c) => (
                  <li key={c.id} className="relative flex items-center gap-3 px-4 py-3 active:bg-hover">
                    <Avatar name={c.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`${PATH}/${c.id}`}
                        className="block truncate text-[15px] font-medium after:absolute after:inset-0"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-0.5 truncate text-[13px] text-muted">
                        {[[c.city, c.state].filter(Boolean).join("/"), c.contact_name].filter(Boolean).join(" · ") || c.phone || "Sem dados de contato"}
                      </p>
                    </div>
                    <WhatsAppButton phone={c.phone} />
                  </li>
                ))}
              </CardList>
            </>
          )}
        </>
      )}

      <Sheet open={sheetOpen} title="Novo cliente" description="Entra na sua carteira e já pode receber pedidos." closeHref={PATH}>
        <SheetForm action={createCustomer} closeHref={PATH} submitLabel="Salvar cliente">
          <ErrorNote message={sp.erro} />
          <CustomerFields principals={principals ?? []} />
        </SheetForm>
      </Sheet>
    </>
  );
}
