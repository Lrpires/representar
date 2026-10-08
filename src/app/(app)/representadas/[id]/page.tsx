import { notFound } from "next/navigation";
import { getContext } from "@/lib/session";
import { updatePrincipal, addContact, deleteContact, addTier, deleteTier } from "./actions";
import {
  baseOptions, triggerOptions, releaseOptions, closeOptions, payOptions, commissionSummary,
  type Option,
} from "@/lib/commission";
import { pct } from "@/lib/format";
import { Icon, type IconName } from "@/components/icons";
import {
  PageHeader, Field, ErrorNote, OkNote, Badge, Avatar, inputCls, primaryBtn, ghostBtn,
} from "@/components/ui";
import type { ReactNode } from "react";

const PATH = "/representadas";

function Section({
  icon, title, hint, children,
}: { icon: IconName; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-subtle text-pen">
          <Icon name={icon} size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {hint ? <p className="mt-0.5 text-[13px] leading-snug text-muted">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Select({ name, value, options }: { name: string; value: string; options: readonly Option[] }) {
  return (
    <select name={name} defaultValue={value} className={inputCls}>
      {options.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

const grid = "grid gap-4 sm:grid-cols-2";
const check = "h-5 w-5 shrink-0 rounded border-line-strong accent-[#0b0b0f]";

// "2026-12-25" -> "25/12" (o ano não aparece)
const dayMonth = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

export default async function PrincipalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, canManage } = await getContext();

  const [{ data: p }, { data: contacts }, { data: tiers }] = await Promise.all([
    supabase.from("principals").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("principal_contacts")
      .select("id, name, role, phone, email, birthday, is_main")
      .eq("principal_id", id)
      .order("is_main", { ascending: false })
      .order("name"),
    supabase
      .from("principal_commission_tiers")
      .select("id, discount_from, discount_to, commission_pct")
      .eq("principal_id", id)
      .order("discount_from"),
  ]);
  if (!p) notFound();

  const v = (x: string | number | null | undefined) => (x == null ? "" : String(x));
  const save = updatePrincipal.bind(null, id);
  const addContactFor = addContact.bind(null, id);
  const addTierFor = addTier.bind(null, id);

  return (
    <>
      <PageHeader
        title={p.name}
        hint={p.legal_name || undefined}
        back={{ href: PATH, label: "Representadas" }}
        action={<Badge tone={p.active ? "ok" : "neutral"}>{p.active ? "Ativa" : "Inativa"}</Badge>}
      />

      <div className="mb-4 max-w-3xl empty:hidden [&>*]:mb-3">
        <ErrorNote message={sp.erro} />
        <OkNote message={sp.ok} />
      </div>

      <div className="grid max-w-3xl gap-4 lg:gap-5">
        {/* ---------- Resumo da regra de comissão ---------- */}
        <div className="flex gap-3 rounded-[1.75rem] border border-pen/15 bg-linear-to-b from-[#eef2ff] to-[#f5f7ff] p-5">
          <Avatar name={p.name} size={44} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-pen-ink">Como esta fábrica paga a sua comissão</p>
            <p className="mt-1 text-sm leading-relaxed">{commissionSummary(p)}</p>
          </div>
        </div>

        <form action={save} className="grid gap-4 lg:gap-5">
          <fieldset disabled={!canManage} className="m-0 grid min-w-0 gap-4 border-0 p-0 lg:gap-5">
            <Section icon="factory" title="Dados da fábrica">
              <div className={grid}>
                <div className="sm:col-span-2">
                  <Field label="Nome (como você chama)">
                    <input name="name" required defaultValue={p.name} className={inputCls} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Razão social">
                    <input name="legal_name" defaultValue={v(p.legal_name)} className={inputCls} />
                  </Field>
                </div>
                <Field label="CNPJ">
                  <input name="cnpj" inputMode="numeric" defaultValue={v(p.cnpj)} className={inputCls} />
                </Field>
                <Field label="Inscrição estadual">
                  <input name="state_reg" defaultValue={v(p.state_reg)} className={inputCls} />
                </Field>
                <Field label="Telefone">
                  <input name="phone" inputMode="tel" defaultValue={v(p.phone)} className={inputCls} />
                </Field>
                <Field label="E-mail geral">
                  <input name="email" type="email" defaultValue={v(p.email)} className={inputCls} />
                </Field>
                <Field label="E-mail para enviar pedidos" hint="Onde a fábrica recebe os pedidos.">
                  <input name="order_email" type="email" defaultValue={v(p.order_email)} className={inputCls} />
                </Field>
                <Field label="Site">
                  <input name="website" defaultValue={v(p.website)} className={inputCls} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Contato (resumo)" hint="Para vários contatos, use a seção Contatos mais abaixo.">
                    <input name="contact" defaultValue={v(p.contact)} className={inputCls} />
                  </Field>
                </div>
              </div>
            </Section>

            <Section icon="pin" title="Endereço">
              <div className="grid gap-4 sm:grid-cols-6">
                <div className="sm:col-span-2">
                  <Field label="CEP">
                    <input name="zip" inputMode="numeric" defaultValue={v(p.zip)} className={inputCls} />
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="Rua">
                    <input name="street" defaultValue={v(p.street)} className={inputCls} />
                  </Field>
                </div>
                <div className="sm:col-span-1">
                  <Field label="Número">
                    <input name="street_number" defaultValue={v(p.street_number)} className={inputCls} />
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="Complemento">
                    <input name="complement" defaultValue={v(p.complement)} className={inputCls} />
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="Bairro">
                    <input name="district" defaultValue={v(p.district)} className={inputCls} />
                  </Field>
                </div>
                <div className="sm:col-span-4">
                  <Field label="Cidade">
                    <input name="city" defaultValue={v(p.city)} className={inputCls} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="UF">
                    <input name="state" maxLength={2} defaultValue={v(p.state)} className={`${inputCls} uppercase`} />
                  </Field>
                </div>
              </div>
            </Section>

            <Section icon="file" title="Contrato e condições comerciais">
              <div className={grid}>
                <Field label="Início da representação">
                  <input name="contract_start" type="date" defaultValue={v(p.contract_start)} className={inputCls} />
                </Field>
                <Field label="Fim do contrato" hint="Deixe vazio se for prazo indeterminado.">
                  <input name="contract_end" type="date" defaultValue={v(p.contract_end)} className={inputCls} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Região de atuação / exclusividade">
                    <input name="territory" defaultValue={v(p.territory)} className={inputCls} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Condições de pagamento do cliente" hint="Ex.: 30/60/90 dias, à vista com 3% de desconto.">
                    <input name="payment_terms" defaultValue={v(p.payment_terms)} className={inputCls} />
                  </Field>
                </div>
              </div>
            </Section>

            <Section
              icon="percent"
              title="Comissão"
              hint="Cada fábrica paga de um jeito. É esta regra que vai calcular o seu relatório de recebimentos."
            >
              <div className={grid}>
                <Field label="Comissão padrão (%)">
                  <input name="commission" inputMode="decimal" defaultValue={v(p.default_commission_pct)} className={inputCls} />
                </Field>
                <Field label="Sobre o quê incide">
                  <Select name="commission_base" value={p.commission_base} options={baseOptions} />
                </Field>
                <Field label="Quando fica devida">
                  <Select name="commission_trigger" value={p.commission_trigger} options={triggerOptions} />
                </Field>
                <Field label="Como é liberada">
                  <Select name="commission_release" value={p.commission_release} options={releaseOptions} />
                </Field>
                <Field label="Quando a fábrica acerta com você">
                  <Select name="commission_close_mode" value={p.commission_close_mode} options={closeOptions} />
                </Field>
                <Field label="Como o dinheiro chega">
                  <Select name="commission_pay_method" value={p.commission_pay_method} options={payOptions} />
                </Field>
                <Field label="Dia do mês do acerto" hint="Use quando escolher “Em dia fixo do mês seguinte”.">
                  <input name="commission_close_day" inputMode="numeric" defaultValue={v(p.commission_close_day)} className={inputCls} />
                </Field>
                <Field label="Dias depois do evento" hint="Use quando escolher “Alguns dias depois do evento”.">
                  <input name="commission_days_after" inputMode="numeric" defaultValue={v(p.commission_days_after)} className={inputCls} />
                </Field>
              </div>

              <div className="mt-5 grid gap-3 border-t border-line pt-5">
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" name="commission_needs_invoice" defaultChecked={p.commission_needs_invoice} className={check} />
                  Preciso emitir nota fiscal ou recibo para receber
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" name="commission_chargeback" defaultChecked={p.commission_chargeback} className={check} />
                  Devolução ou inadimplência do cliente estorna a comissão
                </label>
                <div className="sm:max-w-xs">
                  <Field label="Estorno possível por quantos dias?" hint="Deixe vazio se não há limite.">
                    <input name="commission_chargeback_days" inputMode="numeric" defaultValue={v(p.commission_chargeback_days)} className={inputCls} />
                  </Field>
                </div>
                <Field label="Observações da comissão">
                  <textarea
                    name="commission_notes"
                    rows={3}
                    defaultValue={v(p.commission_notes)}
                    className={`${inputCls} h-auto py-3`}
                  />
                </Field>
              </div>
            </Section>

            <Section icon="file" title="Anotações">
              <textarea name="notes" rows={4} defaultValue={v(p.notes)} className={`${inputCls} h-auto py-3`} />
            </Section>
          </fieldset>

          {canManage ? (
            <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 flex justify-end lg:bottom-4">
              <button className={`${primaryBtn} w-full shadow-float sm:w-auto sm:px-8`}>Salvar alterações</button>
            </div>
          ) : null}
        </form>

        {/* ---------- Faixas de comissão por desconto ---------- */}
        <Section
          icon="percent"
          title="Comissão por faixa de desconto"
          hint="Se a fábrica paga menos quando você dá desconto ao cliente. Ex.: até 5% de desconto paga 5%; de 5,01% a 10% paga 4%."
        >
          {tiers && tiers.length > 0 ? (
            <ul className="mb-4 divide-y divide-line rounded-2xl border border-line">
              {tiers.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    Desconto de <b>{pct(t.discount_from)}</b>
                    {t.discount_to != null ? <> até <b>{pct(t.discount_to)}</b></> : <> ou mais</>}
                    {" "}→ comissão de <b>{pct(t.commission_pct)}</b>
                  </span>
                  {canManage ? (
                    <form action={deleteTier.bind(null, id, t.id)}>
                      <button aria-label="Remover faixa" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-hover hover:text-ink">
                        <Icon name="x" size={16} />
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted">Nenhuma faixa. Vale a comissão padrão para qualquer desconto.</p>
          )}
          {canManage ? (
            <form action={addTierFor} className="grid gap-3 sm:grid-cols-4 sm:items-end">
              <Field label="Desconto de (%)">
                <input name="discount_from" inputMode="decimal" placeholder="0" className={inputCls} />
              </Field>
              <Field label="Até (%)" hint="Vazio = sem limite.">
                <input name="discount_to" inputMode="decimal" placeholder="5" className={inputCls} />
              </Field>
              <Field label="Comissão (%)">
                <input name="commission_pct" inputMode="decimal" required placeholder="5" className={inputCls} />
              </Field>
              <button className={ghostBtn}>Adicionar faixa</button>
            </form>
          ) : null}
        </Section>

        {/* ---------- Contatos ---------- */}
        <Section icon="users" title="Contatos na fábrica" hint="Comercial, financeiro, logística. Guarde o aniversário para não esquecer.">
          {contacts && contacts.length > 0 ? (
            <ul className="mb-4 divide-y divide-line rounded-2xl border border-line">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={c.name} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {c.name}
                      {c.is_main ? <Badge tone="pen">Principal</Badge> : null}
                    </p>
                    <p className="truncate text-[13px] text-muted">
                      {[c.role, c.phone, c.email].filter(Boolean).join(" · ") || "Sem outros dados"}
                    </p>
                  </div>
                  {c.birthday ? (
                    <span className="hidden shrink-0 items-center gap-1.5 text-[13px] text-muted sm:flex">
                      <Icon name="calendar" size={14} />
                      {dayMonth(c.birthday)}
                    </span>
                  ) : null}
                  {canManage ? (
                    <form action={deleteContact.bind(null, id, c.id)}>
                      <button aria-label="Remover contato" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-hover hover:text-ink">
                        <Icon name="x" size={16} />
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted">Nenhum contato cadastrado.</p>
          )}
          {canManage ? (
            <form action={addContactFor} className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
              <Field label="Nome">
                <input name="name" required className={inputCls} />
              </Field>
              <Field label="Função" hint="Ex.: financeiro, comercial.">
                <input name="role" className={inputCls} />
              </Field>
              <Field label="Telefone / WhatsApp">
                <input name="phone" inputMode="tel" className={inputCls} />
              </Field>
              <Field label="E-mail">
                <input name="email" type="email" className={inputCls} />
              </Field>
              <Field label="Aniversário" hint="Dia e mês, ex.: 25/12. O ano é opcional (25/12/1980).">
                <input name="birthday" inputMode="numeric" placeholder="25/12" className={inputCls} />
              </Field>
              <label className="flex items-center gap-3 self-center text-sm sm:pt-5">
                <input type="checkbox" name="is_main" className={check} />
                Contato principal
              </label>
              <div className="sm:col-span-2 sm:flex sm:justify-end">
                <button className={ghostBtn}>Adicionar contato</button>
              </div>
            </form>
          ) : null}
        </Section>
      </div>
    </>
  );
}
