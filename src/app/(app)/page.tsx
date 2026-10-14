import Link from "next/link";
import { getContext } from "@/lib/session";
import { getCounts } from "@/lib/counts";
import { getSettings } from "@/lib/settings";
import { setupSteps } from "@/lib/setup";
import { formatOrderNumber, statusInfo } from "@/lib/orders";
import { stageLabel } from "@/lib/leads";
import { brl, formatDate, todayISO } from "@/lib/format";
import { monthInfo } from "@/lib/month";
import { Icon, type IconName } from "@/components/icons";
import { WhatsAppButton } from "@/components/whatsapp";
import { Badge, Card, EmptyState, NewButton, PageHeader, Progress, primaryBtn } from "@/components/ui";

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function todayLabel(): string {
  const s = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type FollowUp = {
  kind: "lead" | "cliente";
  id: string;
  name: string;
  sub: string;
  phone: string | null;
  date: string;
  href: string;
};

type Stat = {
  label: string;
  value: string;
  sub: string;
  href: string;
  icon: IconName;
  valueTone?: "ok" | "alert";
  subAlert?: boolean;
};

export default async function HomePage() {
  const { supabase, canManage, role, isBackOffice } = await getContext();
  const [counts, settings] = await Promise.all([getCounts(), getSettings()]);
  const canOrder = role !== "finance";
  const today = todayISO();
  const month = monthInfo();
  const in7 = addDays(today, 7);

  const [
    { data: monthOrders },
    { data: recent },
    { data: commissions },
    { data: payables7 },
    { data: payablesMonth },
    { data: leadsDue },
    { data: customersDue },
  ] = await Promise.all([
    supabase.from("orders").select("total, status").gte("order_date", month.start).in("status", ["enviado", "faturado", "entregue"]),
    supabase
      .from("orders")
      .select("id, number, status, order_date, total, customers(name), principals(name)")
      .order("number", { ascending: false })
      .limit(6),
    supabase.from("commissions").select("value, status, due_date, received_value").neq("status", "cancelada"),
    isBackOffice
      ? supabase.from("payables").select("amount, due_date").eq("status", "pendente").lte("due_date", in7)
      : Promise.resolve({ data: [] as { amount: number; due_date: string }[] }),
    isBackOffice
      ? supabase.from("payables").select("amount").gte("due_date", month.start).lte("due_date", month.end)
      : Promise.resolve({ data: [] as { amount: number }[] }),
    supabase
      .from("leads")
      .select("id, name, company, phone, stage, next_contact")
      .lte("next_contact", today)
      .not("stage", "in", "(ganho,perdido)")
      .order("next_contact")
      .limit(30),
    supabase
      .from("customers")
      .select("id, name, contact_name, phone, next_contact")
      .lte("next_contact", today)
      .order("next_contact")
      .limit(30),
  ]);

  const sold = (monthOrders ?? []).reduce((s, o) => s + Number(o.total), 0);
  const nSold = (monthOrders ?? []).length;
  const comm = commissions ?? [];
  const toReceive = comm.filter((c) => c.status === "a_receber").reduce((s, c) => s + Number(c.value), 0);
  const lateComm = comm
    .filter((c) => c.status === "a_receber" && c.due_date < today)
    .reduce((s, c) => s + Number(c.value), 0);
  const commMonth = comm
    .filter((c) => c.due_date >= month.start && c.due_date <= month.end)
    .reduce((s, c) => s + Number(c.status === "recebida" ? (c.received_value ?? c.value) : c.value), 0);
  const pay7 = (payables7 ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const payOverdue = (payables7 ?? []).filter((p) => p.due_date < today).length;
  const payMonth = (payablesMonth ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balance = commMonth - payMonth;

  // RN7: follow-ups de hoje e atrasados (leads e clientes).
  const followUps: FollowUp[] = [
    ...(leadsDue ?? []).map((l) => ({
      kind: "lead" as const,
      id: l.id,
      name: l.name,
      sub: [l.company, stageLabel(l.stage)].filter(Boolean).join(" · "),
      phone: l.phone,
      date: l.next_contact as string,
      href: `/leads?lead=${l.id}`,
    })),
    ...(customersDue ?? []).map((c) => ({
      kind: "cliente" as const,
      id: c.id,
      name: c.name,
      sub: c.contact_name ? `Cliente · ${c.contact_name}` : "Cliente",
      phone: c.phone,
      date: c.next_contact as string,
      href: `/clientes/${c.id}?aba=interacoes`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const lateCount = followUps.filter((f) => f.date < today).length;

  const steps = setupSteps(counts, canManage);
  const done = steps.filter((s) => s.n > 0).length;
  const firstPending = steps.find((s) => s.n === 0);

  const monthName = month.label.split(" ")[0].toLowerCase();
  const stats: Stat[] = [
    {
      label: "Vendido no mês",
      value: brl(sold),
      sub: `${nSold} ${nSold === 1 ? "pedido" : "pedidos"} em ${monthName}`,
      href: "/pedidos?periodo=mes",
      icon: "receipt",
    },
    {
      label: "Comissão a receber",
      value: brl(toReceive),
      sub: lateComm ? `${brl(lateComm)} atrasados` : "Nenhuma atrasada",
      href: "/comissoes?status=a_receber",
      icon: "percent",
      subAlert: lateComm > 0,
    },
  ];
  if (isBackOffice) {
    stats.push(
      {
        label: "Contas a pagar (7 dias)",
        value: brl(pay7),
        sub: payOverdue ? `${payOverdue} ${payOverdue === 1 ? "vencida" : "vencidas"}` : "Nenhuma vencida",
        href: "/contas-a-pagar?status=pendentes",
        icon: "wallet",
        subAlert: payOverdue > 0,
      },
      {
        label: "Saldo do mês",
        value: brl(balance),
        sub: "Comissões do mês menos contas",
        href: "/comissoes",
        icon: "layers",
        valueTone: balance >= 0 ? "ok" : "alert",
      },
    );
  }

  // Sem nenhuma representada: o painel ainda não tem o que mostrar.
  if (counts.representadas === 0) {
    return (
      <>
        <PageHeader title={greeting()} hint={todayLabel()} />
        <EmptyState
          icon="factory"
          title="Cadastre sua primeira representada para começar"
          action={
            canManage ? (
              <Link href="/representadas?novo=1" className={primaryBtn}>
                Nova representada
              </Link>
            ) : null
          }
        >
          Informe as empresas que você representa e a comissão de cada uma. Depois é só cadastrar os
          clientes e fazer o primeiro pedido.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={greeting()}
        hint={todayLabel()}
        action={canOrder ? <NewButton label="Novo pedido" href="/pedidos/novo" fab /> : null}
      />

      <dl
        className={`mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-line ${stats.length === 4 ? "lg:grid-cols-4" : ""} [&>*]:bg-white`}
        style={{ gap: 1 }}
      >
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group min-w-0 p-4 transition-colors hover:bg-subtle sm:p-5">
            <dt className="flex items-center gap-1.5 text-[13px] text-muted">
              <Icon name={s.icon} size={14} className="text-faint" />
              <span className="truncate">{s.label}</span>
            </dt>
            <dd
              className={`mt-2 truncate text-xl font-semibold tabular-nums tracking-[-0.02em] sm:text-2xl ${
                s.valueTone === "ok" ? "text-ok" : s.valueTone === "alert" ? "text-alert" : "text-ink"
              }`}
            >
              {s.value}
            </dd>
            <dd className={`mt-0.5 truncate text-xs ${s.subAlert ? "font-medium text-alert" : "text-muted"}`}>{s.sub}</dd>
          </Link>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Card
          title="Follow-ups de hoje"
          hint={
            followUps.length
              ? `${followUps.length} ${followUps.length === 1 ? "contato" : "contatos"}${
                  lateCount ? ` · ${lateCount} atrasado${lateCount === 1 ? "" : "s"}` : ""
                }`
              : undefined
          }
          flush
          action={
            <Link href="/leads" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
              Leads
              <Icon name="arrow-right" size={13} />
            </Link>
          }
        >
          {followUps.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ok-soft text-ok">
                <Icon name="check" size={18} strokeWidth={2.2} />
              </span>
              <p className="mt-3 text-sm font-medium">Nenhum contato pendente para hoje</p>
              <p className="mt-1 max-w-xs text-[13px] text-muted">
                Ao registrar uma conversa com um lead ou cliente, agende o próximo contato: ele aparece aqui no dia.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {followUps.slice(0, 8).map((f) => {
                const late = f.date < today;
                return (
                  <li key={`${f.kind}-${f.id}`} className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle sm:px-5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        late ? "bg-alert-soft text-alert" : "bg-warn-soft text-warn"
                      }`}
                    >
                      <Icon name={f.kind === "lead" ? "sparkle" : "users"} size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link href={f.href} className="block truncate text-sm font-medium after:absolute after:inset-0">
                        {f.name}
                      </Link>
                      <span className="block truncate text-xs text-muted">{f.sub}</span>
                    </span>
                    <span className={`shrink-0 text-xs font-medium ${late ? "text-alert" : "text-warn"}`}>
                      {late ? `Atrasado · ${formatDate(f.date).slice(0, 5)}` : "Hoje"}
                    </span>
                    <WhatsAppButton phone={f.phone} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title="Pedidos recentes"
          flush
          action={
            (recent ?? []).length > 0 ? (
              <Link href="/pedidos" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
                Ver todos
                <Icon name="arrow-right" size={13} />
              </Link>
            ) : null
          }
        >
          {(recent ?? []).length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-subtle text-muted">
                <Icon name="receipt" size={18} />
              </span>
              <p className="mt-3 text-sm font-medium">Nenhum pedido ainda</p>
              <p className="mt-1 max-w-xs text-[13px] text-muted">Cliente, representada e itens: em menos de 2 minutos.</p>
              {canOrder && counts.clientes > 0 ? (
                <Link href="/pedidos/novo" className={`${primaryBtn} mt-5`}>
                  Fazer o primeiro pedido
                </Link>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {(recent ?? []).map((o) => {
                const st = statusInfo(o.status);
                const customer = (o.customers as unknown as { name: string } | null)?.name ?? "";
                const principal = (o.principals as unknown as { name: string } | null)?.name ?? "";
                return (
                  <li key={o.id}>
                    <Link href={`/pedidos/${o.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle sm:px-5">
                      <span className="w-20 shrink-0 truncate font-mono text-xs text-muted">{formatOrderNumber(o.number, settings)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{customer}</span>
                        <span className="block truncate text-xs text-muted">
                          {principal} · {formatDate(o.order_date)}
                        </span>
                      </span>
                      <span className="hidden sm:block">
                        <Badge tone={st.tone} dot>
                          {st.label}
                        </Badge>
                      </span>
                      <span className="w-24 shrink-0 text-right text-sm tabular-nums text-ink">{brl(Number(o.total))}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {firstPending ? (
        <Card title="Primeiros passos" hint={`${done} de ${steps.length} etapas concluídas`} flush className="mt-6">
          <div className="px-4 pt-4 sm:px-5">
            <Progress value={done} max={steps.length} />
          </div>
          <ol className="grid gap-1 p-2 sm:grid-cols-3 sm:p-3">
            {steps.map((step, i) => {
              const complete = step.n > 0;
              const isNext = step === firstPending;
              return (
                <li key={step.href}>
                  <Link
                    href={step.href}
                    className={`group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-hover ${isNext ? "bg-pen-soft/60" : ""}`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        complete
                          ? "bg-pen text-white"
                          : isNext
                            ? "border-[1.5px] border-pen text-pen"
                            : "border-[1.5px] border-line-strong text-faint"
                      }`}
                    >
                      {complete ? <Icon name="check" size={13} strokeWidth={2.6} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${complete ? "text-muted line-through decoration-faint" : "font-medium text-ink"}`}
                      >
                        {step.title}
                      </span>
                      <span className="block truncate text-xs text-muted">{step.desc}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : null}
    </>
  );
}
