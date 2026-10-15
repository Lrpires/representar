// Planos e preços mostrados no site. Para mudar preço, nome ou limite, é só editar aqui.
// "monthly" é o preço no plano mensal; "annual" é o valor por mês de quem paga o ano (cobrado de uma vez).

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthly: number; // R$ por mês no plano mensal
  annual: number; // R$ por mês no plano anual
  users: string;
  highlight?: boolean;
  cta: string;
  features: string[];
};

export const TRIAL_DAYS = 14;

export const PLANS: Plan[] = [
  {
    id: "solo",
    name: "Solo",
    tagline: "Para o representante autônomo que quer largar a planilha.",
    monthly: 79,
    annual: 65,
    users: "1 pessoa",
    cta: "Começar no Solo",
    features: [
      "Pedidos ilimitados com PDF e WhatsApp",
      "Clientes, prospecção e mapa da carteira",
      "Faturamento por XML da NF-e",
      "Comissões por nota fiscal",
      "Até 5 representadas",
      "App no celular",
    ],
  },
  {
    id: "escritorio",
    name: "Escritório",
    tagline: "Para o escritório com vendedores na rua e alguém no financeiro.",
    monthly: 199,
    annual: 165,
    users: "Até 5 pessoas",
    highlight: true,
    cta: "Começar no Escritório",
    features: [
      "Tudo do Solo, sem limite de representadas",
      "Equipe com permissões (dono, gerente, vendedor, financeiro)",
      "Metas por vendedor e por representada",
      "Painel com filtros e ranking",
      "Avisos de pedidos em atraso",
      "Contas a pagar do escritório",
    ],
  },
  {
    id: "equipe",
    name: "Equipe",
    tagline: "Para operações maiores, com várias equipes e muitas fábricas.",
    monthly: 399,
    annual: 329,
    users: "Até 15 pessoas",
    cta: "Começar no Equipe",
    features: [
      "Tudo do Escritório",
      "Pessoa extra por R$ 19/mês",
      "Sua logo e suas cores no sistema",
      "Ajuda para importar sua base",
      "Atendimento prioritário",
    ],
  },
];

export const INCLUDED = [
  "Atualizações sem custo",
  "Dados separados e protegidos por conta",
  "Sem taxa de instalação",
  "Cancele quando quiser",
];
