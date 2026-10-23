import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { UNIT_GROUPS } from "@/lib/units";
import { saveSettings, removeLogo, deleteOrganization } from "./actions";
import { addPayableOption, deletePayableOption, togglePayableOption, restorePayableDefaults } from "./payable-options";
import { OPTION_KINDS, type PayableOption } from "@/lib/payables";
import { Icon } from "@/components/icons";
import { ConfirmButton } from "@/components/confirm-button";
import { ColorPicker, DelaySettings, LogoUploader, NumberSettings, OrderNumbering, UnitPicker } from "./controls";
import { SubmitButton } from "@/components/submit";
import {
  PageHeader, FormSection, Field, Checkbox, ErrorNote, OkNote, SaveBar, Notice, inputCls, primaryBtn, dangerBtn, ghostBtn, quietBtn,
} from "@/components/ui";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, orgId, role, isOwner, numberFormat } = await getContext();
  if (role !== "owner" && role !== "manager") redirect("/");

  const [settings, { data: last }, { data: optionData, error: optionError }] = await Promise.all([
    getSettings(),
    supabase.from("orders").select("number").order("number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("payable_options").select("id, kind, name, active, sort").order("sort"),
  ]);
  const options = (optionData ?? []) as PayableOption[];
  const locked = !isOwner;

  return (
    <>
      <PageHeader
        title="Configurações"
        hint="A identidade do seu escritório e como o sistema funciona para a sua equipe."
      />

      <div className="mb-6 grid max-w-5xl gap-3 empty:hidden">
        <ErrorNote message={sp.erro} />
        <OkNote message={sp.ok} />
      </div>

      {locked ? (
        <div className="max-w-5xl">
          <Notice>Só o administrador pode alterar as configurações. Você está vendo em modo leitura.</Notice>
        </div>
      ) : null}

      <div className="max-w-5xl border-b border-line pb-6 xl:pb-8">
        <FormSection title="Logo" hint="Aparece no menu, no lugar do nome do escritório.">
          <LogoUploader
            orgId={orgId}
            logoUrl={settings.logoUrl}
            orgName={settings.name}
            disabled={locked}
            removeAction={removeLogo}
          />
        </FormSection>
      </div>

      <form action={saveSettings} className="max-w-5xl">
        <fieldset disabled={locked} className="m-0 grid min-w-0 gap-6 border-0 p-0 pt-6 xl:gap-0 xl:pt-8">
          <FormSection title="Escritório" hint="O nome que aparece no sistema e nos pedidos.">
            <Field label="Nome do escritório">
              <input name="name" required defaultValue={settings.name} className={inputCls} />
            </Field>
          </FormSection>

          <FormSection
            title="Cores do sistema"
            hint="A cor da sua empresa no sistema: botão principal, destaques, barras de meta e menu. Vale para todos da equipe. A prévia muda na hora; salve para manter."
          >
            <ColorPicker value={settings.color} disabled={locked} />
          </FormSection>

          <FormSection
            title="Moeda e números"
            hint="A moeda do escritório e como os números aparecem e são digitados em todo o sistema."
          >
            <NumberSettings value={numberFormat} disabled={locked} />
          </FormSection>

          <FormSection
            title="Numeração dos pedidos"
            hint="A numeração é separada por representada. Escolha de qual número cada uma começa e, se quiser, um prefixo ou sufixo, como PED-1001/26."
          >
            <OrderNumbering
              start={settings.orderStart}
              prefix={settings.orderPrefix}
              suffix={settings.orderSuffix}
              lastNumber={last?.number ?? 0}
              disabled={locked}
            />
          </FormSection>

          <FormSection
            title="Prazos dos pedidos"
            hint="Quando um pedido enviado ainda não foi todo faturado, ele aparece em amarelo (atenção) e depois em vermelho (crítico) nos Pedidos, no Faturamento e no Painel."
          >
            <DelaySettings warn={settings.warnDays} critical={settings.criticalDays} disabled={locked} />
          </FormSection>

          <FormSection
            title="Preços nos pedidos"
            hint="O pedido sugere o último preço que aquele cliente pagou no produto (e na cor, se houver). Se ele nunca comprou, o preço fica em branco."
          >
            <Checkbox
              name="use_price_tables"
              defaultChecked={settings.usePriceTables}
              hint="Para quem trabalha com tabela da fábrica: aparece no menu e, havendo tabela vigente da representada, o pedido sugere o preço dela."
            >
              Usar tabelas de preço
            </Checkbox>
          </FormSection>

          <FormSection
            title="Unidades de venda"
            hint="Só as unidades marcadas aparecem ao cadastrar produtos e itens de pedido."
          >
            <UnitPicker groups={UNIT_GROUPS} selected={settings.units} disabled={locked} />
          </FormSection>
        </fieldset>

        {!locked ? (
          <SaveBar note={<span className="hidden sm:inline">As mudanças valem para todo o escritório.</span>}>
            <SubmitButton className={`${primaryBtn} w-full sm:w-auto`} pending="Salvando…">
              Salvar configurações
            </SubmitButton>
          </SaveBar>
        ) : null}
      </form>

      {/* ---------- Cadastros das contas a pagar (cada item salva na hora) ---------- */}
      <section id="contas" className="mt-10 max-w-5xl scroll-mt-24 border-t border-line pt-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.01em]">Contas a pagar</h2>
            <p className="mt-0.5 text-[13px] text-muted">Listas usadas ao lançar cada conta. Já vêm prontas; ajuste ao jeito do escritório.</p>
          </div>
          {!locked && !optionError ? (
            <form action={restorePayableDefaults}>
              <button className={quietBtn}>Restaurar lista pronta</button>
            </form>
          ) : null}
        </div>
        {optionError ? (
          <Notice>Para usar tipos de despesa, centros de custo e formas de pagamento, rode a migração 018 no Supabase.</Notice>
        ) : (
          <div className="grid gap-6 xl:gap-0">
            {OPTION_KINDS.map((k) => {
              const items = options.filter((o) => o.kind === k.kind);
              return (
                <FormSection key={k.kind} title={k.title} hint={k.hint}>
                  <ul className="flex flex-wrap gap-2">
                    {items.map((o) => (
                      <li
                        key={o.id}
                        className={`inline-flex h-8 items-center gap-0.5 rounded-lg border border-line bg-surface pl-3 pr-1 text-[13px] ${o.active ? "text-ink" : "text-faint"}`}
                      >
                        <span className={o.active ? "" : "line-through"}>{o.name}</span>
                        {!locked ? (
                          <form className="inline-flex">
                            {o.active ? (
                              <ConfirmButton
                                message={`Excluir "${o.name}"? As contas que já usam este item ficam com o campo em branco.`}
                                formAction={deletePayableOption.bind(null, o.id)}
                                className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-faint transition hover:bg-alert-soft hover:text-alert"
                              >
                                <Icon name="x" size={12} strokeWidth={2.2} />
                                <span className="sr-only">Excluir {o.name}</span>
                              </ConfirmButton>
                            ) : (
                              <button
                                formAction={togglePayableOption.bind(null, o.id, true)}
                                className="ml-1 rounded-md px-1.5 text-[11.5px] font-medium text-ink-2 hover:bg-hover"
                              >
                                Reativar
                              </button>
                            )}
                          </form>
                        ) : null}
                      </li>
                    ))}
                    {items.length === 0 ? <li className="text-[13px] text-muted">Nenhum item ainda.</li> : null}
                  </ul>
                  {!locked ? (
                    <form action={addPayableOption.bind(null, k.kind)} className="mt-4 flex gap-2">
                      <input name="name" required maxLength={60} placeholder={k.placeholder} className={`${inputCls} sm:max-w-xs`} />
                      <button className={ghostBtn}>
                        <Icon name="plus" size={14} strokeWidth={2} />
                        Adicionar
                      </button>
                    </form>
                  ) : null}
                </FormSection>
              );
            })}
          </div>
        )}
      </section>

      <form className="mb-6 max-w-5xl">
        {isOwner ? (
          <div className="mt-10 border-t border-line pt-8">
            <FormSection
              title="Excluir escritório"
              hint="Apaga o escritório e todos os dados: clientes, pedidos, comissões, prospecção e contas. Não dá para desfazer."
            >
              <div className="grid gap-3 rounded-lg border border-alert/25 bg-alert-soft/40 p-4">
                <Field label={`Para confirmar, digite: ${settings.name}`}>
                  <input name="confirm" autoComplete="off" className={inputCls} />
                </Field>
                <div>
                  <ConfirmButton
                    message="Excluir o escritório e TODOS os dados? Essa ação não pode ser desfeita."
                    formAction={deleteOrganization}
                    className={`${dangerBtn} border border-alert/30 bg-surface`}
                  >
                    Excluir escritório e dados
                  </ConfirmButton>
                </div>
              </div>
            </FormSection>
          </div>
        ) : null}
      </form>
    </>
  );
}
