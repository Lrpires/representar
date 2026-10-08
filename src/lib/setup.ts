import type { Counts } from "@/lib/counts";

// Etapas de configuração inicial, na ordem em que fazem sentido.
export function setupSteps(c: Counts, canManage: boolean) {
  return [
    {
      href: "/representadas",
      title: "Cadastre as representadas",
      desc: "As fábricas e marcas que você representa.",
      n: c.representadas,
      manage: true,
    },
    {
      href: "/produtos",
      title: "Cadastre os produtos",
      desc: "Cada produto pertence a uma representada.",
      n: c.produtos,
      manage: true,
    },
    {
      href: "/tabelas-de-preco",
      title: "Crie a tabela de preço",
      desc: "Lance os preços com a data de vigência.",
      n: c.tabelas,
      manage: true,
    },
    {
      href: "/clientes",
      title: "Cadastre os seus clientes",
      desc: "A sua carteira, pronta para receber pedidos.",
      n: c.clientes,
      manage: false,
    },
  ].filter((s) => canManage || !s.manage);
}
