import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { Icon, type IconName } from "@/components/icons";
import { PageHeader } from "@/components/ui";

type Report = { href: string; title: string; text: string; icon: IconName; commission?: boolean };

const REPORTS: Report[] = [
  {
    href: "/relatorios/repasse",
    title: "Repasse aos vendedores",
    text: "O que o escritório recebeu de cada vendedor no período e quanto repassar, pela regra de cada um. Registre o pagamento para não pagar duas vezes.",
    icon: "wallet",
    commission: true,
  },
  {
    href: "/relatorios/comissoes",
    title: "Comissões por representada",
    text: "Previsto, recebido, em aberto e atrasado de cada fábrica no período.",
    icon: "percent",
    commission: true,
  },
  {
    href: "/relatorios/vendas?por=vendedor",
    title: "Vendas por vendedor",
    text: "Pedidos e valor vendido por vendedor, com a participação de cada um.",
    icon: "users",
  },
  {
    href: "/relatorios/vendas?por=cliente",
    title: "Vendas por cliente (curva ABC)",
    text: "Quem mais compra: clientes A (80% do valor), B (até 95%) e C (o resto).",
    icon: "target",
  },
  {
    href: "/relatorios/vendas?por=representada",
    title: "Vendas por representada",
    text: "Quanto cada fábrica vendeu no período.",
    icon: "factory",
  },
  {
    href: "/relatorios/vendas?por=produto",
    title: "Produtos mais vendidos",
    text: "Quantidade e valor por produto (todas as cores juntas).",
    icon: "box",
  },
];

// Central de relatórios do escritório (administrador, gerente e financeiro). Os de comissão, só para quem vê comissões.
export default async function ReportsPage() {
  const { isBackOffice, canSeeCommissions } = await getContext();
  if (!isBackOffice) redirect("/");
  const list = REPORTS.filter((r) => !r.commission || canSeeCommissions);

  return (
    <>
      <PageHeader title="Relatórios" hint="Escolha o relatório. Todos têm filtro de período e de representada, e baixam em planilha." />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {list.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-float"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pen-soft text-pen">
                <Icon name={r.icon} size={19} />
              </span>
              <p className="mt-4 text-base font-semibold leading-snug">{r.title}</p>
              <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted">{r.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-accent-ink">
                Abrir
                <Icon name="chevron-right" size={14} className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
