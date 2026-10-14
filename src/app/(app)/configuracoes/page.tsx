import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { UNIT_GROUPS } from "@/lib/units";
import { saveSettings, removeLogo, deleteOrganization } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";
import { ColorPicker, DelaySettings, LogoUploader, OrderNumbering, UnitPicker } from "./controls";
import { SubmitButton } from "@/components/submit";
import {
  PageHeader, FormSection, Field, ErrorNote, OkNote, SaveBar, Notice, inputCls, primaryBtn, dangerBtn,
} from "@/components/ui";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, orgId, role, isOwner } = await getContext();
  if (role !== "owner" && role !== "manager") redirect("/");

  const [settings, { data: last }] = await Promise.all([
    getSettings(),
    supabase.from("orders").select("number").order("number", { ascending: false }).limit(1).maybeSingle(),
  ]);
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

      <div className="mb-6 max-w-5xl">
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
        <fieldset disabled={locked} className="m-0 grid min-w-0 gap-6 border-0 p-0 xl:gap-0">
          <FormSection title="Escritório" hint="O nome que aparece no sistema e nos pedidos.">
            <Field label="Nome do escritório">
              <input name="name" required defaultValue={settings.name} className={inputCls} />
            </Field>
          </FormSection>

          <FormSection
            title="Cores do sistema"
            hint="A cor principal dos botões, destaques e menus. A prévia muda na hora; salve para manter."
          >
            <ColorPicker value={settings.color} disabled={locked} />
          </FormSection>

          <FormSection
            title="Numeração dos pedidos"
            hint="Escolha de qual número começar e, se quiser, um prefixo ou sufixo, como PED-1001/26."
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
            title="Unidades de venda"
            hint="Só as unidades marcadas aparecem ao cadastrar produtos e itens de pedido."
          >
            <UnitPicker groups={UNIT_GROUPS} selected={settings.units} disabled={locked} />
          </FormSection>
        </fieldset>

        {isOwner ? (
          <div className="mt-6 xl:mt-0">
            <FormSection
              title="Excluir escritório"
              hint="Apaga o escritório e todos os dados: clientes, pedidos, comissões, leads e contas. Não dá para desfazer."
            >
              <div className="grid gap-3 rounded-lg border border-alert/25 bg-alert-soft/40 p-4">
                <Field label={`Para confirmar, digite: ${settings.name}`}>
                  <input name="confirm" autoComplete="off" className={inputCls} />
                </Field>
                <div>
                  <ConfirmButton
                    message="Excluir o escritório e TODOS os dados? Essa ação não pode ser desfeita."
                    formAction={deleteOrganization}
                    className={`${dangerBtn} border border-alert/30 bg-white`}
                  >
                    Excluir escritório e dados
                  </ConfirmButton>
                </div>
              </div>
            </FormSection>
          </div>
        ) : null}

        {!locked ? (
          <SaveBar note={<span className="hidden sm:inline">As mudanças valem para todo o escritório.</span>}>
            <SubmitButton className={`${primaryBtn} w-full sm:w-auto`} pending="Salvando…">
              Salvar configurações
            </SubmitButton>
          </SaveBar>
        ) : null}
      </form>
    </>
  );
}
