import { getContext } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { saveProfile, removePhoto, changePassword } from "./actions";
import { PhotoUploader } from "./photo";
import { MaskedInput } from "@/components/masked-input";
import { SubmitButton } from "@/components/submit";
import { PageHeader, FormSection, Field, ErrorNote, OkNote, Badge, inputCls, primaryBtn, ghostBtn } from "@/components/ui";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const { user, orgName } = await getContext();
  const profile = await getProfile();

  return (
    <>
      <PageHeader title="Meu perfil" hint="Seus dados pessoais e de acesso." />

      <div className="mb-6 grid max-w-5xl gap-3 empty:hidden">
        <ErrorNote message={sp.erro} />
        <OkNote message={sp.ok} />
      </div>

      <div className="grid max-w-5xl gap-6 xl:gap-0">
        <FormSection title="Foto" hint="Ajuda a equipe a reconhecer quem fez cada pedido.">
          <PhotoUploader userId={user.id} name={profile.name} photoUrl={profile.photoUrl} removeAction={removePhoto} />
        </FormSection>

        <FormSection title="Dados pessoais" hint="O nome aparece no menu, nos pedidos e no pedido impresso.">
          <form action={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo" className="sm:col-span-2">
              <input name="full_name" required defaultValue={profile.name === user.email.split("@")[0] ? "" : profile.name} placeholder="Como você quer ser chamado" className={inputCls} />
            </Field>
            <Field label="Telefone / WhatsApp">
              <MaskedInput mask="phone" name="phone" defaultValue={profile.phone} className={inputCls} />
            </Field>
            <Field label="E-mail" hint="É o seu login. Não pode ser alterado aqui.">
              <input value={profile.email} readOnly disabled className={inputCls} />
            </Field>
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <span className="flex items-center gap-2 text-[13px] text-muted">
                <Badge>{profile.roleName}</Badge>
                em {orgName}
              </span>
              <SubmitButton className={primaryBtn} pending="Salvando…">
                Salvar dados
              </SubmitButton>
            </div>
          </form>
        </FormSection>

        <FormSection title="Senha" hint="Use pelo menos 8 caracteres.">
          <form action={changePassword} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nova senha">
              <input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputCls} />
            </Field>
            <Field label="Repita a nova senha">
              <input name="confirm" type="password" autoComplete="new-password" minLength={8} required className={inputCls} />
            </Field>
            <div className="flex justify-end sm:col-span-2">
              <SubmitButton className={ghostBtn} pending="Trocando…">
                Trocar senha
              </SubmitButton>
            </div>
          </form>
        </FormSection>
      </div>
    </>
  );
}
