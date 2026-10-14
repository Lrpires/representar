import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext, roleLabel, roleHint, ROLES, type Role } from "@/lib/session";
import { inviteMember, cancelInvite, updateMember, removeMember } from "./actions";
import { brl, formatDate, todayISO } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { Icon } from "@/components/icons";
import { ConfirmButton } from "@/components/confirm-button";
import {
  PageHeader, Field, ErrorNote, OkNote, Badge, Avatar, SheetForm, NewButton, TableShell, CardList,
  inputCls, th, td, tr, dangerBtn, iconBtn,
} from "@/components/ui";

const PATH = "/equipe";

const PLURAL: Record<Role, string> = {
  owner: "Administradores",
  manager: "Gerentes",
  seller: "Vendedores",
  finance: "Financeiro",
};

const tone = { owner: "ink", manager: "pen", seller: "info", finance: "ok" } as const;

// O que cada perfil pode fazer (espelha as regras do banco).
const MATRIX: { label: string; roles: Role[] }[] = [
  { label: "Fazer pedidos e cadastrar clientes", roles: ["owner", "manager", "seller"] },
  { label: "Ver pedidos e clientes de toda a equipe", roles: ["owner", "manager", "finance"] },
  { label: "Cadastrar representadas e produtos", roles: ["owner", "manager"] },
  { label: "Registrar faturamento e comissões", roles: ["owner", "manager", "finance"] },
  { label: "Contas a pagar", roles: ["owner", "manager", "finance"] },
  { label: "Ver a equipe", roles: ["owner", "manager"] },
  { label: "Convidar pessoas e mudar perfis", roles: ["owner"] },
  { label: "Configurações do escritório", roles: ["owner"] },
];

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; novo?: string; editar?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, orgId, user, role, isOwner } = await getContext();
  if (role !== "owner" && role !== "manager") redirect("/");

  const monthStart = `${todayISO().slice(0, 7)}-01`;
  const [{ data: members }, { data: invites }, { data: orders }] = await Promise.all([
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
      : Promise.resolve({ data: [] as { id: string; email: string; full_name: string | null; role: string; created_at: string }[] }),
    supabase
      .from("orders")
      .select("seller_id, total, status")
      .gte("order_date", monthStart)
      .in("status", ["enviado", "faturado", "entregue"]),
  ]);

  // Vendas do mês por pessoa.
  const sales = new Map<string, { n: number; total: number }>();
  for (const o of orders ?? []) {
    const s = sales.get(o.seller_id) ?? { n: 0, total: 0 };
    s.n += 1;
    s.total += Number(o.total);
    sales.set(o.seller_id, s);
  }

  const people = members ?? [];
  const editing = people.find((m) => m.id === sp.editar);
  const sheetOpen = isOwner && (sp.novo === "1");
  const nameOf = (m: { full_name: string | null; email: string | null }) => m.full_name || m.email || "Usuário";

  return (
    <>
      <PageHeader
        title="Equipe"
        hint="Quem tem acesso ao escritório, o que cada um vendeu no mês e o que cada perfil pode fazer."
        action={isOwner ? <NewButton label="Convidar pessoa" fab /> : null}
      />

      <div className="mb-4 grid gap-3 empty:hidden">
        <ErrorNote message={sp.erro} />
        <OkNote message={sp.ok} />
      </div>

      {/* Resumo por perfil */}
      <dl className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4 [&>div]:bg-white" style={{ gap: 1 }}>
        {ROLES.map((r) => (
          <div key={r} className="p-4">
            <dt className="text-[13px] text-muted">{PLURAL[r]}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{people.filter((m) => m.role === r).length}</dd>
          </div>
        ))}
      </dl>

      {/* Pessoas */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Pessoas <span className="ml-1 font-normal text-muted">{people.length}</span>
        </h2>
        <TableShell>
          <thead>
            <tr>
              <th className={th}>Pessoa</th>
              <th className={th}>Perfil</th>
              <th className={th}>Na equipe desde</th>
              <th className={`${th} text-right`}>Pedidos no mês</th>
              <th className={`${th} text-right`}>Vendido no mês</th>
              <th className={`${th} w-14`}>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((m) => {
              const s = sales.get(m.user_id);
              const mine = m.user_id === user.id;
              return (
                <tr key={m.id} className={tr}>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <Avatar name={nameOf(m)} size={32} round />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {nameOf(m)} {mine ? <span className="text-xs font-normal text-muted">(você)</span> : null}
                        </p>
                        {m.full_name && m.email ? <p className="truncate text-xs text-muted">{m.email}</p> : null}
                      </div>
                    </div>
                  </td>
                  <td className={td}>
                    <Badge tone={tone[m.role as Role]}>{roleLabel[m.role as Role]}</Badge>
                  </td>
                  <td className={`${td} tabular-nums text-ink-2`}>{formatDate(String(m.created_at).slice(0, 10))}</td>
                  <td className={`${td} text-right tabular-nums text-ink-2`}>{s?.n ?? 0}</td>
                  <td className={`${td} text-right font-medium tabular-nums`}>{brl(s?.total ?? 0)}</td>
                  <td className={`${td} text-right`}>
                    {isOwner ? (
                      <Link href={`${PATH}?editar=${m.id}`} scroll={false} className={iconBtn} aria-label={`Editar ${nameOf(m)}`}>
                        <Icon name="edit" size={15} />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>

        <CardList>
          {people.map((m) => {
            const s = sales.get(m.user_id);
            const content = (
              <>
                <Avatar name={nameOf(m)} size={38} round />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">
                    {nameOf(m)} {m.user_id === user.id ? <span className="text-xs font-normal text-muted">(você)</span> : null}
                  </p>
                  <p className="text-[13px] text-muted">
                    {s?.n ?? 0} pedidos no mês · {brl(s?.total ?? 0)}
                  </p>
                </div>
                <Badge tone={tone[m.role as Role]}>{roleLabel[m.role as Role]}</Badge>
              </>
            );
            return (
              <li key={m.id}>
                {isOwner ? (
                  <Link href={`${PATH}?editar=${m.id}`} scroll={false} className="flex items-center gap-3 px-4 py-3 active:bg-hover">
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">{content}</div>
                )}
              </li>
            );
          })}
        </CardList>

        {isOwner && people.length === 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pen-soft text-pen">
              <Icon name="users" size={18} />
            </span>
            <p className="min-w-0 flex-1 text-sm text-ink-2">
              Trabalha com vendedores ou uma assistente? Convide e cada um entra com o próprio login.
            </p>
            <NewButton label="Convidar pessoa" />
          </div>
        ) : null}
      </section>

      {/* Convites pendentes */}
      {isOwner && (invites ?? []).length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-semibold">
            Convites pendentes <span className="ml-1 font-normal text-muted">{(invites ?? []).length}</span>
          </h2>
          <p className="mb-3 text-[13px] text-muted">
            A pessoa entra sozinha ao criar a conta no site com o e-mail convidado.
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
            {(invites ?? []).map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-muted">
                  <Icon name="mail" size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.full_name || i.email}</p>
                  <p className="truncate text-xs text-muted">
                    {i.full_name ? `${i.email} · ` : ""}convidado em {formatDate(String(i.created_at).slice(0, 10))}
                  </p>
                </div>
                <Badge tone={tone[i.role as Role]}>{roleLabel[i.role as Role]}</Badge>
                <form action={cancelInvite.bind(null, i.id)}>
                  <ConfirmButton message="Cancelar este convite?" className={dangerBtn}>
                    Cancelar
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Permissões */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">O que cada perfil pode fazer</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="border-b border-line bg-subtle">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted">Permissão</th>
                {ROLES.map((r) => (
                  <th key={r} className="w-28 px-2 py-2.5 text-center text-xs font-medium text-muted" title={roleHint[r]}>
                    {roleLabel[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.label} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5 text-ink-2">{row.label}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-2 py-2.5 text-center">
                      {row.roles.includes(r) ? (
                        <Icon name="check" size={16} strokeWidth={2.2} className="inline text-ok" />
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Convidar */}
      <Sheet
        open={sheetOpen}
        title="Convidar pessoa"
        description="Ela cria a conta no site com este mesmo e-mail e já entra no escritório com o perfil escolhido."
        closeHref={PATH}
      >
        <SheetForm action={inviteMember} closeHref={PATH} submitLabel="Criar convite">
          <Field label="Nome" className="sm:col-span-2">
            <input name="full_name" className={inputCls} />
          </Field>
          <Field label="E-mail" className="sm:col-span-2">
            <input name="email" type="email" inputMode="email" required className={inputCls} />
          </Field>
          <RolePicker defaultRole="seller" />
        </SheetForm>
      </Sheet>

      {/* Editar pessoa */}
      <Sheet open={isOwner && !!editing} title={editing ? `Editar ${nameOf(editing)}` : "Editar"} closeHref={PATH}>
        {editing ? (
          <SheetForm action={updateMember.bind(null, editing.id)} closeHref={PATH} submitLabel="Salvar">
            <Field label="Nome" className="sm:col-span-2">
              <input name="full_name" defaultValue={editing.full_name ?? ""} className={inputCls} />
            </Field>
            {editing.user_id === user.id ? (
              <>
                <input type="hidden" name="role" value={editing.role} />
                <p className="rounded-lg bg-subtle px-3 py-2.5 text-[13px] text-ink-2 sm:col-span-2">
                  Você é {roleLabel[editing.role as Role].toLowerCase()} e não pode mudar o próprio perfil.
                </p>
              </>
            ) : (
              <RolePicker defaultRole={editing.role as Role} />
            )}
            {editing.user_id !== user.id ? (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-alert/20 p-3 sm:col-span-2">
                <p className="text-[13px] text-muted">A pessoa perde o acesso ao escritório. Os pedidos dela continuam.</p>
                <ConfirmButton
                  message={`Remover ${nameOf(editing)} da equipe?`}
                  formAction={removeMember.bind(null, editing.id)}
                  className={dangerBtn}
                >
                  Remover
                </ConfirmButton>
              </div>
            ) : null}
          </SheetForm>
        ) : null}
      </Sheet>
    </>
  );
}

// Escolha do perfil em cartões, com a explicação de cada um.
function RolePicker({ defaultRole }: { defaultRole: Role }) {
  return (
    <fieldset className="grid gap-2 sm:col-span-2">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Perfil</legend>
      {ROLES.map((r) => (
        <label
          key={r}
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-strong p-3 transition has-[:checked]:border-pen has-[:checked]:bg-pen-soft/60 hover:bg-subtle"
        >
          <input type="radio" name="role" value={r} defaultChecked={r === defaultRole} className="mt-0.5 h-4 w-4 accent-[var(--color-pen)]" />
          <span>
            <span className="block text-sm font-medium">{roleLabel[r]}</span>
            <span className="block text-xs leading-snug text-muted">{roleHint[r]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
