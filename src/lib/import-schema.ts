// Modelos de planilha para importar dados (representadas, clientes, produtos).
// A ordem das colunas no arquivo não importa: o sistema reconhece pelo título.

export type ImportKind = "representadas" | "clientes" | "produtos";

export type ImportColumn = {
  key: string;
  header: string; // título da coluna no modelo
  required?: boolean;
  hint: string; // vai na aba "Instruções"
  example: string;
  width?: number;
  commission?: boolean; // só aparece para quem vê comissões
};

export type ImportDef = {
  kind: ImportKind;
  title: string; // "Representadas"
  one: string; // "representada"
  many: string; // "representadas"
  step: number;
  description: string;
  match: string; // como o sistema reconhece um cadastro que já existe
  columns: ImportColumn[];
};

export const IMPORTS: ImportDef[] = [
  {
    kind: "representadas",
    title: "Representadas",
    one: "representada",
    many: "representadas",
    step: 1,
    description: "As fábricas e marcas que você representa. Comece por aqui: os produtos dependem delas.",
    match: "Se o CNPJ (ou, sem CNPJ, o nome) já existir, a representada é atualizada em vez de duplicada.",
    columns: [
      { key: "name", header: "Nome", required: true, hint: "Como você chama a fábrica no dia a dia.", example: "Malharia Aurora", width: 28 },
      { key: "legal_name", header: "Razão social", hint: "Nome oficial da empresa.", example: "Malharia Aurora Ltda", width: 32 },
      { key: "cnpj", header: "CNPJ", hint: "Com ou sem pontuação.", example: "12.345.678/0001-90", width: 22 },
      { key: "commission", header: "Comissão (%)", hint: "Comissão padrão, sugerida em cada pedido. Ex.: 5 ou 5,5.", example: "5", width: 14, commission: true },
      { key: "days", header: "Dias para pagar a comissão", hint: "Dias depois do faturamento em que a comissão vence.", example: "30", width: 16, commission: true },
      { key: "contact", header: "Contato", hint: "Pessoa com quem você fala na fábrica.", example: "Ana (comercial)", width: 22 },
      { key: "email", header: "E-mail", hint: "E-mail da fábrica.", example: "comercial@aurora.com.br", width: 28 },
      { key: "phone", header: "Telefone", hint: "Com DDD.", example: "(81) 3333-4444", width: 18 },
      { key: "order_email", header: "E-mail para pedidos", hint: "Onde a fábrica recebe os pedidos.", example: "pedidos@aurora.com.br", width: 28 },
      { key: "zip", header: "CEP", hint: "8 números.", example: "50000-000", width: 12 },
      { key: "street", header: "Rua", hint: "", example: "Rua das Flores", width: 26 },
      { key: "street_number", header: "Número", hint: "", example: "120", width: 10 },
      { key: "complement", header: "Complemento", hint: "", example: "Galpão 2", width: 16 },
      { key: "district", header: "Bairro", hint: "", example: "Centro", width: 18 },
      { key: "city", header: "Cidade", hint: "", example: "Recife", width: 18 },
      { key: "state", header: "UF", hint: "Sigla com 2 letras.", example: "PE", width: 6 },
    ],
  },
  {
    kind: "clientes",
    title: "Clientes",
    one: "cliente",
    many: "clientes",
    step: 2,
    description: "Sua carteira. Com endereço, cada cliente aparece no mapa.",
    match: "Se o CNPJ (ou, sem CNPJ, a razão social) já existir, o cliente é atualizado. Células vazias não apagam o que já está cadastrado.",
    columns: [
      { key: "name", header: "Razão social", required: true, hint: "Nome do cliente.", example: "Confecções Serra Azul Ltda", width: 32 },
      { key: "cnpj", header: "CNPJ", hint: "Com ou sem pontuação.", example: "98.765.432/0001-10", width: 22 },
      { key: "contact_name", header: "Contato", hint: "Comprador ou dono.", example: "Carlos", width: 18 },
      { key: "phone", header: "Telefone", hint: "Com DDD. Vira o botão de WhatsApp.", example: "(81) 99999-0000", width: 18 },
      { key: "seller", header: "Vendedor (e-mail)", hint: "E-mail de quem atende o cliente na equipe. Vazio: fica com quem importou.", example: "", width: 26 },
      { key: "zip", header: "CEP", hint: "8 números.", example: "55000-000", width: 12 },
      { key: "street", header: "Rua", hint: "", example: "Av. Brasil", width: 26 },
      { key: "street_number", header: "Número", hint: "", example: "500", width: 10 },
      { key: "complement", header: "Complemento", hint: "", example: "Loja 3", width: 16 },
      { key: "district", header: "Bairro", hint: "", example: "Centro", width: 18 },
      { key: "city", header: "Cidade", hint: "", example: "Caruaru", width: 18 },
      { key: "state", header: "UF", hint: "Sigla com 2 letras.", example: "PE", width: 6 },
      { key: "notes", header: "Observações", hint: "", example: "Compra na coleção de verão", width: 30 },
    ],
  },
  {
    kind: "produtos",
    title: "Produtos",
    one: "produto",
    many: "produtos",
    step: 3,
    description: "O catálogo (opcional). Cada produto pertence a uma representada já cadastrada.",
    match: "Se o mesmo código já existir na mesma representada, o produto é atualizado.",
    columns: [
      { key: "principal", header: "Representada", required: true, hint: "Nome ou CNPJ de uma representada já cadastrada.", example: "Malharia Aurora", width: 24 },
      { key: "code", header: "Código", required: true, hint: "Código do produto na fábrica.", example: "MA-210", width: 14 },
      { key: "name", header: "Nome", required: true, hint: "Como o produto aparece no pedido.", example: "Malha penteada 30.1", width: 32 },
      { key: "unit", header: "Unidade", hint: "Ex.: Unidade, Peça, Kg, Metro, Caixa. Vazio: Unidade. A lista completa está na aba Unidades.", example: "Kg", width: 12 },
      { key: "short_description", header: "Descrição curta", hint: "Uma linha que vai no pedido.", example: "100% algodão, 1,80 m", width: 28 },
      { key: "brand", header: "Marca", hint: "", example: "Aurora", width: 16 },
      { key: "category", header: "Categoria", hint: "", example: "Malhas", width: 16 },
      { key: "line", header: "Linha / coleção", hint: "", example: "Verão 2027", width: 16 },
      { key: "ean", header: "Código de barras (EAN)", hint: "", example: "", width: 18 },
      { key: "ncm", header: "NCM", hint: "Classificação fiscal.", example: "6006.22.00", width: 12 },
      { key: "ipi_pct", header: "IPI (%)", hint: "", example: "0", width: 10 },
      { key: "min_order_qty", header: "Pedido mínimo", hint: "Quantidade mínima por pedido.", example: "20", width: 12 },
      { key: "order_multiple", header: "Vende de quanto em quanto", hint: "Ex.: 10 = só múltiplos de 10.", example: "", width: 14 },
    ],
  },
];

export const importDef = (kind: string) => IMPORTS.find((d) => d.kind === kind) ?? null;

// Colunas que a pessoa pode ver/usar (comissão só para quem vê comissões).
export const visibleColumns = (def: ImportDef, canSeeCommissions: boolean) =>
  def.columns.filter((c) => !c.commission || canSeeCommissions);

// Título sem acento, minúsculo e sem "*", para reconhecer a coluna mesmo escrita um pouco diferente.
export const normHeader = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

export type PreviewRow = {
  line: number; // linha na planilha
  status: "novo" | "atualizar" | "erro";
  label: string; // nome para mostrar
  detail: string; // CNPJ, código…
  errors: string[];
};

export type PreviewResult =
  | { ok: false; error: string }
  | {
      ok: true;
      kind: ImportKind;
      fileName: string;
      rows: PreviewRow[];
      counts: { novo: number; atualizar: number; erro: number };
      ignoredColumns: string[];
      missingRequired: string[];
      imported?: { created: number; updated: number; failed: number };
    };
