import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { Pricing, Reveal, ScaleFrame, Showcase, SiteHeader, themeBootScript, type ShowcaseTab } from "./client";
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
  title: { absolute: "Representar — mais pedidos, menos planilha" },
  description:
    "Pedidos, faturamento pelo XML da NF-e, comissões por nota, metas e carteira de clientes no mapa. O sistema do representante comercial.",
  openGraph: {
    title: "Representar — mais pedidos, menos planilha",
    description: "O sistema do representante comercial: pedidos, faturamento, comissões, metas e clientes no mapa.",
    locale: "pt_BR",
    type: "website",
  },
};

/* ---------------------------------------------------------------- peças da marca */

const wrap = "mx-auto w-full max-w-7xl px-4 sm:px-8 lg:px-16";

// Etiqueta em mono, maiúscula e numerada: "01 — Comissões".
function Eyebrow({ n, children, className = "" }: { n?: string; children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[12px] uppercase tracking-[0.08em] text-muted ${className}`}>
      {n ? `${n} — ` : ""}
      {children}
    </p>
  );
}

// Fio tracejado 6/6 da marca.
function Rule({ className = "" }: { className?: string }) {
  return <div className={`h-px bg-[repeating-linear-gradient(90deg,currentColor_0_6px,transparent_6px_12px)] opacity-35 ${className}`} />;
}

function H2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-balance text-[2.4rem] font-bold leading-[0.98] tracking-[-0.045em] sm:text-[3.5rem] ${className}`}>{children}</h2>;
}

// Divisa dupla: o ícone-assinatura da marca, usado nos botões de avançar.
function Avancar({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter" strokeLinecap="butt" aria-hidden="true">
      <path d="M4 6L10 12L4 18" />
      <path d="M12 6L18 12L12 18" />
    </svg>
  );
}

// Curva de alta: pontos claros (meses fechados) até o ponto laranja (meta).
function Curve({ className = "", w = 1200, h = 240 }: { className?: string; w?: number; h?: number }) {
  const pts = [
    [20, 210],
    [150, 150],
    [230, 175],
    [380, 40],
  ].map(([x, y]) => [(x / 400) * w, (y / 240) * h]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true" style={{ overflow: "visible" }}>
      <path d={pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 7" opacity="0.5" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 3 ? 13 : 7} fill={i === 3 ? "#FF5B22" : "currentColor"} />
      ))}
    </svg>
  );
}

const accentCta =
  "inline-flex h-[3.25rem] items-center justify-center gap-2.5 rounded-xl bg-accent px-6 text-[16px] font-semibold text-on-accent transition hover:bg-accent-dark active:scale-[0.98]";
const ghostCta =
  "inline-flex h-[3.25rem] items-center justify-center rounded-xl border border-ink/80 px-6 text-[16px] font-semibold text-ink transition hover:bg-hover active:scale-[0.98]";

/* ---------------------------------------------------------------- conteúdo */

const blocks: { n: string; label: string; icon: IconName; title: string; text: string }[] = [
  { n: "02", label: "Pedidos", icon: "receipt", title: "Tire o pedido na frente do cliente.", text: "Itens, prazo e desconto calculados na hora. PDF com a sua marca direto no WhatsApp." },
  { n: "03", label: "Faturamento", icon: "file", title: "Solte o XML. O resto é com a gente.", text: "A nota encontra o pedido sozinha, confere cada item e atualiza o saldo." },
  { n: "04", label: "Comissões", icon: "percent", title: "Cada centavo de comissão, conferido.", text: "Comissão por nota fiscal, com vencimento. O que atrasou aparece primeiro." },
];

const shot = (screen: ReactNode, title: string) => (
  <ScaleFrame width={1120}>
    <Window title={title}>{screen}</Window>
  </ScaleFrame>
);

const tabs: ShowcaseTab[] = [
  {
    id: "painel",
    label: "Painel",
    icon: "home",
    title: "O mês inteiro numa olhada.",
    text: "Vendido, faturado, comissão prevista e a comparação com o mês anterior. Filtre por período, vendedor ou representada e veja na hora o que mudou.",
    points: ["Ranking de clientes, representadas e produtos", "Pedidos em atraso no topo, os críticos primeiro", "Quanto falta por dia para bater a meta"],
    screen: shot(<PainelScreen />, "Painel"),
  },
  {
    id: "pedidos",
    label: "Pedidos",
    icon: "receipt",
    title: "Pedido feito em menos de dois minutos.",
    text: "Escolha o cliente e a representada, digite os itens ou puxe do catálogo. Total, desconto e prazo calculados na hora, com a numeração do seu escritório.",
    points: ["Itens digitados à mão ou do catálogo", "PDF com a sua logo e envio pelo WhatsApp", "Filtro de atrasados e do que aguarda faturamento"],
    screen: shot(<PedidosScreen />, "Pedidos"),
  },
  {
    id: "faturamento",
    label: "Faturamento",
    icon: "file",
    title: "Solte o XML da nota. Pronto.",
    text: "O sistema lê a NF-e, encontra o pedido pelo CNPJ do cliente e da fábrica, confere item por item e lança as quantidades. Você só confirma.",
    points: ["Número, série, data, valor e chave preenchidos", "Faturamento parcial quando a fábrica manda só uma parte", "A mesma nota nunca é lançada duas vezes"],
    screen: shot(<FaturamentoScreen />, "Faturamento"),
  },
  {
    id: "comissoes",
    label: "Comissões",
    icon: "percent",
    title: "Cada centavo, conferido.",
    text: "A comissão nasce da nota fiscal, com o percentual do pedido e o vencimento combinado com a representada. Recebeu? Confira o valor e dê baixa.",
    points: ["Valor sugerido = nota × percentual do pedido", "Recebimento parcial quando a fábrica paga a menos", "Totais por representada e atrasadas em destaque"],
    screen: shot(<ComissoesScreen />, "Comissões"),
  },
  {
    id: "mapa",
    label: "Carteira no mapa",
    icon: "pin",
    title: "Sua carteira desenhada no mapa.",
    text: "Cada cliente vira um pino pelo endereço. Monte a rota da semana, veja quem está há tempo sem comprar e aproveite a viagem para prospectar.",
    points: ["Endereço pelo CEP e dados pelo CNPJ", "Arraste o pino para corrigir a posição", "Prospecção no mesmo mapa, pronta para virar cliente"],
    screen: shot(<MapaScreen />, "Clientes"),
  },
  {
    id: "metas",
    label: "Metas",
    icon: "target",
    title: "Metas que fecham a conta.",
    text: "A meta do escritório é a soma das metas de cada vendedor ou representada, sem número solto. Cada um acompanha o próprio ritmo.",
    points: ["Por vendedor, por representada ou geral", "Ritmo diário pelos dias úteis que faltam", "Histórico mês a mês"],
    screen: shot(<MetasScreen />, "Metas"),
  },
];

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: "search", title: "CNPJ que se preenche", text: "Digite o CNPJ: nome, endereço e telefone aparecem sozinhos." },
  { icon: "pin", title: "Endereço pelo CEP", text: "Rua, bairro e cidade em um clique, com o pino no mapa." },
  { icon: "kanban", title: "Prospecção com retorno", text: "Funil com a data do próximo contato. Fechou? Vira cliente." },
  { icon: "wallet", title: "Contas a pagar", text: "As despesas do escritório ao lado do que entra de comissão." },
  { icon: "users", title: "Equipe com papéis", text: "Dono, gerente, vendedor e financeiro, cada um no seu." },
  { icon: "sparkle", title: "Com a sua cara", text: "Sua logo e a cor da sua empresa em todo o sistema e nos pedidos." },
  { icon: "box", title: "Catálogo opcional", text: "Produtos com foto e código, ou itens digitados na hora." },
  { icon: "shield", title: "Dados protegidos", text: "Cada escritório só enxerga os próprios dados." },
];

const faq: { q: string; a: string }[] = [
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. O Representar funciona no navegador do computador e do celular. No celular, adicione à tela de início e ele abre como aplicativo, em tela cheia.",
  },
  {
    q: "Como funciona o teste grátis?",
    a: `Você usa o plano escolhido completo por ${TRIAL_DAYS} dias, sem cadastrar cartão. No fim do período, decide se quer continuar.`,
  },
  {
    q: "Consigo trazer meus clientes e produtos da planilha?",
    a: "Sim. Cadastre aos poucos (o CNPJ e o CEP preenchem quase tudo) ou nos mande a planilha que ajudamos a importar.",
  },
  {
    q: "E se a fábrica faturar só uma parte do pedido?",
    a: "O pedido fica como Faturado parcial e recebe as próximas notas. Se o saldo não vier, você finaliza o pedido e ele sai dos pendentes.",
  },
  {
    q: "O que cada vendedor enxerga?",
    a: "Só o que é dele: os próprios clientes, pedidos e a própria meta. Valores de comissão ficam só com o administrador e o financeiro.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Pode. Sem multa e sem fidelidade no plano mensal. Seus dados continuam disponíveis para exportar.",
  },
];

/* ---------------------------------------------------------------- página */

export default function SitePage() {
  return (
    <div className="lp min-h-dvh overflow-x-clip bg-paper text-ink">
      <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      <SiteHeader />

      {/* ============================== 01 · Topo */}
      <section className={`${wrap} pt-32 sm:pt-40`}>
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-16">
          <div className="animate-[lp-fade-up_700ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
            <Eyebrow n="01">Gestão de vendas para representantes</Eyebrow>
            <h1 className="mt-6 text-[3.6rem] font-bold leading-[0.92] tracking-[-0.055em] sm:text-[5.5rem] lg:text-[5.6rem] xl:text-[6.4rem]">
              Mais pedidos, menos planilha.
            </h1>
          </div>
          <div className="animate-[lp-fade-up_700ms_120ms_cubic-bezier(0.2,0.8,0.2,1)_both] lg:pb-4">
            <p className="max-w-md text-pretty text-[18px] leading-relaxed text-ink-2 sm:text-[20px]">
              Pedidos, faturamento, comissões e metas num lugar só. Feito para quem vive de representação — no escritório e na estrada.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?modo=criar" className={accentCta}>
                Começar agora <Avancar />
              </Link>
              <a href="#telas" className={ghostCta}>
                Ver o produto
              </a>
            </div>
            <p className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[12.5px] text-muted">
              {[`${TRIAL_DAYS} dias grátis`, "Sem cartão", "Cancele quando quiser"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Icon name="check" size={13} strokeWidth={2} />
                  {t}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>

      {/* Tela do produto sobre a curva de alta */}
      <section className="relative mt-16 sm:mt-24">
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 top-[22%] bg-canvas" />
        <div className={`${wrap} relative`}>
          <Curve className="absolute -top-4 left-2 right-2 hidden h-[17rem] w-[calc(100%-1rem)] text-muted lg:block" />
          <div className="relative mx-auto max-w-[1120px] animate-[lp-screen-in_900ms_200ms_cubic-bezier(0.2,0.8,0.2,1)_both] lg:pt-10">
            {shot(<PainelScreen />, "Painel")}
          </div>
        </div>
      </section>

      {/* ============================== 02–04 · Blocos */}
      <section className="bg-canvas pb-20 pt-10 sm:pb-28 sm:pt-16">
        <div className={`${wrap} grid gap-4 md:grid-cols-3`}>
          {blocks.map((b, i) => (
            <Reveal key={b.n} delay={i * 80}>
              <div className="h-full rounded-md border border-line bg-white p-7 sm:p-8">
                <Icon name={b.icon} size={30} strokeWidth={1.8} />
                <Eyebrow n={b.n} className="mt-6">
                  {b.label}
                </Eyebrow>
                <Rule className="my-5 text-muted" />
                <h3 className="text-[1.6rem] font-bold leading-[1.05] tracking-[-0.035em]">{b.title}</h3>
                <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">{b.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================== 05 · Tour pelas telas */}
      <section id="telas" className="scroll-mt-20 py-20 sm:py-28">
        <div className={wrap}>
          <Reveal className="mb-10 grid gap-6 sm:mb-14 lg:grid-cols-[1.35fr_1fr] lg:items-end lg:gap-16">
            <div>
              <Eyebrow n="05">Conheça por dentro</Eyebrow>
              <H2 className="mt-5">Tudo o que o escritório precisa. Nada que atrapalhe.</H2>
            </div>
            <p className="text-[17px] leading-relaxed text-ink-2">Telas limpas e rápidas, pensadas para o dia a dia do representante. Passe pelas abas.</p>
          </Reveal>
          <Showcase tabs={tabs} />
        </div>
      </section>

      {/* ============================== 06 · Faturamento pelo XML */}
      <section id="faturamento" className="relative isolate scroll-mt-20 overflow-hidden bg-side py-20 text-[#f3f0e8] sm:py-28">
        <Curve className="absolute -right-10 top-10 -z-10 hidden h-64 w-[44rem] text-[#f3f0e8]/40 lg:block" w={700} h={260} />
        <div className={wrap}>
          <Reveal className="max-w-3xl">
            <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#a8a49b]">06 — Faturamento pelo XML</p>
            <H2 className="mt-5">A fábrica faturou? Arraste a nota e siga em frente.</H2>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[#c9c5bb]">
              Chega de redigitar nota fiscal. O Representar lê o XML da NF-e, acha o pedido e confere cada item — inclusive quando a fábrica manda só uma parte.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {[
              {
                n: "1",
                t: "Solte o arquivo",
                d: "Do e-mail da fábrica direto para o sistema. Também dá para lançar à mão.",
                body: (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-[#f3f0e8]/25 px-4 py-9 text-center">
                    <div className="relative">
                      <div className="absolute -inset-4 animate-[lp-pulse_2.4s_ease-out_infinite] rounded-xl border border-accent/60" />
                      <span className="relative flex h-14 w-12 flex-col items-center justify-end rounded-sm bg-[#f3f0e8] pb-1.5">
                        <span className="absolute right-0 top-0 h-3 w-3 bg-[#c9c5bb]" />
                        <span className="rounded-sm bg-accent px-1 font-mono text-[8px] font-bold text-on-accent">XML</span>
                      </span>
                    </div>
                    <p className="mt-5 font-mono text-[11px] text-[#a8a49b]">3526…45871.xml</p>
                  </div>
                ),
              },
              {
                n: "2",
                t: "O sistema confere",
                d: "CNPJ, itens e duplicidade checados antes de gravar. Se algo não bater, você é avisado.",
                body: (
                  <div className="flex-1 rounded-md bg-white p-4 text-ink">
                    <p className="flex items-baseline justify-between text-[13px] font-semibold">
                      NF 45871 <span className="font-mono font-medium">R$ 22.910,00</span>
                    </p>
                    <div className="mt-3 grid gap-2 text-[12.5px]">
                      {["Emitente é a representada do pedido", "Destinatário é o cliente do pedido", "3 de 3 itens encontrados", "Nota ainda não lançada"].map((t) => (
                        <p key={t} className="flex items-center gap-2">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ok-soft text-ok">
                            <Icon name="check" size={10} strokeWidth={2.6} />
                          </span>
                          {t}
                        </p>
                      ))}
                    </div>
                    <p className="mt-3.5 flex items-center gap-2 rounded-md bg-accent-soft px-2.5 py-2 text-[12.5px] font-medium text-accent-ink">
                      <Icon name="receipt" size={14} />
                      Pedido #1045 sugerido
                    </p>
                  </div>
                ),
              },
              {
                n: "3",
                t: "Tudo atualizado",
                d: "Status, saldo e comissão atualizados na hora. O restante espera a próxima nota.",
                body: (
                  <div className="flex-1 rounded-md bg-white p-4 text-ink">
                    <p className="text-[12px] text-muted">Pedido #1045 · Confecções Serra Azul</p>
                    <div className="mt-3 flex gap-1">
                      {["Enviado", "Parcial", "Faturado"].map((s, i) => (
                        <div key={s} className="flex flex-1 flex-col gap-1.5">
                          <span className={`h-1.5 rounded-sm ${i < 2 ? "bg-accent" : "bg-active"}`} />
                          <span className={`text-[10.5px] ${i === 1 ? "font-semibold text-ink" : "text-muted"}`}>{s}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-1.5 text-[12.5px]">
                      <p className="flex justify-between">
                        <span className="text-muted">Faturado</span>
                        <span className="font-mono">220 de 240 peças</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-muted">Comissão gerada</span>
                        <span className="font-mono text-ok">R$ 1.145,50</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-muted">Vencimento</span>
                        <span className="font-mono">10/11/2026</span>
                      </p>
                    </div>
                  </div>
                ),
              },
            ].map((c, i) => (
              <Reveal key={c.n} delay={i * 100}>
                <div className="flex h-full flex-col rounded-md border border-[#f3f0e8]/10 bg-[#f3f0e8]/[0.04] p-5">
                  <p className="flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.08em] text-[#a8a49b]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-on-accent">{c.n}</span>
                    {c.t}
                  </p>
                  <div className="mt-5 flex flex-1 flex-col">{c.body}</div>
                  <p className="mt-4 text-[14.5px] leading-relaxed text-[#c9c5bb]">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== 07 · Celular */}
      <section className={`${wrap} py-20 sm:py-28`}>
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal className="order-2 lg:order-1">
            <div className="relative mx-auto w-fit">
              <Phone className="relative">
                <PhoneOrder />
              </Phone>
              <div className="absolute -right-4 bottom-24 hidden rounded-md border border-line bg-white p-3 shadow-[0_20px_40px_-16px_rgba(21,23,28,0.35)] sm:-right-32 sm:block">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted">WhatsApp · agora</p>
                <p className="mt-1 text-[13px] font-semibold">Pedido #1048 enviado</p>
                <p className="mt-0.5 text-[12px] text-muted">PDF com a sua logo</p>
              </div>
            </div>
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <Eyebrow n="07">No bolso, na visita</Eyebrow>
            <H2 className="mt-5">O escritório inteiro cabe no seu celular.</H2>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
              Tire o pedido na frente do cliente, mande o PDF pelo WhatsApp e siga para a próxima visita. Sem notebook, sem papel.
            </p>
            <ul className="mt-8 grid gap-5">
              {[
                { i: "bolt" as IconName, t: "Abre como aplicativo", d: "Adicione à tela de início e use em tela cheia, sem baixar nada da loja." },
                { i: "factory" as IconName, t: "Sugere a representada", d: "Escolheu o cliente? O sistema já traz a fábrica da última compra." },
                { i: "phone" as IconName, t: "Contato a um toque", d: "Ligue ou chame no WhatsApp direto da ficha do cliente." },
              ].map((f) => (
                <li key={f.t} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-white">
                    <Icon name={f.i} size={18} strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block text-[16px] font-semibold tracking-[-0.01em]">{f.t}</span>
                    <span className="mt-0.5 block text-[14.5px] leading-relaxed text-ink-2">{f.d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ============================== 08 · Recursos */}
      <section id="recursos" className="scroll-mt-20 bg-canvas py-20 sm:py-28">
        <div className={wrap}>
          <Reveal className="mb-12 max-w-3xl">
            <Eyebrow n="08">Recursos</Eyebrow>
            <H2 className="mt-5">Os detalhes que fazem diferença no fim do mês.</H2>
          </Reveal>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Avisos de atraso */}
            <Reveal className="md:col-span-2">
              <div className="flex h-full flex-col gap-6 rounded-md border border-line bg-white p-7 sm:flex-row sm:p-8">
                <div className="sm:w-[44%]">
                  <Icon name="clock" size={30} strokeWidth={1.8} />
                  <h3 className="mt-6 text-[1.6rem] font-bold leading-[1.05] tracking-[-0.035em]">Avisos de atraso no seu prazo.</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
                    Você define em quantos dias o pedido entra em atenção e em quantos fica crítico. O painel e a lista avisam sozinhos.
                  </p>
                </div>
                <div className="flex-1 rounded-md bg-subtle p-4">
                  <div className="grid gap-3">
                    {[
                      { d: "Hoje", t: "ok" as const, l: "No prazo", w: "18%", c: "bg-ok" },
                      { d: "7 dias", t: "warn" as const, l: "Atenção", w: "55%", c: "bg-warn-dot" },
                      { d: "15 dias", t: "alert" as const, l: "Crítico", w: "92%", c: "bg-alert" },
                    ].map((r) => (
                      <div key={r.d}>
                        <div className="flex items-center justify-between text-[12.5px]">
                          <span className="font-mono">{r.d}</span>
                          <Chip tone={r.t} dot>
                            {r.l}
                          </Chip>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-sm bg-active">
                          <div className={`h-full rounded-sm ${r.c}`} style={{ width: r.w }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[12px]">
                    <span className="rounded-md border border-line bg-white px-2.5 py-1.5">
                      <span className="block text-muted">Atenção após</span>
                      <span className="font-mono font-medium">7 dias</span>
                    </span>
                    <span className="rounded-md border border-line bg-white px-2.5 py-1.5">
                      <span className="block text-muted">Crítico após</span>
                      <span className="font-mono font-medium">15 dias</span>
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Equipe */}
            <Reveal delay={80}>
              <div className="h-full rounded-md border border-line bg-white p-7 sm:p-8">
                <Icon name="users" size={30} strokeWidth={1.8} />
                <h3 className="mt-6 text-[1.6rem] font-bold leading-[1.05] tracking-[-0.035em]">Cada um no seu papel.</h3>
                <div className="mt-5 grid gap-2.5">
                  {[
                    ["Marina Costa", "Dona"],
                    ["Rafael Lima", "Gerente"],
                    ["Júlia Prado", "Vendedora"],
                    ["Carla Nunes", "Financeiro"],
                  ].map(([n, r], i) => (
                    <div key={n} className="flex items-center gap-2.5 text-[13.5px]">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[10.5px] font-semibold ${
                          i === 0 ? "bg-accent text-on-accent" : "bg-active text-ink"
                        }`}
                      >
                        {n
                          .split(" ")
                          .map((w) => w[0])
                          .join("")}
                      </span>
                      <span className="flex-1 font-medium">{n}</span>
                      <span className="font-mono text-[11.5px] text-muted">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Sua marca */}
            <Reveal>
              <div className="h-full rounded-md border border-line bg-white p-7 sm:p-8">
                <Icon name="sparkle" size={30} strokeWidth={1.8} />
                <h3 className="mt-6 text-[1.6rem] font-bold leading-[1.05] tracking-[-0.035em]">Com a cara do seu escritório.</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Sua logo, sua cor e a numeração de pedidos do seu jeito.</p>
                <p className="mt-5 rounded-md bg-subtle px-3 py-2 font-mono text-[12.5px] text-muted">
                  Próximo pedido: <span className="font-medium text-ink">AUR-2026-1048</span>
                </p>
              </div>
            </Reveal>

            {/* Comissão por nota */}
            <Reveal className="md:col-span-2" delay={80}>
              <div className="relative flex h-full flex-col gap-6 overflow-hidden rounded-md bg-side p-7 text-[#f3f0e8] sm:flex-row sm:items-center sm:p-8">
                <div className="sm:w-[46%]">
                  <span className="text-accent">
                    <Icon name="percent" size={30} strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-6 text-[1.6rem] font-bold leading-[1.05] tracking-[-0.035em]">Comissão por nota fiscal.</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#c9c5bb]">
                    Cada nota gera a sua comissão com vencimento. Recebeu menos? Lance o valor real e o sistema guarda a diferença.
                  </p>
                </div>
                <div className="flex-1 rounded-md bg-white p-4 text-ink">
                  {[
                    ["NF 45871", "R$ 1.145,50", "A receber", "info"],
                    ["NF 8812", "R$ 921,00", "Atrasada", "alert"],
                    ["NF 8790", "R$ 1.380,40", "Recebida", "ok"],
                  ].map(([n, v, s, t]) => (
                    <div key={n} className="flex items-center gap-3 border-b border-line py-2.5 text-[13px] last:border-0">
                      <span className="font-mono text-[11px] text-muted">{n}</span>
                      <span className="flex-1 font-mono">{v}</span>
                      <Chip tone={t as "info" | "alert" | "ok"} dot>
                        {s}
                      </Chip>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          <div className="mt-16 grid gap-x-10 gap-y-9 border-t border-line pt-12 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 60}>
                <div>
                  <Icon name={f.icon} size={22} strokeWidth={1.8} />
                  <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== 09 · Preços */}
      <section id="precos" className="scroll-mt-20 py-20 sm:py-28">
        <div className={wrap}>
          <Reveal className="mb-10 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-end lg:gap-16">
            <div>
              <Eyebrow n="09">Preços</Eyebrow>
              <H2 className="mt-5">Um plano para cada tamanho de escritório.</H2>
            </div>
            <p className="text-[17px] leading-relaxed text-ink-2">
              Comece com {TRIAL_DAYS} dias grátis em qualquer plano. Sem cartão e sem taxa de instalação.
            </p>
          </Reveal>
          <Pricing />
          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 font-mono text-[12.5px] text-muted">
            {INCLUDED.map((t) => (
              <span key={t} className="flex items-center gap-2">
                <Icon name="check" size={14} strokeWidth={2} className="text-ink" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== 10 · Dúvidas */}
      <section id="duvidas" className="scroll-mt-20 bg-canvas py-20 sm:py-28">
        <div className={`${wrap} grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16`}>
          <Reveal>
            <Eyebrow n="10">Dúvidas</Eyebrow>
            <H2 className="mt-5">Perguntas frequentes.</H2>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
              Não achou o que procurava?{" "}
              <Link href="/login?modo=criar" className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4">
                Crie sua conta
              </Link>{" "}
              e fale com a gente por dentro do sistema.
            </p>
          </Reveal>
          <div className="divide-y divide-line rounded-md border border-line bg-white">
            {faq.map((f) => (
              <details key={f.q} className="group px-5 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-semibold tracking-[-0.01em]">
                  {f.q}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong transition group-open:rotate-45 group-open:border-accent group-open:bg-accent group-open:text-on-accent">
                    <Icon name="plus" size={14} strokeWidth={2} />
                  </span>
                </summary>
                <p className="-mt-1 pb-5 pr-10 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== Chamada final */}
      <section className="py-16 sm:py-24">
        <div className={wrap}>
          <Reveal>
            <div className="relative isolate overflow-hidden rounded-md bg-side px-6 py-14 text-[#f3f0e8] sm:px-14 sm:py-20">
              <Curve className="absolute -bottom-6 right-0 -z-10 hidden h-56 w-[38rem] text-[#f3f0e8]/35 md:block" w={600} h={220} />
              <Logo size={52} tone="dark" />
              <h2 className="mt-8 max-w-2xl text-balance text-[2.4rem] font-bold leading-[0.98] tracking-[-0.045em] sm:text-[3.75rem]">
                Quem representa bem, vende mais.
              </h2>
              <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-[#c9c5bb]">
                Crie a conta, cadastre o primeiro cliente pelo CNPJ e tire o primeiro pedido em poucos minutos.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/login?modo=criar" className={accentCta}>
                  Começar teste grátis <Avancar />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-[3.25rem] items-center justify-center rounded-xl border border-[#f3f0e8]/40 px-6 text-[16px] font-semibold transition hover:bg-[#f3f0e8]/10"
                >
                  Já tenho conta
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== Rodapé */}
      <footer className="border-t border-line">
        <div className={`${wrap} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="text-[17px] font-bold tracking-[-0.05em]">Representar</span>
            <span className="text-[13px] text-muted">· Mais pedidos, menos planilha.</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-2">
            <a href="#telas" className="hover:text-ink">
              Produto
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
        <p className={`${wrap} pb-10 font-mono text-[11.5px] text-faint`}>
          © {new Date().getFullYear()} Representar · Telas com dados fictícios, só para ilustração.
        </p>
      </footer>
    </div>
  );
}
