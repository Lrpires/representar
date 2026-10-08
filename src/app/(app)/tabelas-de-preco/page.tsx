import Link from "next/link";
import { getContext } from "@/lib/session";
import { createPriceTable } from "./actions";
import { formatDate, todayISO } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { Icon } from "@/components/icons";
import {
  PageHeader, Field, ErrorNote, EmptyState, Badge, Avatar, SheetForm, NewButton, FilterPill,
  inputCls, primaryBtn,
} from "@/components/ui";

const PATH = "/tabelas-de-preco";

type Table = {
  id: string;
  name: string;
  valid_from: string;
  valid_to: string | null;
  principals: unknown;
};

type State = "vigentes" | "futuras" | "encerradas";

function stateOf(t: Table, today: string): State {
  if (t.valid_from > today) return "futuras";
  if (t.valid_to && t.valid_to < today) return "encerradas";
  return "vigentes";
}

const stateTag: Record<State, { label: string; tone: "ok" | "warn" | "neutral" }> = {
  vigentes: { label: "Vigente", tone: "ok" },
  futuras: { label: "Futura", tone: "warn" },
  encerradas: { label: "Encerrada", tone: "neutral" },
};

export default async function PriceTablesPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; novo?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, canManage } = await getContext();

  const [{ data: principalsData }, { data: tablesData }] = await Promise.all([
    supabase.from("principals").select("id, name").eq("active", true).order("name"),
    supabase
      .from("price_tables")
      .select("id, name, valid_from, valid_to, principals(name)")
      .order("valid_from", { ascending: false }),
  ]);
  const principals = principalsData ?? [];
  const all = (tablesData ?? []) as Table[];
  const today = todayISO();

  const withState = all.map((t) => ({ t, state: stateOf(t, today) }));
  const n = (s: State) => withState.filter((x) => x.state === s).length;
  const filter: State | "todas" =
    sp.status === "vigentes" || sp.status === "futuras" || sp.status === "encerradas"
      ? sp.status
      : "todas";
  const shown = filter === "todas" ? withState : withState.filter((x) => x.state === filter);

  const href = (s: string) => (s === "todas" ? PATH : `${PATH}?status=${s}`);

  const noPrincipals = principals.length === 0;
  const sheetOpen = canManage && !noPrincipals && (sp.novo === "1" || !!sp.erro);

  return (
    <>
      <PageHeader
        title="Tabelas de preço"
        hint={all.length === 0 ? "O pedido usa a tabela vigente na data da venda." : undefined}
        filters={
          all.length > 0 ? (
            <>
              <FilterPill href={href("todas")} active={filter === "todas"} count={all.length} tone="blue">
                Todas
              </FilterPill>
              <FilterPill href={href("vigentes")} active={filter === "vigentes"} count={n("vigentes")} tone="green">
                Vigentes
              </FilterPill>
              <FilterPill href={href("futuras")} active={filter === "futuras"} count={n("futuras")} tone="yellow">
                Futuras
              </FilterPill>
              <FilterPill
                href={href("encerradas")}
                active={filter === "encerradas"}
                count={n("encerradas")}
                tone="neutral"
              >
                Encerradas
              </FilterPill>
            </>
          ) : undefined
        }
        action={canManage && !noPrincipals ? <NewButton label="Nova tabela" /> : null}
      />

      {noPrincipals ? (
        <EmptyState
          icon="tag"
          title="Cadastre uma representada primeiro"
          action={
            <Link href="/representadas" className={primaryBtn}>
              Ir para representadas
            </Link>
          }
        >
          As tabelas de preço pertencem a uma fábrica.
        </EmptyState>
      ) : all.length === 0 ? (
        <EmptyState
          icon="tag"
          title="Nenhuma tabela de preço ainda"
          action={canManage ? <NewButton label="Nova tabela" /> : null}
        >
          Crie a primeira tabela, defina a vigência e lance os preços dos produtos.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon="search" title="Nenhuma tabela nesse filtro" />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 lg:gap-4">
          {shown.map(({ t, state }) => {
            const principal = t.principals as { name: string } | null;
            const tag = stateTag[state];
            return (
              <li key={t.id}>
                <Link
                  href={`${PATH}/${t.id}`}
                  className={`group flex h-full flex-col overflow-hidden rounded-[1.75rem] border transition hover:-translate-y-0.5 hover:shadow-float ${
                    state === "vigentes"
                      ? "border-pen/15 bg-linear-to-b from-[#eef2ff] to-[#f5f7ff]"
                      : "border-line bg-subtle"
                  }`}
                >
                  <div className="flex-1 p-5 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <Avatar name={principal?.name ?? t.name} size={48} />
                      <Badge tone={tag.tone}>
                        {state === "vigentes" ? <Icon name="check" size={12} strokeWidth={2.6} /> : null}
                        {tag.label}
                      </Badge>
                    </div>
                    <p className="mt-4 text-lg font-semibold leading-snug">{t.name}</p>
                    <p className="mt-0.5 truncate text-sm text-muted">{principal?.name}</p>
                  </div>
                  <div className="flex items-center gap-2 border-t border-line/80 px-5 py-3.5 text-[13px] text-muted">
                    <Icon name="calendar" size={15} className="shrink-0" />
                    <span className="min-w-0 truncate tabular-nums">
                      {formatDate(t.valid_from)}
                      {t.valid_to ? ` → ${formatDate(t.valid_to)}` : " → sem data final"}
                    </span>
                    <Icon
                      name="chevron-right"
                      size={16}
                      className="ml-auto shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink-2"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={sheetOpen}
        title="Nova tabela de preço"
        description="Depois de criar, você já lança os preços."
        closeHref={PATH}
      >
        <SheetForm action={createPriceTable} closeHref={PATH} submitLabel="Criar tabela">
          <div className="sm:col-span-2">
            <ErrorNote message={sp.erro} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Representada">
              <select name="principal_id" required className={inputCls} defaultValue="">
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
          <div className="sm:col-span-2">
            <Field label="Nome da tabela" hint="Ex.: Verão 2027, Tabela outubro.">
              <input name="name" required className={inputCls} />
            </Field>
          </div>
          <Field label="Vigência: início">
            <input name="valid_from" type="date" required defaultValue={today} className={inputCls} />
          </Field>
          <Field label="Vigência: fim" hint="Deixe vazio se não tem data final.">
            <input name="valid_to" type="date" className={inputCls} />
          </Field>
        </SheetForm>
      </Sheet>
    </>
  );
}
