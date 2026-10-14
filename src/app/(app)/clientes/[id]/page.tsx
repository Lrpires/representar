import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { updateCustomer, deleteCustomer, addInteraction, deleteInteraction } from "../actions";
import { CustomerFields } from "../fields";
import { formatOrderNumber, statusInfo } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { brl, formatDate, todayISO } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { Icon } from "@/components/icons";
import { WhatsAppButton } from "@/components/whatsapp";
import { LogoField } from "@/components/logo-field";
import { logoUrl } from "@/lib/storage";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit";
import {
  PageHeader, Meta, Avatar, Badge, Card, Properties, Property, Tabs, Tab, EmptyState, ErrorNote,
  OkNote, SheetForm, Field, inputCls, textareaCls, primaryBtn, ghostBtn, dangerBtn, iconBtn,
} from "@/components/ui";

const PATH = "/clientes";

// Data e hora de agora no fuso do Brasil, no formato do campo datetime-local.
const nowLocal = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace(" ", "T").slice(0, 16);

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string; aba?: string; editar?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, canManage, role, orgId } = await getContext();
  const settings = await getSettings();

  const [{ data: c }, { data: orders }, { data: interactions }] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id, number, status, order_date, total, principals(name)")
      .eq("customer_id", id)
      .order("number", { ascending: false }),
    supabase
      .from("interactions")
      .select("id, happened_at, note")
      .eq("customer_id", id)
      .order("happened_at", { ascending: false }),
  ]);
  if (!c) notFound();

  const here = `${PATH}/${id}`;
  const tab = sp.aba === "interacoes" ? "interacoes" : "pedidos";
  const editing = sp.editar === "1";
  // Representadas que aparecem nos pedidos do cliente (a mais recente primeiro).
  const boughtFrom = [
    ...new Set(
      (orders ?? [])
        .filter((o) => o.status !== "cancelado")
        .map((o) => (o.principals as unknown as { name: string } | null)?.name)
        .filter(Boolean) as string[],
    ),
  ];
  const place = [c.city, c.state].filter(Boolean).join(" / ");
  const streetLine = [[c.street, c.street_number].filter(Boolean).join(", "), c.complement, c.district]
    .filter(Boolean)
    .join(" · ");

  const year = todayISO().slice(0, 4);
  const counted = (orders ?? []).filter((o) => o.status !== "rascunho" && o.status !== "cancelado");
  const yearOrders = counted.filter((o) => o.order_date.startsWith(year));
  const yearTotal = yearOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const last = counted[0];

  return (
    <>
      <PageHeader
        back={{ href: PATH, label: "Clientes" }}
        leading={<LogoField kind="clientes" id={id} orgId={orgId} name={c.name} url={logoUrl(c.logo_path)} size={52} />}
        title={c.name}
        meta={
          <>
            {c.phone ? <Meta icon="phone">{c.phone}</Meta> : null}
            {place ? <Meta icon="pin">{place}</Meta> : null}
            {c.status !== "ativo" ? <Badge>Inativo</Badge> : null}
          </>
        }
        action={
          <>
            <span className="hidden sm:contents">
              <WhatsAppButton phone={c.phone} label />
            </span>
            <Link href={`${here}?editar=1`} scroll={false} className={ghostBtn}>
              <Icon name="edit" size={15} />
              Editar
            </Link>
            {role !== "finance" ? (
              <Link href={`/pedidos/novo?cliente=${id}`} className={`${primaryBtn} hidden sm:inline-flex`}>
                <Icon name="plus" size={15} strokeWidth={2} />
                Novo pedido
              </Link>
            ) : null}
          </>
        }
      />

      {/* Ações principais no celular, ao alcance do polegar */}
      <div className="-mt-2 mb-5 grid grid-cols-2 gap-2 sm:hidden">
        <WhatsAppButton phone={c.phone} label />
        {role !== "finance" ? (
          <Link href={`/pedidos/novo?cliente=${id}`} className={`${primaryBtn} ${c.phone ? "" : "col-span-2"}`}>
            <Icon name="plus" size={16} strokeWidth={2} />
            Novo pedido
          </Link>
        ) : null}
      </div>

      <div className="mb-4 grid gap-3 empty:hidden">
        {!editing ? <ErrorNote message={sp.erro} /> : null}
        <OkNote message={sp.ok} />
      </div>

      <dl className="mb-6 grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-line [&>div]:bg-white" style={{ gap: 1 }}>
        <div className="p-3.5 sm:p-5">
          <dt className="text-xs text-muted sm:text-[13px]">Total comprado no ano</dt>
          <dd className="mt-1.5 truncate text-base font-semibold tabular-nums tracking-[-0.02em] sm:text-2xl">{brl(yearTotal)}</dd>
        </div>
        <div className="p-3.5 sm:p-5">
          <dt className="text-xs text-muted sm:text-[13px]">Pedidos em {year}</dt>
          <dd className="mt-1.5 text-base font-semibold tabular-nums tracking-[-0.02em] sm:text-2xl">{yearOrders.length}</dd>
        </div>
        <div className="p-3.5 sm:p-5">
          <dt className="text-xs text-muted sm:text-[13px]">Último pedido</dt>
          <dd className="mt-1.5 text-base font-semibold tabular-nums tracking-[-0.02em] sm:text-2xl">
            {last ? formatDate(last.order_date).slice(0, 5) : "—"}
          </dd>
        </div>
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
        <div className="min-w-0">
          <Tabs>
            <Tab href={here} active={tab === "pedidos"} count={(orders ?? []).length}>
              Pedidos
            </Tab>
            <Tab href={`${here}?aba=interacoes`} active={tab === "interacoes"} count={(interactions ?? []).length}>
              Interações
            </Tab>
          </Tabs>

          <div className="pt-4">
            {tab === "pedidos" ? (
              (orders ?? []).length === 0 ? (
                <EmptyState
                  icon="receipt"
                  title="Este cliente ainda não tem pedidos"
                  compact
                  action={
                    role !== "finance" ? (
                      <Link href={`/pedidos/novo?cliente=${id}`} className={primaryBtn}>
                        <Icon name="plus" size={15} strokeWidth={2} />
                        Novo pedido
                      </Link>
                    ) : null
                  }
                >
                  Os pedidos feitos para este cliente aparecem aqui, com valor e situação.
                </EmptyState>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {(orders ?? []).map((o) => {
                    const st = statusInfo(o.status);
                    const p = (o.principals as unknown as { name: string } | null)?.name ?? "";
                    return (
                      <li key={o.id}>
                        <Link href={`/pedidos/${o.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle">
                          <span className="w-20 shrink-0 truncate font-mono text-xs text-muted">{formatOrderNumber(o.number, settings)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{p}</span>
                            <span className="block text-xs text-muted">{formatDate(o.order_date)}</span>
                          </span>
                          <Badge tone={st.tone} dot>
                            {st.label}
                          </Badge>
                          <span className="hidden w-28 shrink-0 text-right text-sm tabular-nums sm:block">{brl(Number(o.total))}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <div className="grid gap-5">
                <form action={addInteraction.bind(null, id)} className="rounded-xl border border-line bg-subtle p-3 sm:p-4">
                  <label htmlFor="note" className="sr-only">
                    O que foi conversado
                  </label>
                  <textarea
                    id="note"
                    name="note"
                    required
                    rows={3}
                    placeholder="O que foi conversado? Ex.: pediu catálogo novo, voltar a ligar na sexta."
                    className={`${textareaCls} bg-white`}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:items-end">
                    <Field label="Data e hora do contato" className="sm:w-56">
                      <input name="happened_at" type="datetime-local" defaultValue={nowLocal()} className={inputCls} />
                    </Field>
                    <Field label="Próximo contato" className="sm:w-44">
                      <input name="next_contact" type="date" defaultValue={c.next_contact ?? ""} className={inputCls} />
                    </Field>
                    <SubmitButton className={`${primaryBtn} col-span-2 sm:ml-auto`} pending="Registrando…">
                      Registrar interação
                    </SubmitButton>
                  </div>
                </form>

                {(interactions ?? []).length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">Nenhuma interação registrada ainda.</p>
                ) : (
                  <ol className="relative grid gap-5 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
                    {(interactions ?? []).map((i) => (
                      <li key={i.id} className="relative">
                        <span className="absolute -left-6 top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-line-strong bg-white">
                          <span className="h-1.5 w-1.5 rounded-full bg-pen" />
                        </span>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs text-muted">{dateTime(i.happened_at)}</p>
                          <form action={deleteInteraction.bind(null, id, i.id)}>
                            <ConfirmButton message="Excluir esta interação?" className={`${iconBtn} -mr-1.5 -mt-2 h-8 w-8`}>
                              <Icon name="trash" size={14} />
                              <span className="sr-only">Excluir interação</span>
                            </ConfirmButton>
                          </form>
                        </div>
                        <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-ink">{i.note}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <Card title="Dados do cliente" action={
            <Link href={`${here}?editar=1`} scroll={false} className={`${iconBtn} -mr-2`} aria-label="Editar">
              <Icon name="edit" size={15} />
            </Link>
          }>
            <Properties>
              <Property label="Contato">{c.contact_name}</Property>
              <Property label="Telefone">{c.phone}</Property>
              <Property label="CNPJ">{c.cnpj ? <span className="font-mono text-xs">{c.cnpj}</span> : null}</Property>
              <Property label="Compra de">{boughtFrom.length ? boughtFrom.join(", ") : null}</Property>
              <Property label="Próximo contato">
                {c.next_contact ? (
                  <span className={c.next_contact <= todayISO() ? "font-medium text-alert" : ""}>{formatDate(c.next_contact)}</span>
                ) : null}
              </Property>
            </Properties>
          </Card>
          <Card title="Endereço">
            {streetLine || place || c.address ? (
              <address className="text-sm not-italic leading-relaxed text-ink-2">
                {streetLine || c.address}
                {place ? <span className="block">{place}</span> : null}
                {c.zip ? <span className="block text-muted">CEP {c.zip}</span> : null}
              </address>
            ) : (
              <p className="text-sm text-faint">Nenhum endereço cadastrado.</p>
            )}
            {streetLine || place ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [streetLine.replaceAll(" · ", ", "), place, c.zip].filter(Boolean).join(", "),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-pen hover:underline"
              >
                Abrir no mapa
                <Icon name="arrow-up-right" size={13} />
              </a>
            ) : null}
          </Card>
          <Card title="Observações">
            {c.notes ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{c.notes}</p>
            ) : (
              <p className="text-sm text-faint">Nenhuma observação.</p>
            )}
          </Card>
        </aside>
      </div>

      <Sheet open={editing} title="Editar cliente" closeHref={here}>
        <SheetForm action={updateCustomer.bind(null, id)} closeHref={here} submitLabel="Salvar alterações">
          <ErrorNote message={sp.erro} />
          <CustomerFields values={c} />
          {canManage ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-alert/20 p-3 sm:col-span-2">
              <p className="text-[13px] text-muted">Excluir apaga o cliente e as interações. Só é possível sem pedidos.</p>
              <ConfirmButton
                message={`Excluir ${c.name}? Essa ação não pode ser desfeita.`}
                formAction={deleteCustomer.bind(null, id)}
                className={dangerBtn}
              >
                Excluir
              </ConfirmButton>
            </div>
          ) : null}
        </SheetForm>
      </Sheet>
    </>
  );
}
