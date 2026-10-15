import Link from "next/link";
import { getContext } from "@/lib/session";
import {
  createLead, updateLead, setLeadStage, addLeadInteraction, convertLead, deleteLead,
} from "./actions";
import { LeadBoard, type BoardLead } from "./board";
import { saveLeadLocation, markLeadNotFound, refreshLeads } from "./actions";
import { PinMap, type PinPoint, type PinPending } from "@/components/pin-map";
import { AddressFields } from "@/components/address-fields";
import { LEAD_SOURCES, LEAD_STAGES, stageLabel } from "@/lib/leads";
import { brl, formatDate, safeQ, todayISO } from "@/lib/format";
import { priceText } from "@/lib/orders";
import { Sheet } from "@/components/sheet";
import { SearchBox } from "@/components/search";
import { MaskedInput } from "@/components/masked-input";
import { WhatsAppButton } from "@/components/whatsapp";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit";
import { Icon } from "@/components/icons";
import {
  PageHeader, EmptyState, ErrorNote, OkNote, Field, FormGroup, SheetForm, NewButton, Badge, Toolbar,
  FilterPill, Segmented, Properties, Property, inputCls, textareaCls, primaryBtn, ghostBtn, dangerBtn,
} from "@/components/ui";

const PATH = "/leads";

const nowLocal = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace(" ", "T").slice(0, 16);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });

type Lead = BoardLead & {
  email: string | null; city: string | null; notes: string | null; lost_reason: string | null; created_at: string;
  zip?: string | null; street?: string | null; street_number?: string | null; complement?: string | null;
  district?: string | null; state?: string | null;
  latitude?: number | null; longitude?: number | null; geo_quality?: string | null; geocoded_at?: string | null;
};

// Cor do pin pela etapa do funil.
const STAGE_COLORS: Record<string, string> = {
  novo: "#a8a49b",
  contato_feito: "#0f3d3e",
  proposta: "#ff5b22",
  ganho: "#1e8e5a",
  perdido: "#c8352b",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string; ver?: string; novo?: string; lead?: string; editar?: string; ok?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const q = safeQ(sp.q);
  const { supabase } = await getContext();
  const today = todayISO();

  let query = supabase
    .from("leads")
    .select("*")
    .order("position", { ascending: false });
  if (q) query = query.or(`name.ilike.*${q}*,company.ilike.*${q}*,phone.ilike.*${q}*`);
  const { data, error } = await query;
  const all = (data ?? []) as Lead[];

  const open = all.filter((l) => l.stage !== "ganho" && l.stage !== "perdido");
  const late = open.filter((l) => l.next_contact && l.next_contact < today);
  const dueToday = open.filter((l) => l.next_contact === today);
  const noNext = open.filter((l) => !l.next_contact);
  const won = all.filter((l) => l.stage === "ganho").length;
  const lost = all.filter((l) => l.stage === "perdido").length;
  const proposalValue = all.filter((l) => l.stage === "proposta").reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);

  const shown =
    sp.filtro === "atrasados" ? late : sp.filtro === "hoje" ? dueToday : sp.filtro === "sem-contato" ? noNext : all;

  const lead = all.find((l) => l.id === sp.lead);
  const { data: interactions } = lead
    ? await supabase
        .from("interactions")
        .select("id, happened_at, note")
        .eq("lead_id", lead.id)
        .order("happened_at", { ascending: false })
    : { data: [] as { id: string; happened_at: string; note: string }[] };

  const keep = new URLSearchParams();
  if (sp.q) keep.set("q", sp.q);
  if (sp.filtro) keep.set("filtro", sp.filtro);
  if (sp.ver === "mapa") keep.set("ver", "mapa");
  const keepQs = keep.toString();
  const view = sp.ver === "mapa" ? "mapa" : "quadro";
  const viewHref = (v: string) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (sp.filtro) p.set("filtro", sp.filtro);
    if (v === "mapa") p.set("ver", "mapa");
    const s = p.toString();
    return s ? `${PATH}?${s}` : PATH;
  };

  // Mapa: leads com posição (respeitando o filtro escolhido) e os que ainda faltam localizar.
  const mapPoints: PinPoint[] = (shown as Lead[])
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l) => {
      const lateLead = !!l.next_contact && l.next_contact < today && l.stage !== "ganho" && l.stage !== "perdido";
      return {
        id: l.id,
        name: l.company ? `${l.name} · ${l.company}` : l.name,
        place: [l.district, [l.city, l.state].filter(Boolean).join("/")].filter(Boolean).join(" · "),
        lat: Number(l.latitude),
        lng: Number(l.longitude),
        quality: l.geo_quality ?? null,
        phone: l.phone,
        color: STAGE_COLORS[l.stage] ?? "#a8a49b",
        lines: [
          { text: `Etapa: ${stageLabel(l.stage)}${l.estimated_value ? ` · ${brl(Number(l.estimated_value))}` : ""}` },
          ...(l.next_contact && l.stage !== "ganho" && l.stage !== "perdido"
            ? [{ text: `${lateLead ? "Contato atrasado" : "Próximo contato"}: ${formatDate(l.next_contact)}`, alert: lateLead }]
            : []),
        ],
        href: `${PATH}?lead=${l.id}&ver=mapa`,
        hrefLabel: "Abrir prospecto",
      };
    });
  const pending: PinPending[] = (shown as Lead[])
    .filter((l) => l.latitude == null && !l.geocoded_at && (l.street || l.zip || l.city))
    .map((l) => ({
      id: l.id, name: l.name, street: l.street, street_number: l.street_number, district: l.district,
      city: l.city, state: l.state, zip: l.zip,
    }));
  const noAddress = (shown as Lead[]).filter((l) => l.latitude == null && (l.geocoded_at || !(l.street || l.zip || l.city))).length;
  const closeHref = keepQs ? `${PATH}?${keepQs}` : PATH;
  const leadHref = (id: string, extra = "") => `${PATH}?lead=${id}${extra}${keepQs ? `&${keepQs}` : ""}`;
  const filterHref = (f?: string) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (f) p.set("filtro", f);
    const s = p.toString();
    return s ? `${PATH}?${s}` : PATH;
  };

  return (
    <>
      <PageHeader
        title="Prospecção"
        hint="Potenciais clientes, do primeiro contato ao fechamento. Nenhum fica sem próximo contato."
        action={<NewButton label="Novo prospecto" fab />}
      />

      <div className="mb-4 grid gap-3 empty:hidden">
        {!sp.novo && !sp.lead ? <ErrorNote message={sp.erro} /> : null}
        {!sp.lead ? <OkNote message={sp.ok} /> : null}
      </div>

      {error ? (
        <EmptyState icon="alert" title="Não foi possível carregar a prospecção">
          Confira se a migração 009 foi rodada no Supabase.
        </EmptyState>
      ) : all.length === 0 && !q ? (
        <EmptyState icon="kanban" title="Cadastre seu primeiro prospecto" action={<NewButton label="Novo prospecto" />}>
          Anote quem pode virar cliente, mova pelas etapas do funil e agende o próximo contato para
          não esquecer de ninguém.
        </EmptyState>
      ) : (
        <>
          <dl className="mb-5 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4 [&>div]:bg-surface" style={{ gap: 1 }}>
            <div className="p-4">
              <dt className="text-[13px] text-muted">Em andamento</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{open.length}</dd>
            </div>
            <div className="p-4">
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">
                {late.length ? <span className="h-1.5 w-1.5 rounded-full bg-alert" /> : null}Follow-ups atrasados
              </dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${late.length ? "text-alert" : ""}`}>{late.length}</dd>
            </div>
            <div className="p-4">
              <dt className="text-[13px] text-muted">Em proposta</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{brl(proposalValue)}</dd>
            </div>
            <div className="p-4">
              <dt className="text-[13px] text-muted">Conversão</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—"}
              </dd>
              <dd className="text-xs text-muted">{won} ganhos · {lost} perdidos</dd>
            </div>
          </dl>

          <Toolbar>
            <Segmented>
              <FilterPill href={filterHref()} active={!sp.filtro} count={all.length}>
                Todos
              </FilterPill>
              <FilterPill href={filterHref("hoje")} active={sp.filtro === "hoje"} count={dueToday.length}>
                Hoje
              </FilterPill>
              <FilterPill href={filterHref("atrasados")} active={sp.filtro === "atrasados"} count={late.length}>
                Atrasados
              </FilterPill>
              <FilterPill href={filterHref("sem-contato")} active={sp.filtro === "sem-contato"} count={noNext.length}>
                Sem próximo contato
              </FilterPill>
            </Segmented>
            <div className="w-full sm:ml-auto sm:w-64">
              <SearchBox placeholder="Buscar prospecto" className="w-full" hint />
            </div>
            <div className="inline-flex rounded-[0.6rem] bg-hover p-0.5" role="group" aria-label="Modo de exibição">
              {(["quadro", "mapa"] as const).map((v) => (
                <Link
                  key={v}
                  href={viewHref(v)}
                  scroll={false}
                  aria-current={view === v ? "true" : undefined}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition sm:h-8 ${
                    view === v ? "bg-surface text-ink shadow-panel" : "text-muted hover:text-ink-2"
                  }`}
                >
                  <Icon name={v === "quadro" ? "kanban" : "pin"} size={15} />
                  {v === "quadro" ? "Quadro" : "Mapa"}
                </Link>
              ))}
            </div>
          </Toolbar>

          {view === "mapa" ? (
            <>
              <PinMap
                points={mapPoints}
                pending={pending}
                noun={{ one: "lead", many: "leads" }}
                legend={LEAD_STAGES.map((s) => ({ color: STAGE_COLORS[s.value], label: s.label }))}
                saveAction={saveLeadLocation}
                notFoundAction={markLeadNotFound}
                refreshAction={refreshLeads}
              />
              {noAddress ? (
                <p className="mt-2 text-xs text-muted">
                  {noAddress} {noAddress === 1 ? "prospecto não aparece" : "prospectos não aparecem"} no mapa por falta de endereço ou
                  endereço não encontrado. Informe ao menos o CEP ou a cidade no cadastro.
                </p>
              ) : null}
            </>
          ) : (
            <LeadBoard leads={shown} today={today} qs={keepQs} />
          )}
        </>
      )}

      {/* Novo lead */}
      <Sheet open={sp.novo === "1"} title="Novo prospecto" description="Só o nome é obrigatório. Agende já o próximo contato." closeHref={closeHref}>
        <SheetForm action={createLead} closeHref={closeHref} submitLabel="Salvar prospecto">
          <ErrorNote message={sp.erro} />
          <LeadFields today={today} />
        </SheetForm>
      </Sheet>

      {/* Ficha do lead */}
      <Sheet
        open={!!lead}
        title={lead ? lead.name : "Prospecto"}
        description={lead ? [lead.company, lead.city].filter(Boolean).join(" · ") || undefined : undefined}
        closeHref={closeHref}
      >
        {lead && sp.editar === "1" ? (
          <SheetForm action={updateLead.bind(null, lead.id)} closeHref={leadHref(lead.id)} submitLabel="Salvar alterações">
            <ErrorNote message={sp.erro} />
            <LeadFields today={today} lead={lead} />
          </SheetForm>
        ) : lead ? (
          <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-3 empty:hidden">
              <ErrorNote message={sp.erro} />
              <OkNote message={sp.ok} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 first:mt-0">
              <WhatsAppButton phone={lead.phone} label />
              <Link href={leadHref(lead.id, "&editar=1")} scroll={false} className={ghostBtn}>
                <Icon name="edit" size={14} />
                Editar
              </Link>
              {lead.customer_id ? (
                <Link href={`/clientes/${lead.customer_id}`} className={ghostBtn}>
                  <Icon name="users" size={14} />
                  Ver cliente
                </Link>
              ) : null}
            </div>

            {/* Etapa */}
            <form action={setLeadStage.bind(null, lead.id)} className="mt-5">
              <p className="mb-2 text-[13px] font-medium text-ink-2">Etapa</p>
              <div className="flex flex-wrap gap-1.5">
                {LEAD_STAGES.map((s) => (
                  <button
                    key={s.value}
                    name="stage"
                    value={s.value}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition sm:h-8 ${
                      lead.stage === s.value
                        ? "border-pen bg-pen-soft font-medium text-pen-ink"
                        : "border-line-strong bg-surface text-ink-2 hover:bg-hover"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </button>
                ))}
              </div>
            </form>

            {lead.stage === "ganho" && !lead.customer_id ? (
              <form action={convertLead.bind(null, lead.id)} className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-ok/25 bg-ok-soft p-4">
                <p className="min-w-0 flex-1 text-sm text-ok">Negócio fechado! Transforme este prospecto em cliente para fazer pedidos.</p>
                <SubmitButton className={primaryBtn} pending="Convertendo…">
                  Converter em cliente
                </SubmitButton>
              </form>
            ) : null}

            <div className="mt-5 rounded-xl border border-line p-4">
              <Properties>
                <Property label="Telefone">{lead.phone}</Property>
                <Property label="E-mail">{lead.email}</Property>
                <Property label="Endereço">
                  {[[lead.street, lead.street_number].filter(Boolean).join(", "), lead.district, [lead.city, lead.state].filter(Boolean).join("/")]
                    .filter(Boolean)
                    .join(" · ") || null}
                </Property>
                <Property label="Origem">{lead.source}</Property>
                <Property label="Valor estimado">{lead.estimated_value ? brl(Number(lead.estimated_value)) : null}</Property>
                <Property label="Próximo contato">
                  {lead.next_contact ? (
                    <span className={lead.next_contact < today && lead.stage !== "ganho" && lead.stage !== "perdido" ? "font-medium text-alert" : ""}>
                      {formatDate(lead.next_contact)}
                    </span>
                  ) : null}
                </Property>
                <Property label="Etapa">
                  <Badge>{stageLabel(lead.stage)}</Badge>
                </Property>
              </Properties>
              {lead.notes ? <p className="mt-3 whitespace-pre-line border-t border-line pt-3 text-sm text-ink-2">{lead.notes}</p> : null}
            </div>

            {/* Registrar interação */}
            <form action={addLeadInteraction.bind(null, lead.id)} className="mt-5 rounded-xl border border-line bg-subtle p-3">
              <p className="mb-2 text-[13px] font-medium text-ink-2">Registrar interação</p>
              <textarea
                name="note"
                required
                rows={3}
                placeholder="O que foi conversado?"
                className={`${textareaCls} bg-surface`}
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Quando">
                  <input name="happened_at" type="datetime-local" defaultValue={nowLocal()} className={inputCls} />
                </Field>
                <Field label="Próximo contato">
                  <input name="next_contact" type="date" defaultValue={lead.next_contact && lead.next_contact > today ? lead.next_contact : addDays(today, 7)} className={inputCls} />
                </Field>
              </div>
              <SubmitButton className={`${primaryBtn} mt-3 w-full`} pending="Registrando…">
                Registrar interação
              </SubmitButton>
            </form>

            <h3 className="mb-3 mt-6 text-[13px] font-semibold">Histórico</h3>
            {(interactions ?? []).length === 0 ? (
              <p className="text-sm text-muted">Nenhuma interação ainda.</p>
            ) : (
              <ol className="relative grid gap-4 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
                {(interactions ?? []).map((i) => (
                  <li key={i.id} className="relative">
                    <span className="absolute -left-6 top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-line-strong bg-surface">
                      <span className="h-1.5 w-1.5 rounded-full bg-pen" />
                    </span>
                    <p className="text-xs text-muted">{dateTime(i.happened_at)}</p>
                    <p className="mt-0.5 whitespace-pre-line text-sm">{i.note}</p>
                  </li>
                ))}
              </ol>
            )}

            <form action={deleteLead.bind(null, lead.id)} className="mt-8 border-t border-line pt-4">
              <ConfirmButton message={`Excluir o lead ${lead.name}?`} className={dangerBtn}>
                <Icon name="trash" size={14} />
                Excluir lead
              </ConfirmButton>
            </form>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

function LeadFields({ today, lead }: { today: string; lead?: Lead }) {
  const v = (x: string | null | undefined) => x ?? "";
  return (
    <>
      <Field label="Nome" className="sm:col-span-2">
        <input name="name" required defaultValue={v(lead?.name)} placeholder="Nome da pessoa" className={inputCls} />
      </Field>
      <Field label="Empresa" className="sm:col-span-2">
        <input name="company" defaultValue={v(lead?.company)} className={inputCls} />
      </Field>
      <Field label="Telefone">
        <MaskedInput mask="phone" name="phone" defaultValue={v(lead?.phone)} className={inputCls} />
      </Field>
      <Field label="Origem">
        <input name="source" list="lead-sources" defaultValue={v(lead?.source)} placeholder="Ex.: Indicação" className={inputCls} />
        <datalist id="lead-sources">
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <Field label="E-mail" className="sm:col-span-2">
        <input name="email" type="email" inputMode="email" defaultValue={v(lead?.email)} className={inputCls} />
      </Field>
      <FormGroup title="Endereço" />
      <AddressFields values={lead ?? {}} />
      <FormGroup title="Acompanhamento" />
      <Field label="Próximo contato">
        <input name="next_contact" type="date" defaultValue={lead ? v(lead.next_contact) : addDays(today, 2)} className={inputCls} />
      </Field>
      <Field label="Valor estimado (R$)">
        <input
          name="estimated_value"
          inputMode="decimal"
          defaultValue={lead?.estimated_value ? priceText(Number(lead.estimated_value)) : ""}
          className={`${inputCls} text-right tabular-nums`}
        />
      </Field>
      {!lead ? (
        <Field label="Etapa" className="sm:col-span-2">
          <select name="stage" defaultValue="novo" className={inputCls}>
            {LEAD_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Observações" className="sm:col-span-2">
        <textarea name="notes" rows={3} defaultValue={v(lead?.notes)} className={textareaCls} />
      </Field>
    </>
  );
}
