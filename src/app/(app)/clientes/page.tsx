import { getContext } from "@/lib/session";
import { createCustomer } from "./actions";
import { safeQ } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { SearchBox } from "@/components/search";
import { Icon } from "@/components/icons";
import {
  PageHeader, Toolbar, Field, ErrorNote, EmptyState, Badge, Avatar, SheetForm, NewButton,
  TableShell, CardList, inputCls, th, td,
} from "@/components/ui";

const PATH = "/clientes";

function StatusBadge({ status }: { status: string }) {
  return <Badge tone={status === "ativo" ? "ok" : "neutral"}>{status === "ativo" ? "Ativo" : status}</Badge>;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; novo?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const q = safeQ(sp.q);
  const { supabase, canManage } = await getContext();

  let query = supabase
    .from("customers")
    .select("id, name, cnpj, address, status")
    .order("name");
  if (q) query = query.or(`name.ilike.*${q}*,cnpj.ilike.*${q}*,address.ilike.*${q}*`);
  const { data } = await query;
  const customers = data ?? [];

  const sheetOpen = sp.novo === "1" || !!sp.erro;
  const empty = customers.length === 0;

  return (
    <>
      <PageHeader
        title="Clientes"
        hint={canManage ? "Todos os clientes do escritório." : "Os clientes da sua carteira."}
        action={<NewButton label="Novo cliente" />}
      />

      {empty && !q ? (
        <EmptyState icon="users" title="Nenhum cliente ainda" action={<NewButton label="Novo cliente" />}>
          Cadastre os clientes que você atende. Eles ficam disponíveis na hora de fazer um pedido.
        </EmptyState>
      ) : (
        <>
          <Toolbar>
            <div className="lg:hidden"><SearchBox placeholder="Buscar cliente" /></div>
            <span className="ml-auto hidden text-sm tabular-nums text-muted sm:block">
              {customers.length} {customers.length === 1 ? "cliente" : "clientes"}
            </span>
          </Toolbar>

          {empty ? (
            <EmptyState icon="search" title="Nada encontrado">
              Nenhum cliente combina com “{q}”.
            </EmptyState>
          ) : (
            <>
              <TableShell>
                <thead className="border-b border-line bg-subtle">
                  <tr>
                    <th className={th}>Cliente</th>
                    <th className={th}>Endereço</th>
                    <th className={th}>Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {customers.map((c) => (
                    <tr key={c.id} className="transition hover:bg-subtle">
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{c.name}</p>
                            {c.cnpj ? <p className="font-mono text-xs text-muted">{c.cnpj}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className={`${td} text-ink-2`}>
                        {c.address || <span className="text-faint">—</span>}
                      </td>
                      <td className={td}>
                        <StatusBadge status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>

              <CardList>
                {customers.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 px-4 py-3.5">
                    <Avatar name={c.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-snug">{c.name}</p>
                        <StatusBadge status={c.status} />
                      </div>
                      {c.cnpj ? <p className="font-mono text-xs text-muted">{c.cnpj}</p> : null}
                      {c.address ? (
                        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
                          <Icon name="pin" size={13} className="mt-1 shrink-0" />
                          {c.address}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </CardList>
            </>
          )}
        </>
      )}

      <Sheet
        open={sheetOpen}
        title="Novo cliente"
        description="Entra na sua carteira."
        closeHref={PATH}
      >
        <SheetForm action={createCustomer} closeHref={PATH} submitLabel="Salvar">
          <div className="sm:col-span-2">
            <ErrorNote message={sp.erro} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Nome ou razão social">
              <input name="name" required className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="CNPJ">
              <input name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Endereço">
              <input name="address" className={inputCls} />
            </Field>
          </div>
        </SheetForm>
      </Sheet>
    </>
  );
}
