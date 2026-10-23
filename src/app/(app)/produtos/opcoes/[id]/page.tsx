import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import {
  updateOptionList, deleteOptionList, addOptionValues, saveOptionValues, deleteOptionValue, setListProducts,
} from "../actions";
import { MAX_LISTS_PER_PRODUCT, OPTION_KINDS } from "@/lib/options";
import { priceText } from "@/lib/orders";
import { currencySymbol } from "@/lib/number-format";
import { Icon } from "@/components/icons";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit";
import {
  PageHeader, FormSection, Field, ErrorNote, OkNote, Badge, inputCls, textareaCls, primaryBtn, ghostBtn, dangerBtn,
} from "@/components/ui";
import { ProductPicker, type PickProduct } from "./product-picker";

const cell =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-sm outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/25 sm:h-9";

type Value = {
  id: string;
  name: string;
  code: string | null;
  position: number;
  price_adjust: number | null;
  adjust_type: string;
  active: boolean;
};

export default async function OptionListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, canManage, numberFormat } = await getContext();

  const { data: list } = await supabase
    .from("option_lists")
    .select("id, kind, name, principal_id, principals(name), option_values(id, name, code, position, price_adjust, adjust_type, active)")
    .eq("id", id)
    .maybeSingle();
  if (!list) notFound();

  let productsQuery = supabase
    .from("products")
    .select("id, code, name, principals(name), product_option_lists(list_id)")
    .eq("active", true)
    .order("name")
    .limit(3000);
  if (list.principal_id) productsQuery = productsQuery.eq("principal_id", list.principal_id);
  const [{ data: principals }, { data: productsData }] = await Promise.all([
    supabase.from("principals").select("id, name").eq("active", true).order("name"),
    productsQuery,
  ]);

  const values = [...((list.option_values ?? []) as Value[])].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR"),
  );
  type P = { id: string; code: string; name: string; principals: { name: string } | null; product_option_lists: { list_id: string }[] | null };
  const products: PickProduct[] = ((productsData ?? []) as unknown as P[]).map((p) => {
    const links = (p.product_option_lists ?? []).map((l) => l.list_id);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      principal: p.principals?.name ?? "",
      checked: links.includes(id),
      full: !links.includes(id) && links.length >= MAX_LISTS_PER_PRODUCT,
    };
  });
  const principal = list.principals as unknown as { name: string } | null;
  const nUsing = products.filter((p) => p.checked).length;
  const symbol = currencySymbol(numberFormat);

  return (
    <>
      <PageHeader
        title={list.name}
        back={{ href: "/produtos/opcoes", label: "Listas de opções" }}
        meta={
          <>
            <Badge>{list.kind}</Badge>
            <span className={principal ? "" : "font-medium text-warn"}>{principal?.name ?? "Sem representada"}</span>
            <span className="tabular-nums">
              {values.length} {values.length === 1 ? "opção" : "opções"} · {nUsing} {nUsing === 1 ? "produto" : "produtos"}
            </span>
          </>
        }
      />

      <div className="mb-4 max-w-5xl empty:hidden [&>*]:mb-3">
        <ErrorNote message={sp.erro} />
        <OkNote message={sp.ok} />
      </div>

      <div className="grid max-w-5xl gap-6 xl:gap-0">
        <FormSection
          title="Opções"
          hint="Desmarque para tirar dos pedidos novos sem apagar. O acréscimo muda o preço daquela opção: em valor (+2,50) ou em % (+10). Negativo vira desconto."
        >
          {values.length ? (
            <form action={saveOptionValues.bind(null, id)}>
              <fieldset disabled={!canManage} className="m-0 grid min-w-0 gap-3 border-0 p-0">
                <div className="hidden grid-cols-[1.5rem_5rem_minmax(0,1fr)_6rem_4.5rem_2rem] gap-2 px-1 text-xs text-muted sm:grid">
                  <span />
                  <span>Código</span>
                  <span>Nome</span>
                  <span className="text-right">Acréscimo</span>
                  <span>Em</span>
                  <span />
                </div>
                <ul className="grid gap-2">
                  {values.map((v) => (
                    <li
                      key={v.id}
                      className="grid grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-center gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1.5rem_5rem_minmax(0,1fr)_6rem_4.5rem_2rem] sm:border-0 sm:p-0 sm:px-1"
                    >
                      <input type="hidden" name="value_id" value={v.id} />
                      <input
                        type="checkbox"
                        name={`active_${v.id}`}
                        defaultChecked={v.active}
                        aria-label={`${v.name} ativa`}
                        className="h-[18px] w-[18px] rounded border-line-strong sm:h-4 sm:w-4"
                      />
                      <input
                        name={`name_${v.id}`}
                        defaultValue={v.name}
                        aria-label="Nome"
                        className={`${cell} sm:order-3`}
                      />
                      <ConfirmButton
                        message={`Excluir "${v.name}"? Os pedidos antigos não mudam.`}
                        formAction={deleteOptionValue.bind(null, id, v.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-alert-soft hover:text-alert sm:order-6"
                      >
                        <Icon name="trash" size={14} />
                        <span className="sr-only">Excluir {v.name}</span>
                      </ConfirmButton>
                      <div className="col-span-3 grid grid-cols-[5rem_minmax(0,1fr)_4.5rem] gap-2 sm:contents">
                        <input
                          name={`code_${v.id}`}
                          defaultValue={v.code ?? ""}
                          placeholder="Código"
                          aria-label="Código"
                          className={`${cell} font-mono text-xs sm:order-2`}
                        />
                        <input
                          name={`adjust_${v.id}`}
                          inputMode="decimal"
                          defaultValue={v.price_adjust == null ? "" : priceText(Number(v.price_adjust), numberFormat)}
                          placeholder="Acréscimo"
                          aria-label="Acréscimo"
                          className={`${cell} text-right tabular-nums sm:order-4`}
                        />
                        <select name={`type_${v.id}`} defaultValue={v.adjust_type} aria-label="Tipo do acréscimo" className={`${cell} sm:order-5`}>
                          <option value="valor">{symbol}</option>
                          <option value="pct">%</option>
                        </select>
                      </div>
                    </li>
                  ))}
                </ul>
                {canManage ? (
                  <div>
                    <SubmitButton className={primaryBtn} pending="Salvando…">
                      Salvar opções
                    </SubmitButton>
                  </div>
                ) : null}
              </fieldset>
            </form>
          ) : (
            <p className="text-sm text-muted">Nenhuma opção ainda. Adicione abaixo.</p>
          )}

          {canManage ? (
            <form action={addOptionValues.bind(null, id)} className="mt-5 grid gap-3 border-t border-line pt-5">
              <Field label="Adicionar opções" hint="Uma por linha. Pode colar da cartela. Ex.: 0412 Azul Marinho.">
                <textarea name="values" rows={3} className={textareaCls} />
              </Field>
              <div>
                <button className={ghostBtn}>
                  <Icon name="plus" size={14} strokeWidth={2} />
                  Adicionar
                </button>
              </div>
            </form>
          ) : null}
        </FormSection>

        <FormSection
          title="Produtos que usam"
          hint={`Opcional: no pedido, todo produto da representada já pode usar esta lista. Marque aqui para a grade abrir direto nela (até ${MAX_LISTS_PER_PRODUCT} listas por produto, ex.: Cor e Tamanho).`}
        >
          {!list.principal_id ? (
            <p className="text-sm text-warn">Escolha a representada da lista em &quot;Dados da lista&quot;, logo abaixo.</p>
          ) : products.length ? (
            <form action={setListProducts.bind(null, id)} className="grid gap-4">
              <ProductPicker products={products} disabled={!canManage} />
              {canManage ? (
                <div>
                  <SubmitButton className={primaryBtn} pending="Salvando…">
                    Salvar produtos
                  </SubmitButton>
                </div>
              ) : null}
            </form>
          ) : (
            <p className="text-sm text-muted">Nenhum produto ativo{principal ? ` de ${principal.name}` : ""} ainda.</p>
          )}
        </FormSection>

        <FormSection title="Dados da lista">
          <form action={updateOptionList.bind(null, id)}>
            <fieldset disabled={!canManage} className="m-0 grid min-w-0 gap-4 border-0 p-0 sm:grid-cols-2">
              <Field label="Tipo">
                <input name="kind" list="option-kinds" required defaultValue={list.kind} className={inputCls} />
                <datalist id="option-kinds">
                  {OPTION_KINDS.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </Field>
              <Field label="Representada">
                <select name="principal_id" required defaultValue={list.principal_id ?? ""} className={inputCls}>
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
                <Field label="Nome da lista">
                  <input name="name" required defaultValue={list.name} className={inputCls} />
                </Field>
              </div>
              {canManage ? (
                <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                  <SubmitButton className={ghostBtn} pending="Salvando…">
                    Salvar dados
                  </SubmitButton>
                  <ConfirmButton
                    message={`Excluir a lista ${list.name}? Os produtos deixam de usar essas opções. Os pedidos antigos não mudam.`}
                    formAction={deleteOptionList.bind(null, id)}
                    className={dangerBtn}
                  >
                    <Icon name="trash" size={15} />
                    Excluir lista
                  </ConfirmButton>
                </div>
              ) : null}
            </fieldset>
          </form>
        </FormSection>
      </div>
    </>
  );
}
