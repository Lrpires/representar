import { getContext } from "@/lib/session";
import { createPrincipal, setPrincipalActive } from "./actions";
import { pct, safeQ } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { logoUrl } from "@/lib/storage";
import { MaskedInput } from "@/components/masked-input";
import { AddressFields } from "@/components/address-fields";
import { SearchBox } from "@/components/search";
import {
  PageHeader, Toolbar, Field, FormGroup, ErrorNote, OkNote, EmptyState, Badge, Avatar, SheetForm, NewButton,
  FilterPill, Segmented, Switch, TableShell, CardList, ListRow, RowLink, Count, inputCls, th, td, tr,
} from "@/components/ui";

const PATH = "/representadas";

export default async function PrincipalsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; novo?: string; q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = safeQ(sp.q);
  const { supabase, canManage, canSeeCommissions: seeComm } = await getContext();

  let query = supabase
    .from("principals")
    // % e prazo da comissão vêm da tabela protegida (migração 027): para quem não vê comissões, vêm vazios.
    .select("*, principal_commission_terms(default_commission_pct, commission_close_mode, commission_days_after)")
    .order("name");
  if (q) query = query.or(`name.ilike.*${q}*,cnpj.ilike.*${q}*`);
  const { data } = await query;
  type Terms = { default_commission_pct: number | null; commission_close_mode: string; commission_days_after: number | null };
  const all = (data ?? []).map((row) => {
    const t = row.principal_commission_terms as unknown as Terms | Terms[] | null;
    const terms = (Array.isArray(t) ? t[0] : t) ?? { default_commission_pct: null, commission_close_mode: "", commission_days_after: null };
    return { ...row, ...terms };
  });

  const status = sp.status === "ativas" || sp.status === "inativas" ? sp.status : "todas";
  const nActive = all.filter((p) => p.active).length;
  const list =
    status === "ativas" ? all.filter((p) => p.active) : status === "inativas" ? all.filter((p) => !p.active) : all;

  const href = (s: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (s !== "todas") p.set("status", s);
    const qs = p.toString();
    return qs ? `${PATH}?${qs}` : PATH;
  };

  const sheetOpen = canManage && (sp.novo === "1" || !!sp.erro);
  const noneAtAll = all.length === 0 && !q;
  const place = (p: { city: string | null; state: string | null }) =>
    p.city ? `${p.city}${p.state ? ` / ${p.state}` : ""}` : "";
  const payDays = (p: { commission_close_mode: string; commission_days_after: number | null }) =>
    p.commission_close_mode === "dias_apos_evento" && p.commission_days_after != null
      ? `${p.commission_days_after} ${p.commission_days_after === 1 ? "dia" : "dias"}`
      : "";

  return (
    <>
      <PageHeader
        title="Representadas"
        hint="As fábricas e marcas que você representa, com a regra de comissão de cada uma."
        action={canManage ? <NewButton label="Nova representada" fab /> : null}
      />

      {sp.ok ? (
        <div className="mb-4">
          <OkNote message={sp.ok} />
        </div>
      ) : null}

      {noneAtAll ? (
        <EmptyState
          icon="factory"
          title="Cadastre as empresas que você representa"
          action={canManage ? <NewButton label="Nova representada" /> : null}
        >
          Informe o nome e a comissão padrão de cada fábrica. A comissão é sugerida
          automaticamente em cada pedido.
        </EmptyState>
      ) : (
        <>
          <Toolbar>
            <Segmented>
              <FilterPill href={href("todas")} active={status === "todas"} count={all.length}>
                Todas
              </FilterPill>
              <FilterPill href={href("ativas")} active={status === "ativas"} count={nActive}>
                Ativas
              </FilterPill>
              <FilterPill href={href("inativas")} active={status === "inativas"} count={all.length - nActive}>
                Inativas
              </FilterPill>
            </Segmented>
            <div className="ml-auto w-full sm:w-72">
              <SearchBox placeholder="Buscar representada" className="w-full" hint />
            </div>
          </Toolbar>

          {list.length === 0 ? (
            <EmptyState icon="search" title="Nada encontrado" compact>
              {q ? `Nenhuma representada combina com “${q}”.` : "Nenhuma representada nesse filtro."}
            </EmptyState>
          ) : (
            <>
              <TableShell>
                <thead>
                  <tr>
                    <th className={th}>Representada</th>
                    <th className={th}>Cidade</th>
                    <th className={th}>Contato</th>
                    {seeComm ? <th className={`${th} text-right`}>Comissão</th> : null}
                    {seeComm ? <th className={`${th} text-right`}>Pagamento</th> : null}
                    <th className={`${th} w-24 text-right`}>Ativa</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const toggle = setPrincipalActive.bind(null, p.id, !p.active);
                    return (
                      <tr key={p.id} className={`${tr} ${p.active ? "" : "text-muted"}`}>
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <span className={p.active ? "" : "opacity-50 grayscale"}>
                              <Avatar name={p.name} size={30} src={logoUrl(p.logo_path)} />
                            </span>
                            <div className="min-w-0">
                              <RowLink href={`${PATH}/${p.id}`} className={`block truncate font-medium ${p.active ? "text-ink" : "text-ink-2"}`}>
                                {p.name}
                              </RowLink>
                              <p className="truncate font-mono text-xs text-muted">{p.cnpj || p.legal_name || "Sem CNPJ"}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`${td} text-ink-2`}>{place(p) || <span className="text-faint">—</span>}</td>
                        <td className={`${td} max-w-[14rem] truncate text-ink-2`}>
                          {p.contact || <span className="text-faint">—</span>}
                        </td>
{seeComm ? (
<>
                        <td className={`${td} text-right tabular-nums`}>
                          {p.default_commission_pct != null ? (
                            <span className="font-medium text-ink">{pct(p.default_commission_pct)}</span>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                        <td className={`${td} text-right text-ink-2`}>
                          {payDays(p) ? (
                            <span title="Dias após o faturamento">{payDays(p)}</span>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
</>
) : null}
                        <td className={`${td} text-right`}>
                          {canManage ? (
                            <form action={toggle} className="relative z-10 inline-flex">
                              <button
                                aria-label={p.active ? "Desativar representada" : "Ativar representada"}
                                title={p.active ? "Desativar" : "Ativar"}
                                className="inline-flex rounded-full p-1"
                              >
                                <Switch on={p.active} />
                              </button>
                            </form>
                          ) : (
                            <Switch on={p.active} disabled />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>

              <CardList>
                {list.map((p) => (
                  <ListRow key={p.id} href={`${PATH}/${p.id}`}>
                    <span className={p.active ? "" : "opacity-50 grayscale"}>
                      <Avatar name={p.name} size={38} src={logoUrl(p.logo_path)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[15px] font-medium ${p.active ? "" : "text-muted"}`}>{p.name}</p>
                      <p className="mt-0.5 truncate text-[13px] text-muted">
                        {[place(p), seeComm && p.default_commission_pct != null ? `Comissão ${pct(p.default_commission_pct)}` : ""]
                          .filter(Boolean)
                          .join(" · ") || "Sem dados de cidade"}
                      </p>
                    </div>
                    {!p.active ? <Badge>Inativa</Badge> : null}
                  </ListRow>
                ))}
              </CardList>
            </>
          )}
        </>
      )}

      <Sheet
        open={sheetOpen}
        title="Nova representada"
        description="Na ficha da representada você completa depois endereço, contrato e contatos."
        closeHref={PATH}
      >
        <SheetForm action={createPrincipal} closeHref={PATH} submitLabel="Salvar representada">
          <ErrorNote message={sp.erro} />
          <Field label="CNPJ" className="sm:col-span-2">
            <MaskedInput mask="cnpj" lookup="principal" name="cnpj" className={inputCls} />
          </Field>
          <Field label="Nome" hint="Como você chama a empresa no dia a dia." className="sm:col-span-2">
            <input name="name" required placeholder="Ex.: Malharia Aurora" className={inputCls} />
          </Field>
          <Field label="Razão social" className="sm:col-span-2">
            <input name="legal_name" className={inputCls} />
          </Field>
          {seeComm ? (
          <>
          <Field label="% Comissão padrão" hint="Sugerida em cada pedido.">
            <input
              name="commission"
              inputMode="decimal"
              placeholder="5,0"
              pattern="^\d{1,3}([.,]\d{1,2})?$"
              title="Informe um percentual entre 0 e 100"
              className={inputCls}
            />
          </Field>
          <Field label="Dias para pagamento da comissão" hint="Contados a partir do faturamento.">
            <input name="days" inputMode="numeric" placeholder="30" pattern="^\d{1,3}$" className={inputCls} />
          </Field>
          </>
          ) : null}
          <FormGroup title="Endereço" />
          <AddressFields />
        </SheetForm>
      </Sheet>
    </>
  );
}
