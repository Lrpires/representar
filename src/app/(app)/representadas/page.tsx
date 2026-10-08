import { getContext } from "@/lib/session";
import { createPrincipal, setPrincipalActive } from "./actions";
import { pct, safeQ } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { SearchBox } from "@/components/search";
import { Icon } from "@/components/icons";
import {
  PageHeader, Toolbar, Field, ErrorNote, EmptyState, Badge, Avatar, SheetForm, NewButton,
  FilterPill, Switch, inputCls,
} from "@/components/ui";

const PATH = "/representadas";

export default async function PrincipalsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; novo?: string; q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = safeQ(sp.q);
  const { supabase, canManage } = await getContext();

  let query = supabase
    .from("principals")
    .select("id, name, cnpj, default_commission_pct, payment_terms, contact, active")
    .order("name");
  if (q) query = query.or(`name.ilike.*${q}*,cnpj.ilike.*${q}*`);
  const { data } = await query;
  const all = data ?? [];

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

  return (
    <>
      <PageHeader
        title="Representadas"
        hint={noneAtAll ? "As fábricas e marcas que você representa." : undefined}
        filters={
          all.length > 0 ? (
            <>
              <FilterPill href={href("todas")} active={status === "todas"} count={all.length} tone="green">
                Todas
              </FilterPill>
              <FilterPill href={href("ativas")} active={status === "ativas"} count={nActive} tone="blue">
                Ativas
              </FilterPill>
              <FilterPill
                href={href("inativas")}
                active={status === "inativas"}
                count={all.length - nActive}
                tone="orange"
              >
                Inativas
              </FilterPill>
            </>
          ) : undefined
        }
        action={canManage ? <NewButton label="Nova representada" /> : null}
      />

      {noneAtAll ? (
        <EmptyState
          icon="factory"
          title="Nenhuma representada ainda"
          action={canManage ? <NewButton label="Nova representada" /> : null}
        >
          Cadastre as fábricas que você representa. Depois, cadastre os produtos e as tabelas de
          preço de cada uma.
        </EmptyState>
      ) : (
        <>
          <div className="lg:hidden">
            <Toolbar>
              <SearchBox placeholder="Buscar representada" />
            </Toolbar>
          </div>

          {list.length === 0 ? (
            <EmptyState icon="search" title="Nada encontrado">
              {q ? `Nenhuma representada combina com “${q}”.` : "Nenhuma representada nesse filtro."}
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 lg:gap-4">
              {list.map((p) => {
                const toggle = setPrincipalActive.bind(null, p.id, !p.active);
                return (
                  <li
                    key={p.id}
                    className={`overflow-hidden rounded-[1.75rem] border transition ${
                      p.active
                        ? "border-pen/15 bg-linear-to-b from-[#eef2ff] to-[#f5f7ff]"
                        : "border-line bg-subtle"
                    }`}
                  >
                    <div className="p-5 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <Avatar name={p.name} size={48} />
                        {p.default_commission_pct != null ? (
                          <Badge tone={p.active ? "solid" : "neutral"}>
                            Comissão {pct(p.default_commission_pct)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className={`mt-4 text-lg font-semibold leading-snug ${p.active ? "" : "text-ink-2"}`}>
                        {p.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[13px] text-muted">
                        {p.cnpj || "Sem CNPJ"}
                      </p>
                      {p.contact ? (
                        <p className="mt-2 flex items-center gap-1.5 truncate text-[13px] text-muted">
                          <Icon name="phone" size={13} className="shrink-0" />
                          <span className="truncate">{p.contact}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-line/80 px-5 py-3.5">
                      <span className="min-w-0 truncate text-[13px] text-muted">
                        {p.payment_terms || "Sem condição de pagamento"}
                      </span>
                      {canManage ? (
                        <form action={toggle}>
                          <button
                            aria-label={p.active ? "Desativar representada" : "Ativar representada"}
                            title={p.active ? "Desativar" : "Ativar"}
                            className="rounded-full transition active:scale-95"
                          >
                            <Switch on={p.active} />
                          </button>
                        </form>
                      ) : (
                        <Switch on={p.active} disabled />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <Sheet
        open={sheetOpen}
        title="Nova representada"
        description="Dados da fábrica e condições comerciais."
        closeHref={PATH}
      >
        <SheetForm action={createPrincipal} closeHref={PATH} submitLabel="Salvar">
          <div className="sm:col-span-2">
            <ErrorNote message={sp.erro} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Nome">
              <input name="name" required className={inputCls} />
            </Field>
          </div>
          <Field label="CNPJ">
            <input name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" className={inputCls} />
          </Field>
          <Field label="Comissão padrão (%)">
            <input name="commission" inputMode="decimal" placeholder="5,0" className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Condições de pagamento"
              hint="Ex.: 30/60/90 dias, à vista com 3% de desconto."
            >
              <input name="terms" className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Contato na fábrica">
              <input name="contact" className={inputCls} />
            </Field>
          </div>
        </SheetForm>
      </Sheet>
    </>
  );
}
