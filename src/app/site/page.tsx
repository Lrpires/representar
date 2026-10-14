import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { Pricing, Reveal, ScaleFrame, Showcase, SiteHeader, type ShowcaseTab } from "./client";
import { INCLUDED, TRIAL_DAYS } from "./plans";
import {
  Chip,
  ComissoesScreen,
  FaturamentoScreen,
  MapaScreen,
  MetasScreen,
  PainelScreen,
  PedidosScreen,
  Phone,
  PhoneOrder,
  Window,
} from "./mockups";

export const metadata: Metadata = {
  title: { absolute: "Representar — o sistema do representante comercial" },
  description:
    "Pedidos, faturamento pelo XML da NF-e, comissões por nota, metas e carteira de clientes no mapa. Para representantes e escritórios de representação.",
  openGraph: {
    title: "Representar — do pedido à comissão, sem planilha",
    description: "O sistema do representante comercial: pedidos, faturamento, comissões, metas e clientes no mapa.",
    locale: "pt_BR",
    type: "website",
  },
};

/* ---------------------------------------------------------------- peças da página */

function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return <p className={`text-[13px] font-semibold tracking-wide ${dark ? "text-[#9fe3c4]" : "text-pen"}`}>{children}</p>;
}

function H2({ children, dark, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <h2 className={`text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[2.6rem] ${dark ? "text-white" : "text-ink"} ${className}`}>
      {children}
    </h2>
  );
}

function Lead({ children, dark, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <p className={`text-pretty text-[16px] leading-relaxed sm:text-[17px] ${dark ? "text-white/65" : "text-muted"} ${className}`}>{children}</p>;
}

function FloatCard({ icon, tone, title, text, className = "" }: { icon: IconName; tone: string; title: string; text: string; className?: string }) {
  return (
    <div
      className={`flex w-[272px] items-start gap-3 rounded-xl bg-white/95 p-3.5 shadow-[0_0_0_1px_rgba(20,33,42,0.06),0_20px_40px_-12px_rgba(10,43,52,0.35)] backdrop-blur ${className}`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-muted">{text}</span>
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- conteúdo */

const pains: { before: string; after: string; icon: IconName }[] = [
  {
    icon: "layers",
    before: "Pedido em planilha, caderno e WhatsApp",
    after: "Todo pedido num lugar só, com PDF pronto para mandar ao cliente e à fábrica.",
  },
  {
    icon: "percent",
    before: "Comissão que ninguém sabe se caiu",
    after: "Cada nota fiscal gera a comissão com vencimento. O que atrasou fica em vermelho.",
  },
  {
    icon: "clock",
    before: "Pedido parado sem ninguém perceber",
    after: "Avisos amarelo e vermelho quando a fábrica demora a faturar, no prazo que você define.",
  },
];

const tabs: ShowcaseTab[] = [
  {
    id: "painel",
    label: "Painel",
    icon: "home",
    title: "O mês inteiro numa olhada",
    text: "Vendido, faturado, comissão prevista e a comparação com o mês anterior. Filtre por período, vendedor ou representada e veja na hora o que mudou.",
    points: ["Ranking de clientes, representadas e produtos", "Pedidos em atraso no topo, os críticos primeiro", "Quanto falta por dia para bater a meta"],
    screen: (
      <ScaleFrame width={1120}>
        <Window title="Painel">
          <PainelScreen />
        </Window>
      </ScaleFrame>
    ),
  },
  {
    id: "pedidos",
    label: "Pedidos",
    icon: "receipt",
    title: "Pedido feito em menos de dois minutos",
    text: "Escolha o cliente e a representada, digite os itens ou puxe do catálogo. Total, desconto e prazo calculados na hora, com numeração automática do jeito do seu escritório.",
    points: ["Itens digitados à mão ou do catálogo de produtos", "PDF com a sua logo e envio pelo WhatsApp", "Filtro de atrasados e do que aguarda faturamento"],
    screen: (
      <ScaleFrame width={1120}>
        <Window title="Pedidos">
          <PedidosScreen />
        </Window>
      </ScaleFrame>
    ),
  },
  {
    id: "faturamento",
    label: "Faturamento",
    icon: "file",
    title: "Solte o XML da nota. Pronto.",
    text: "O sistema lê a NF-e, encontra o pedido certo pelo CNPJ do cliente e da fábrica, confere item por item e lança as quantidades. Você só confirma.",
    points: ["Número, série, data, valor e chave de acesso preenchidos", "Faturamento parcial quando a fábrica manda só uma parte", "A mesma nota nunca é lançada duas vezes"],
    screen: (
      <ScaleFrame width={1120}>
        <Window title="Faturamento">
          <FaturamentoScreen />
        </Window>
      </ScaleFrame>
    ),
  },
  {
    id: "comissoes",
    label: "Comissões",
    icon: "percent",
    title: "Cada centavo de comissão, conferido",
    text: "A comissão nasce da nota fiscal, com o percentual do pedido e o vencimento combinado com a representada. Recebeu? Confira o valor e dê baixa com um clique.",
    points: ["Valor sugerido = nota × percentual do pedido", "Recebimento parcial quando a fábrica paga a menos", "Totais por representada e atrasadas em destaque"],
    screen: (
      <ScaleFrame width={1120}>
        <Window title="Comissões">
          <ComissoesScreen />
        </Window>
      </ScaleFrame>
    ),
  },
  {
    id: "mapa",
    label: "Clientes no mapa",
    icon: "pin",
    title: "Sua carteira desenhada no mapa",
    text: "Cada cliente vira um pino pelo endereço. Monte a rota da semana, veja quem está há tempo sem comprar e aproveite a viagem para visitar os leads da região.",
    points: ["Endereço completo pelo CEP e dados pelo CNPJ", "Arraste o pino para corrigir a posição", "Leads no mesmo mapa, prontos para virar cliente"],
    screen: (
      <ScaleFrame width={1120}>
        <Window title="Clientes">
          <MapaScreen />
        </Window>
      </ScaleFrame>
    ),
  },
  {
    id: "metas",
    label: "Metas",
    icon: "target",
    title: "Metas que fecham a conta",
    text: "A meta do escritório é a soma das metas de cada vendedor ou representada, sem número solto. Todo mundo acompanha o próprio ritmo em tempo real.",
    points: ["Por vendedor, por representada ou geral", "Ritmo diário pelos dias úteis que faltam", "Histórico mês a mês"],
    screen: (
      <ScaleFrame width={1120}>
        <Window title="Metas">
          <MetasScreen />
        </Window>
      </ScaleFrame>
    ),
  },
];

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: "search", title: "CNPJ que se preenche", text: "Digite o CNPJ e o nome, endereço e telefone aparecem sozinhos." },
  { icon: "pin", title: "Endereço pelo CEP", text: "Rua, bairro e cidade em um clique, com o pino no mapa." },
  { icon: "kanban", title: "Leads com próximo passo", text: "Funil de prospecção com data de retorno. Virou cliente? Um clique." },
  { icon: "wallet", title: "Contas a pagar", text: "As despesas do escritório ao lado do que entra de comissão." },
  { icon: "users", title: "Equipe com permissões", text: "Dono, gerente, vendedor e financeiro, cada um vendo o que deve." },
  { icon: "sparkle", title: "Com a sua cara", text: "Sua logo e suas cores no sistema e nos pedidos impressos." },
  { icon: "box", title: "Catálogo opcional", text: "Produtos com foto e código, ou itens digitados na hora." },
  { icon: "shield", title: "Dados protegidos", text: "Cada escritório só enxerga os próprios dados. Sempre." },
];

const faq: { q: string; a: string }[] = [
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. O Representar funciona no navegador do computador e do celular. No celular, você pode adicionar à tela de início e ele abre como um aplicativo, em tela cheia.",
  },
  {
    q: "Como funciona o teste grátis?",
    a: `Você usa o plano escolhido completo por ${TRIAL_DAYS} dias, sem cadastrar cartão. No fim do período, escolhe se quer continuar.`,
  },
  {
    q: "Consigo trazer meus clientes e produtos da planilha?",
    a: "Sim. Você pode cadastrar aos poucos (o CNPJ e o CEP preenchem quase tudo) ou nos mandar a planilha que ajudamos a importar.",
  },
  {
    q: "E se a fábrica faturar só uma parte do pedido?",
    a: "O pedido fica como Faturado parcial e recebe as próximas notas. Se o saldo não vier, você finaliza o pedido manualmente e ele sai da lista de pendentes.",
  },
  {
    q: "Meus vendedores veem a comissão do escritório?",
    a: "Não. Cada pessoa tem um papel (dono, gerente, vendedor ou financeiro) e só vê o que esse papel permite.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Pode. Sem multa e sem fidelidade no plano mensal. Seus dados continuam disponíveis para exportar.",
  },
];

/* ---------------------------------------------------------------- página */

export default function SitePage() {
  return (
    <div className="lp overflow-x-clip bg-white text-ink">
      <SiteHeader />

      {/* ============================== Topo */}
      <section className="relative isolate overflow-hidden bg-[#06212a] pb-10 pt-32 sm:pt-40">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="absolute left-1/2 top-[-18rem] h-[42rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(31,140,160,0.55),transparent)] blur-2xl" />
          <div className="absolute right-[-10rem] top-[18rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(47,160,122,0.35),transparent)] blur-2xl" />
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-white" />
        </div>

        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <a
            href="#faturamento"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] py-1 pl-1 pr-3 text-[12.5px] text-white/80 backdrop-blur transition hover:border-white/25 hover:text-white"
          >
            <span className="rounded-full bg-[#9fe3c4] px-2 py-0.5 text-[11px] font-semibold text-[#06212a]">Novo</span>
            Faturamento pelo XML da NF-e
            <Icon name="arrow-right" size={13} className="transition group-hover:translate-x-0.5" />
          </a>
          <h1 className="mx-auto mt-7 max-w-4xl text-balance text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white sm:text-[4rem] lg:text-[4.6rem]">
            Do pedido à comissão,{" "}
            <span className="bg-gradient-to-r from-[#9fe3c4] via-[#7fd3e0] to-[#9fe3c4] bg-clip-text text-transparent">sem planilha.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-[17px] leading-relaxed text-white/65 sm:text-[19px]">
            O sistema do representante comercial. Pedidos, faturamento, comissões, metas e a carteira de clientes no mapa — no computador e no celular.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login?modo=criar"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-[#06212a] shadow-[0_10px_30px_-10px_rgba(159,227,196,0.6)] transition hover:bg-white/90 sm:w-auto"
            >
              Testar {TRIAL_DAYS} dias grátis
              <Icon name="arrow-right" size={16} />
            </Link>
            <a
              href="#telas"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 text-[15px] font-medium text-white transition hover:bg-white/10 sm:w-auto"
            >
              Ver as telas
            </a>
          </div>
          <p className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12.5px] text-white/45">
            <span className="flex items-center gap-1.5">
              <Icon name="check" size={13} /> Sem cartão de crédito
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="check" size={13} /> Pronto em 5 minutos
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="check" size={13} /> Cancele quando quiser
            </span>
          </p>
        </div>

        <div className="relative mx-auto mt-16 max-w-6xl px-4 sm:mt-20 sm:px-6">
          <div aria-hidden="true" className="absolute inset-x-10 -top-6 h-40 rounded-full bg-[#1f8ca0] opacity-40 blur-3xl" />
          <div className="relative animate-[lp-screen-in_1s_cubic-bezier(0.22,1,0.36,1)_both] rounded-2xl bg-white/[0.06] p-1.5 ring-1 ring-white/15 sm:p-2.5">
            <ScaleFrame width={1180}>
              <Window title="Painel">
                <PainelScreen />
              </Window>
            </ScaleFrame>
          </div>
          <FloatCard
            icon="file"
            tone="bg-pen-soft text-pen"
            title="NF 45871 lida pelo XML"
            text="Vinculada ao pedido #1045 · 3 itens conferidos"
            className="absolute -left-6 top-[38%] hidden animate-[lp-float_7s_ease-in-out_infinite] xl:flex"
          />
          <FloatCard
            icon="check"
            tone="bg-ok-soft text-ok"
            title="Comissão recebida"
            text="R$ 1.380,40 da Tecelagem Aurora"
            className="absolute -right-8 top-[16%] hidden animate-[lp-float_8s_ease-in-out_1.5s_infinite] xl:flex"
          />
          <FloatCard
            icon="alert"
            tone="bg-alert-soft text-alert"
            title="Pedido #1038 em atraso"
            text="19 dias sem faturar · Boutique Lumi"
            className="absolute -right-4 bottom-[10%] hidden animate-[lp-float_9s_ease-in-out_3s_infinite] xl:flex"
          />
        </div>
      </section>

      {/* ============================== Antes e depois */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Feito para quem vive de representação</Eyebrow>
          <H2 className="mt-3">Menos tempo no escritório. Mais tempo vendendo.</H2>
          <Lead className="mt-4">
            Representante não tem tempo a perder com retrabalho. O Representar cuida da parte chata para você cuidar dos clientes.
          </Lead>
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {pains.map((p, i) => (
            <Reveal key={p.before} delay={i * 90}>
              <div className="group h-full rounded-2xl border border-line bg-white p-6 transition hover:border-line-strong hover:shadow-[0_20px_40px_-24px_rgba(10,43,52,0.25)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pen-soft text-pen">
                  <Icon name={p.icon} size={20} />
                </span>
                <p className="mt-5 text-[13.5px] text-faint line-through decoration-faint/60">{p.before}</p>
                <p className="mt-2 text-[16px] font-medium leading-snug text-ink">{p.after}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================== Tour pelas telas */}
      <section id="telas" className="scroll-mt-20 border-y border-line bg-canvas/70 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
            <Eyebrow>Conheça por dentro</Eyebrow>
            <H2 className="mt-3">Tudo o que o escritório precisa. Nada que atrapalhe.</H2>
            <Lead className="mt-4">Telas limpas, rápidas e pensadas para o dia a dia do representante. Passe pelas abas.</Lead>
          </Reveal>
          <Showcase tabs={tabs} />
        </div>
      </section>

      {/* ============================== Faturamento pelo XML */}
      <section id="faturamento" className="relative isolate scroll-mt-20 overflow-hidden bg-[#06212a] py-20 sm:py-28">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute left-[-12rem] top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(31,140,160,0.45),transparent)] blur-2xl" />
          <div className="absolute bottom-[-14rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(47,160,122,0.3),transparent)] blur-2xl" />
          <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="max-w-2xl">
            <Eyebrow dark>Faturamento pelo XML</Eyebrow>
            <H2 dark className="mt-3">
              A fábrica faturou? <br className="hidden sm:block" />
              Arraste a nota e siga em frente.
            </H2>
            <Lead dark className="mt-4">
              Chega de redigitar nota fiscal. O Representar lê o XML da NF-e, acha o pedido e confere cada item — inclusive quando a fábrica manda só uma parte.
            </Lead>
          </Reveal>

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {/* 1 */}
            <Reveal>
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <p className="flex items-center gap-2.5 text-[13px] font-medium text-white/60">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-white">1</span>
                  Solte o arquivo
                </p>
                <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-8 text-center">
                  <div className="relative">
                    <div className="absolute -inset-4 animate-[lp-pulse_2.4s_ease-out_infinite] rounded-2xl border border-[#9fe3c4]/40" />
                    <span className="relative flex h-14 w-12 flex-col items-center justify-end rounded-md bg-white pb-1.5 shadow-lg">
                      <span className="absolute right-0 top-0 h-3 w-3 rounded-bl bg-[#cfe0e6]" />
                      <span className="rounded bg-pen px-1 text-[8px] font-bold text-white">XML</span>
                    </span>
                  </div>
                  <p className="mt-5 font-mono text-[11px] text-white/50">3526…4587 1.xml</p>
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-white/70">Do e-mail da fábrica direto para o sistema. Também dá para lançar à mão.</p>
              </div>
            </Reveal>
            {/* 2 */}
            <Reveal delay={100}>
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <p className="flex items-center gap-2.5 text-[13px] font-medium text-white/60">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-white">2</span>
                  O sistema confere
                </p>
                <div className="mt-5 flex-1 rounded-xl bg-white p-4 text-ink">
                  <p className="flex items-baseline justify-between text-[13px] font-semibold">
                    NF 45871 <span className="tabular-nums">R$ 22.910,00</span>
                  </p>
                  <div className="mt-3 grid gap-2 text-[12px]">
                    {[
                      ["Emitente é a representada do pedido", true],
                      ["Destinatário é o cliente do pedido", true],
                      ["3 de 3 itens encontrados", true],
                      ["Nota ainda não lançada", true],
                    ].map(([t]) => (
                      <p key={t as string} className="flex items-center gap-2">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ok-soft text-ok">
                          <Icon name="check" size={10} strokeWidth={2.4} />
                        </span>
                        {t}
                      </p>
                    ))}
                  </div>
                  <div className="mt-3.5 flex items-center gap-2 rounded-lg bg-pen-soft px-2.5 py-2 text-[12px]">
                    <Icon name="receipt" size={14} className="text-pen" />
                    <span className="flex-1 font-medium text-pen">Pedido #1045 sugerido</span>
                  </div>
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-white/70">CNPJ, itens e duplicidade checados antes de gravar. Se algo não bater, você é avisado.</p>
              </div>
            </Reveal>
            {/* 3 */}
            <Reveal delay={200}>
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <p className="flex items-center gap-2.5 text-[13px] font-medium text-white/60">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-white">3</span>
                  Tudo atualizado
                </p>
                <div className="mt-5 flex-1 rounded-xl bg-white p-4 text-ink">
                  <p className="text-[12px] text-muted">Pedido #1045 · Confecções Serra Azul</p>
                  <div className="mt-3 flex items-center gap-1">
                    {["Enviado", "Faturado parcial", "Faturado"].map((s, i) => (
                      <div key={s} className="flex flex-1 flex-col gap-1.5">
                        <span className={`h-1.5 rounded-full ${i < 2 ? "bg-pen" : "bg-active"}`} />
                        <span className={`text-[10.5px] ${i === 1 ? "font-semibold text-pen" : "text-muted"}`}>{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-1.5 text-[12px]">
                    <p className="flex justify-between">
                      <span className="text-muted">Faturado</span>
                      <span className="font-medium tabular-nums">220 de 240 peças</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted">Comissão gerada</span>
                      <span className="font-medium tabular-nums text-ok">R$ 1.145,50</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted">Vencimento</span>
                      <span className="tabular-nums">10/11/2026</span>
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-white/70">Status, saldo e comissão atualizados na hora. O restante fica esperando a próxima nota.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================== Celular */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal className="order-2 lg:order-1">
            <div className="relative mx-auto w-fit">
              <div aria-hidden="true" className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgba(15,76,92,0.18),transparent)]" />
              <Phone className="relative rotate-[-3deg]">
                <PhoneOrder />
              </Phone>
              <div className="absolute -right-4 bottom-24 hidden rotate-[4deg] rounded-xl sm:-right-28 bg-white p-3 shadow-[0_0_0_1px_rgba(20,33,42,0.06),0_20px_40px_-12px_rgba(10,43,52,0.3)] sm:block">
                <p className="flex items-center gap-2 text-[12px] font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#e7f6ec] text-[#1f9d55]">
                    <Icon name="whatsapp" size={14} />
                  </span>
                  Pedido enviado
                </p>
                <p className="mt-1 text-[11px] text-muted">PDF com a sua logo, direto no WhatsApp</p>
              </div>
            </div>
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <Eyebrow>No bolso, na visita</Eyebrow>
            <H2 className="mt-3">O escritório inteiro cabe no seu celular.</H2>
            <Lead className="mt-4">
              Tire o pedido na frente do cliente, mande o PDF pelo WhatsApp e siga para a próxima visita. Sem notebook, sem papel.
            </Lead>
            <ul className="mt-8 grid gap-5">
              {[
                { i: "bolt" as IconName, t: "Abre como aplicativo", d: "Adicione à tela de início e use em tela cheia, sem baixar nada da loja." },
                { i: "factory" as IconName, t: "Sugere a representada", d: "Escolheu o cliente? O sistema já traz a fábrica da última compra." },
                { i: "phone" as IconName, t: "Contato a um toque", d: "Ligue ou chame no WhatsApp direto da ficha do cliente." },
              ].map((f) => (
                <li key={f.t} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-pen shadow-soft">
                    <Icon name={f.i} size={18} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">{f.t}</span>
                    <span className="mt-0.5 block text-[14px] leading-relaxed text-muted">{f.d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ============================== Recursos (bento) */}
      <section id="recursos" className="scroll-mt-20 border-t border-line bg-canvas/70 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>Recursos</Eyebrow>
            <H2 className="mt-3">Os detalhes que fazem diferença no fim do mês.</H2>
          </Reveal>

          <div className="mt-14 grid gap-4 md:grid-cols-6">
            {/* Avisos de atraso */}
            <Reveal className="md:col-span-4">
              <div className="h-full overflow-hidden rounded-2xl border border-line bg-white p-6 sm:p-7">
                <div className="flex flex-col gap-6 sm:flex-row">
                  <div className="sm:w-[44%]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warn-soft text-warn">
                      <Icon name="clock" size={20} />
                    </span>
                    <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">Avisos de atraso no seu prazo</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-muted">
                      Você define em quantos dias o pedido fica amarelo e em quantos fica vermelho. O Painel e a lista de pedidos avisam sozinhos.
                    </p>
                  </div>
                  <div className="flex-1 rounded-xl border border-line bg-subtle p-4">
                    <div className="grid gap-3">
                      {[
                        { d: "Hoje", t: "ok" as const, l: "No prazo", w: "18%" },
                        { d: "7 dias", t: "warn" as const, l: "Atenção", w: "55%" },
                        { d: "15 dias", t: "alert" as const, l: "Crítico", w: "92%" },
                      ].map((r) => (
                        <div key={r.d}>
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="font-medium">{r.d}</span>
                            <Chip tone={r.t} dot>
                              {r.l}
                            </Chip>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-active">
                            <div
                              className={`h-full rounded-full ${r.t === "ok" ? "bg-ok" : r.t === "warn" ? "bg-[#d99a2b]" : "bg-alert"}`}
                              style={{ width: r.w }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[11.5px]">
                      <span className="rounded-md border border-line bg-white px-2.5 py-1.5">
                        <span className="block text-muted">Aviso após</span>
                        <span className="font-semibold">7 dias</span>
                      </span>
                      <span className="rounded-md border border-line bg-white px-2.5 py-1.5">
                        <span className="block text-muted">Crítico após</span>
                        <span className="font-semibold">15 dias</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Equipe */}
            <Reveal className="md:col-span-2" delay={80}>
              <div className="h-full rounded-2xl border border-line bg-white p-6 sm:p-7">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info-soft text-info">
                  <Icon name="users" size={20} />
                </span>
                <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">Cada um no seu papel</h3>
                <div className="mt-4 grid gap-2">
                  {[
                    ["Marina Costa", "Dona", "#c98a5a"],
                    ["Rafael Lima", "Gerente", "#5a86c9"],
                    ["Júlia Prado", "Vendedora", "#7a5ac9"],
                    ["Carla Nunes", "Financeiro", "#3f9a7a"],
                  ].map(([n, r, c]) => (
                    <div key={n} className="flex items-center gap-2.5 text-[13px]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full text-[10.5px] font-semibold text-white" style={{ background: c }}>
                        {n
                          .split(" ")
                          .map((w) => w[0])
                          .join("")}
                      </span>
                      <span className="flex-1 font-medium">{n}</span>
                      <span className="text-[12px] text-muted">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Sua marca */}
            <Reveal className="md:col-span-2">
              <div className="h-full rounded-2xl border border-line bg-white p-6 sm:p-7">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pen-soft text-pen">
                  <Icon name="sparkle" size={20} />
                </span>
                <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">Com a cara do seu escritório</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">Sua logo, sua cor e a numeração de pedidos do seu jeito.</p>
                <div className="mt-5 flex gap-2">
                  {["#0f4c5c", "#7b2cbf", "#c2410c", "#1d4ed8", "#15803d"].map((c, i) => (
                    <span
                      key={c}
                      className={`h-8 w-8 rounded-full ${i === 0 ? "ring-2 ring-offset-2 ring-[#0f4c5c]" : ""}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <p className="mt-4 font-mono text-[12px] text-muted">
                  Próximo pedido: <span className="font-semibold text-ink">AUR-2026-1048</span>
                </p>
              </div>
            </Reveal>

            {/* Comissão */}
            <Reveal className="md:col-span-4" delay={80}>
              <div className="relative h-full overflow-hidden rounded-2xl bg-[#0a2b34] p-6 text-white sm:p-7">
                <div aria-hidden="true" className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#2fa07a] opacity-25 blur-3xl" />
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                  <div className="sm:w-[46%]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#9fe3c4]">
                      <Icon name="percent" size={20} />
                    </span>
                    <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">Comissão por nota fiscal</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-white/65">
                      Cada nota gera a sua comissão com vencimento. Recebeu menos? Lance o valor real e o sistema guarda a diferença.
                    </p>
                  </div>
                  <div className="flex-1 rounded-xl bg-white p-4 text-ink">
                    {[
                      ["NF 45871", "R$ 1.145,50", "A receber", "info"],
                      ["NF 8812", "R$ 921,00", "Atrasada", "alert"],
                      ["NF 8790", "R$ 1.380,40", "Recebida", "ok"],
                    ].map(([n, v, s, t]) => (
                      <div key={n} className="flex items-center gap-3 border-b border-line py-2 text-[12.5px] last:border-0">
                        <span className="font-mono text-[11px] text-muted">{n}</span>
                        <span className="flex-1 font-medium tabular-nums">{v}</span>
                        <Chip tone={t as "info" | "alert" | "ok"} dot>
                          {s}
                        </Chip>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="mt-14 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 60}>
                <div>
                  <Icon name={f.icon} size={20} className="text-pen" />
                  <h3 className="mt-3 text-[15px] font-semibold">{f.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== Preços */}
      <section id="precos" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mx-auto mb-10 max-w-2xl text-center">
            <Eyebrow>Preços</Eyebrow>
            <H2 className="mt-3">Um plano para cada tamanho de escritório.</H2>
            <Lead className="mt-4">
              Comece com {TRIAL_DAYS} dias grátis em qualquer plano. Sem cartão, sem taxa de instalação.
            </Lead>
          </Reveal>
          <Pricing />
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13.5px] text-muted">
            {INCLUDED.map((t) => (
              <span key={t} className="flex items-center gap-2">
                <Icon name="check" size={15} className="text-ok" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== Dúvidas */}
      <section id="duvidas" className="scroll-mt-20 border-t border-line bg-canvas/70 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <Reveal>
            <Eyebrow>Dúvidas</Eyebrow>
            <H2 className="mt-3">Perguntas frequentes</H2>
            <Lead className="mt-4">
              Não achou o que procurava?{" "}
              <Link href="/login?modo=criar" className="font-medium text-pen hover:underline">
                Crie sua conta
              </Link>{" "}
              e fale com a gente por dentro do sistema.
            </Lead>
          </Reveal>
          <div className="divide-y divide-line rounded-2xl border border-line bg-white">
            {faq.map((f) => (
              <details key={f.q} className="group px-5 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-medium">
                  {f.q}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-muted transition group-open:rotate-45 group-open:border-pen group-open:text-pen">
                    <Icon name="plus" size={14} />
                  </span>
                </summary>
                <p className="-mt-1 pb-5 pr-10 text-[14.5px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== Chamada final */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#06212a] px-6 py-16 text-center sm:px-12 sm:py-20">
            <div aria-hidden="true" className="absolute inset-0 -z-10">
              <div className="absolute left-1/2 top-[-12rem] h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(31,140,160,0.55),transparent)] blur-2xl" />
              <div className="absolute inset-0 opacity-[0.2] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
            </div>
            <span className="inline-flex rounded-[20px] bg-white/10 p-2 shadow-[0_0_40px_rgba(127,211,224,0.25)] ring-1 ring-white/15">
              <Logo size={48} />
            </span>
            <h2 className="mx-auto mt-7 max-w-2xl text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[2.8rem]">
              Seu próximo pedido já pode sair daqui.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-white/65">
              Crie a conta, cadastre o primeiro cliente pelo CNPJ e tire o primeiro pedido em poucos minutos.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login?modo=criar"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-[#06212a] transition hover:bg-white/90 sm:w-auto"
              >
                Começar teste grátis
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/15 px-6 text-[15px] font-medium text-white transition hover:bg-white/10 sm:w-auto"
              >
                Já tenho conta
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============================== Rodapé */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="text-[14px] font-semibold">Representar</span>
            <span className="text-[13px] text-faint">· o sistema do representante comercial</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted">
            <a href="#telas" className="hover:text-ink">
              Telas
            </a>
            <a href="#recursos" className="hover:text-ink">
              Recursos
            </a>
            <a href="#precos" className="hover:text-ink">
              Preços
            </a>
            <a href="#duvidas" className="hover:text-ink">
              Dúvidas
            </a>
            <Link href="/login" className="hover:text-ink">
              Entrar
            </Link>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-10 text-[12px] text-faint sm:px-6">
          © {new Date().getFullYear()} Representar. Telas com dados fictícios, só para ilustração.
        </p>
      </footer>
    </div>
  );
}
