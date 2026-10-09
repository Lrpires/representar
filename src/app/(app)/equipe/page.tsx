import { redirect } from "next/navigation";
import { getContext, roleLabel, roleHint, ROLES, type Role } from "@/lib/session";
import { inviteMember, cancelInvite, updateMember, removeMember } from "./actions";
import { Sheet } from "@/components/sheet";
import {
  PageHeader, Field, ErrorNote, OkNote, Badge, Avatar, SheetForm, NewButton, inputCls, ghostBtn,
} from "@/components/ui";

const PATH = "/equipe";

const tone = { owner: "ink", manager: "pen", seller: "neutral", finance: "ok" } as const;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; novo?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, orgId, user, role, isOwner } = await getContext();
  if (role !== "owner" && role !== "manager") redirect("/");

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("members")
      .select("id, user_id, role, full_name, email, created_at")
      .eq("org_id", orgId)
      .order("created_at"),
    isOwner
      ? supabase
          .from("invites")
          .select("id, email, full_name, role, created_at")
          .eq("org_id", orgId)
          .is("accepted_at", null)
          .order("created_at")
      : Promise.resolve({ data: [] as { id: string; email: string; full_name: string | null; role: string }[] }),
  ]);

  const sheetOpen = isOwner && (sp.novo === "1" || !!sp.erro);

  return (
    <>
      <PageHeader
        title="Equipe"
        hint="Quem tem acesso ao escritório e o que cada perfil pode fazer."
        action={isOwner ? <NewButton label="Convidar pessoa" /> : null}
      />

      <div className="mb-4 max-w-3xl empty:hidden [&>*]:mb-3">
        <ErrorNote message={sp.erro} />
        <OkNote message={sp.ok} />
      </div>

      <div className="grid max-w-3xl gap-4 lg:gap-5">
        <section className="rounded-[1.75rem] border border-line bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold">Pessoas ({members?.length ?? 0})</h2>
          <ul className="divide-y divide-line">
            {(members ?? []).map((m) => {
              const mine = m.user_id === user.id;
              const label = m.full_name || m.email || "Usuário";
              return (
                <li key={m.id} className="py-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={label} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-tight">
                        {label} {mine ? <span className="text-xs font-normal text-muted">(você)</span> : null}
                      </p>
                      {m.full_name && m.email ? (
                        <p className="truncate text-sm text-muted">{m.email}</p>
                      ) : null}
                    </div>
                    <Badge tone={tone[m.role as Role]}>{roleLabel[m.role as Role]}</Badge>
                  </div>

                  {isOwner && mine ? (
                    <form action={updateMember.bind(null, m.id)} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="role" value={m.role} />
                      <input name="full_name" placeholder="Seu nome" defaultValue={m.full_name ?? ""} className={inputCls} />
                      <button className={ghostBtn}>Salvar nome</button>
                    </form>
                  ) : null}

                  {isOwner && !mine ? (
                    <form
                      action={updateMember.bind(null, m.id)}
                      className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
                    >
                      <div className="grid gap-2 sm:grid-cols-2 sm:col-span-1">
                        <input
                          name="full_name"
                          placeholder="Nome"
                          defaultValue={m.full_name ?? ""}
                          className={inputCls}
                        />
                        <select name="role" defaultValue={m.role} className={inputCls}>
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{roleLabel[r]}</option>
                          ))}
                        </select>
                      </div>
                      <button className={ghostBtn}>Salvar</button>
                      <button
                        formAction={removeMember.bind(null, m.id)}
                        className="h-12 rounded-xl px-4 text-sm text-alert hover:bg-subtle"
                      >
                        Remover
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {isOwner && (members ?? []).length === 1 ? (
            <p className="mt-4 rounded-2xl bg-subtle p-4 text-sm leading-relaxed text-ink-2">
              Para cadastrar um vendedor, clique em <strong>Convidar pessoa</strong> (botão no topo da
              página). Seu perfil de administrador não deve ser alterado.
            </p>
          ) : null}
        </section>

        {isOwner && (invites ?? []).length > 0 ? (
          <section className="rounded-[1.75rem] border border-line bg-white p-5 sm:p-6">
            <h2 className="mb-1 text-base font-semibold">Convites pendentes</h2>
            <p className="mb-4 text-[13px] text-muted">
              Cada pessoa entra sozinha ao criar a conta com o e-mail convidado.
            </p>
            <ul className="divide-y divide-line">
              {(invites ?? []).map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">{i.full_name || i.email}</p>
                    {i.full_name ? <p className="truncate text-sm text-muted">{i.email}</p> : null}
                  </div>
                  <Badge>{roleLabel[i.role as Role]}</Badge>
                  <form action={cancelInvite.bind(null, i.id)}>
                    <button className="rounded-lg px-2 py-1 text-[13px] text-alert hover:bg-subtle">
                      Cancelar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-[1.75rem] border border-line bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold">O que cada perfil faz</h2>
          <ul className="grid gap-3">
            {ROLES.map((r) => (
              <li key={r} className="flex items-start gap-3">
                <Badge tone={tone[r]}>{roleLabel[r]}</Badge>
                <p className="text-sm leading-snug text-ink-2">{roleHint[r]}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Sheet
        open={sheetOpen}
        title="Convidar pessoa"
        description="Ela cria a conta no site com este mesmo e-mail e entra no escritório com o perfil escolhido."
        closeHref={PATH}
      >
        <SheetForm action={inviteMember} closeHref={PATH} submitLabel="Criar convite">
          <div className="sm:col-span-2">
            <ErrorNote message={sp.erro} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Nome">
              <input name="full_name" className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="E-mail">
              <input name="email" type="email" required className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Perfil">
              <select name="role" defaultValue="seller" className={inputCls}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabel[r]} — {roleHint[r]}</option>
                ))}
              </select>
            </Field>
          </div>
        </SheetForm>
      </Sheet>
    </>
  );
}
