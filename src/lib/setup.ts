import type { Counts } from "@/lib/counts";

// Etapas de configuração inicial, na ordem do fluxo principal do playbook.
export function setupSteps(c: Counts, canManage: boolean) {
  return [
    {
      href: "/representadas?novo=1",
      title: "Cadastre as representadas",
      desc: "As empresas que você representa e a comissão de cada uma.",
      n: c.representadas,
      manage: true,
    },
    {
      href: "/clientes?novo=1",
      title: "Cadastre os seus clientes",
      desc: "Com o CNPJ, os dados são preenchidos sozinhos.",
      n: c.clientes,
      manage: false,
    },
    {
      href: "/pedidos/novo",
      title: "Faça o primeiro pedido",
      desc: "Total e comissão calculados na hora.",
      n: c.pedidos,
      manage: false,
    },
  ].filter((s) => canManage || !s.manage);
}
