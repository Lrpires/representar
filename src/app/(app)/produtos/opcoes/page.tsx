import Link from "next/link";
import { getContext } from "@/lib/session";
import { createOptionList } from "./actions";
import { OPTION_KINDS } from "@/lib/options";
import { Sheet } from "@/components/sheet";
import { Icon } from "@/components/icons";
import {
  PageHeader, Field, ErrorNote, OkNote, EmptyState, Badge, SheetForm, NewButton, Notice, inputCls, textareaCls,
} from "@/components/ui";

const PATH = "/produtos/opcoes";

type ListRow = {
  id: string;
  kind: string;
  name: string;
  principals: { name: string } | null;
  option_values: { name: string; active: boolean }[] | null;
  product_option_lists: { product_id: string }[] | null;
};

export default async function OptionListsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; novo?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, canManage } = await getContext();

  const [{ data: principals }, { data, error }] = await Promise.all([
    supabase.from("principals").select("id, name").eq("active", true).order("name"),
    supabase
      .from("option_lists")
      .select("id, kind, name, principals(name), option_values(name, active), product_option_lists(product_id)")
      .order("kind")
      .order("name"),
  ]);
  const lists = (data ?? []) as unknown as ListRow[];
  const sheetOpen = canManage && !error && (sp.novo === "1" || !!sp.erro);

  return (
    <>
      <PageHeader
        title="Listas de opções"
        back={{ href: "/produtos", label: "Produtos" }}
        hint="Cores, tamanhos, voltagens, sabores… Cadastre uma vez e ligue a vários produtos. No pedido, o produto abre uma grade com essas opções."
        action={canManage && !error ? <NewButton label="Nova lista" fab /> : null}
      />

      {sp.ok ? (
        <div className="mb-4">
          <OkNote message={sp.ok} />
        </div>
      ) : null}

      {error ? (
        <Notice>Para usar as listas de opções, rode a migração 022 no Supabase.</Notice>
      ) : lists.length === 0 ? (
        <EmptyState icon="sparkle" title="Nenhuma lista ainda" action={canManage ? <NewButton label="Nova lista" /> : null}>
          Exemplo: a lista &quot;Cartela Verão 26&quot; do tipo Cor, com Azul Marinho, Preto, Off-white… Depois é só marcar os
          produtos que usam essas cores.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">
          {lists.map((l) => {
            const values = (l.option_values ?? []).filter((v) => v.active);
            const nProducts = l.product_option_lists?.length ?? 0;
            return (
              <li key={l.id}>
                <Link
                  href={`${PATH}/${l.id}`}
                  className="group flex h-full flex-col rounded-xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-float"
                >
                  <div className="flex-1 p-5 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge>{l.kind}</Badge>
                      <span className={`truncate text-xs ${l.principals ? "text-muted" : "font-medium text-warn"}`}>
                        {l.principals?.name ?? "Sem representada: escolha uma"}
                      </span>
                    </div>
                    <p className="mt-3 text-base font-semibold leading-snug">{l.name}</p>
                    <p className="mt-1 line-clamp-2 text-[13px] text-muted">
                      {values.length ? values.map((v) => v.name).join(", ") : "Sem opções ainda"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 border-t border-line/80 px-5 py-3 text-[13px] text-muted">
                    <span className="tabular-nums">
                      {values.length} {values.length === 1 ? "opção" : "opções"} · {nProducts}{" "}
                      {nProducts === 1 ? "produto" : "produtos"}
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

      <Sheet open={sheetOpen} title="Nova lista de opções" description="Depois de criar, você escolhe os produtos." closeHref={PATH}>
        <SheetForm action={createOptionList} closeHref={PATH} submitLabel="Criar lista">
          <div className="sm:col-span-2">
            <ErrorNote message={sp.erro} />
          </div>
          <Field label="Tipo" hint="O que essa lista escolhe no pedido.">
            <input name="kind" list="option-kinds" required defaultValue="Cor" className={inputCls} />
            <datalist id="option-kinds">
              {OPTION_KINDS.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </Field>
          <Field label="Representada" hint="A lista é da cartela dessa fábrica.">
            <select name="principal_id" required defaultValue="" className={inputCls}>
              <option value="" disabled>
                Escolha
              </option>
              {(principals ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nome da lista" hint="Ex.: Cartela Verão 26, Grade adulto P ao GG.">
              <input name="name" required className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Opções"
              hint="Uma por linha. Pode colar da cartela da fábrica. Com código na frente também vale: 0412 Azul Marinho."
            >
              <textarea name="values" rows={8} placeholder={"Azul Marinho\nPreto\nOff-white"} className={textareaCls} />
            </Field>
          </div>
        </SheetForm>
      </Sheet>
    </>
  );
}
