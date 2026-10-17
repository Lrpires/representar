# Representar — contexto do projeto

> Documento de referência para conversas sobre o sistema. Atualizado em 16/10/2026 (commit `1e6d162`).
> Repositório: https://github.com/Lrpires/representar (branch `main`).

## 1. O que é

**Representar** é um SaaS para **representantes comerciais e escritórios de representação**. Reúne pedidos, faturamento (notas fiscais), comissões, metas, carteira de clientes (com mapa), prospecção e contas a pagar. Funciona no computador e no celular (PWA instalável).

- Assinatura da marca: **"Mais pedidos, menos planilha."** · Conceito: **"Quem representa bem, vende mais."**
- Cada escritório (empresa cliente do SaaS) só enxerga os próprios dados (garantido pelo banco, RLS).
- Cobrança/assinatura e limites de plano **ainda não existem** no sistema (só aparecem no site de apresentação).

## 2. Como trabalhar comigo (regras do dono do projeto)

- Responder em **português do Brasil**, de forma **simples** (o dono é empreendedor, não programador).
- **Antes de mudar o banco de dados: avisar** e criar uma **nova migração numerada** (a próxima é a **020**). Nunca alterar migrações já existentes. Migrações devem poder rodar mais de uma vez sem erro.
- Visual no nível Linear/Notion, **mobile first**, seguindo o design system da marca (seção 7).
- Commit e push só quando o dono pedir ("faz o commit e o push").

## 3. Tecnologia e estrutura

- **Next.js 15** (App Router, server components e server actions) + **React 19** + **Tailwind CSS v4**.
- **Supabase**: Postgres, Auth, Storage e RLS. Variáveis em `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Hospedagem prevista: Vercel (deploy automático a partir da `main`).
- Rodar local: `npm install` e `npm run dev` → http://localhost:3000

```
src/app/(app)/          telas do sistema (exigem login)
  page.tsx              Painel (cockpit)
  pedidos/              lista, editor (novo/[id]), faturamento por nota, finalizar/reabrir
  faturamento/          notas emitidas, pedidos a faturar, importação de XML da NF-e
  comissoes/            comissões por nota fiscal (só administrador e financeiro)
  metas/                metas por vendedor, representada ou geral
  clientes/  leads/     carteira (lista + mapa) e prospecção (quadro + mapa) — rota /leads, nome na tela "Prospecção"
  contas-a-pagar/       despesas do escritório
  representadas/ produtos/ tabelas-de-preco/ (tabelas de preço estão ocultas)
  equipe/ perfil/ configuracoes/
src/app/site/           site de apresentação (landing page) + planos (plans.ts)
src/app/imprimir/       pedido para impressão/PDF        src/app/nf/[id]/  abre/baixa o arquivo da nota
src/components/         ui.tsx (componentes base), nav.tsx, theme.tsx, icons.tsx, pin-map.tsx, cockpit/…
src/lib/                regras: session (perfis), orders, aging, nfe (XML), goals, cockpit, theme (cor da empresa),
                        payables, commission(-due), geocode, lookup (CNPJ/CEP), settings…
supabase/migrations/    001 a 019
```

## 4. Perfis e o que cada um vê

| Perfil (role) | Nome na tela | Vê / faz |
|---|---|---|
| `owner` | Administrador | Tudo, inclusive comissões, equipe, configurações e exclusão do escritório |
| `manager` | Gerente | Todos os pedidos e clientes, cadastra representadas/produtos, vê equipe. **Não vê comissões** |
| `seller` | Vendedor | Só os **próprios** clientes, pedidos, prospecção e meta. **Não vê comissões** nem contas a pagar |
| `finance` | Financeiro | Pedidos, faturamento, **comissões** e contas a pagar (hoje não enxerga a ficha de clientes — ver pendências) |

Regras no código: `getContext()` em `src/lib/session.ts` devolve `role`, `canManage`, `isOwner`, `isBackOffice` e `canSeeCommissions` (owner + finance). No banco: funções `is_member`, `is_manager`, `is_owner`, `is_back_office`, `can_see_commissions`.

## 5. Módulos e regras de negócio

**Pedidos**
- Status: `rascunho` → `enviado` → `parcial` (faturado em parte) → `faturado` → `entregue`; ou `cancelado`.
- Itens do catálogo ou digitados à mão. **Numeração separada por representada** (cada uma tem a sua sequência 1, 2, 3…), com início, prefixo e sufixo configuráveis (migração 019).
- Representada sugerida pela última compra do cliente. % de comissão vem da representada (campo oculto para quem não vê comissões).
- **Baixar PDF** direto com um clique (gerado no servidor, A4, com logo, cor da empresa e número de páginas: `src/lib/order-pdf.tsx`, rota `/pedidos/[id]/pdf`), além da tela de impressão e do envio por WhatsApp.

**Faturamento (notas fiscais)**
- Um pedido pode ter várias notas (faturamento parcial). Se faltar saldo, o pedido fica `parcial`; o botão **"Finalizar pedido"** encerra mesmo sem o restante (pode reabrir).
- Lançamento manual ou pelo **XML da NF-e**: o sistema lê número, série, data, valor, chave de acesso e itens, sugere o pedido pelo CNPJ do emitente (representada) e do destinatário (cliente) e casa os itens por código/descrição. A mesma chave não entra duas vezes.

**Avisos de atraso**: pedido enviado e não totalmente faturado fica amarelo (atenção) e vermelho (crítico) após X/Y dias, definidos em Configurações. Aparecem no Painel, Pedidos e Faturamento.

**Comissões**: nascem de cada nota (valor da nota × % do pedido), com vencimento pela regra da representada. Baixa com valor recebido (pode ser parcial). Cancelar o pedido cancela as comissões a receber (gatilho no banco). Só administrador e financeiro veem.

**Metas**: por vendedor, por representada ou geral. A meta do escritório é sempre a **soma** das metas distribuídas (não existe número solto). Mostra ritmo diário pelos dias úteis restantes.

**Painel (cockpit)**: filtros de período, representada e vendedor; indicadores (vendido, pedidos, ticket, faturado, **produtos vendidos** — quantos produtos *diferentes* saíram no período (70 long necks + 4 packs + 30 latas = 3 produtos) —, clientes atendidos); gráfico de vendas; meta; situação dos pedidos; pedidos em atraso; rankings (representadas, vendedores, clientes, produtos); contatos do dia; clientes para reativar. **Comissões não aparecem no Painel** (ficam só na tela Comissões). O vendedor vê só os números dele. As consultas do Painel buscam em páginas de 1.000 linhas (limite do banco), para nada ficar de fora em períodos movimentados.

**Clientes e Prospecção**: CNPJ preenche dados (BrasilAPI), CEP preenche endereço (ViaCEP); mapa com pinos (OpenStreetMap/Nominatim, pino arrastável para corrigir); interações e próximo contato; prospecto vira cliente com um clique.

**Contas a pagar**: tipo de despesa, centro de custo, forma de pagamento e fornecedor (listas editáveis em Configurações, já vêm prontas), contas repetidas por mês, vencidas em vermelho, resumo por centro de custo.

**Importar dados** (`/importar`, administrador e gerente): modelos em Excel para Representadas → Clientes → Produtos, com aba de instruções e listas de escolha; ao enviar, prévia linha a linha (novo, atualiza, com erro) antes de gravar. Reconhece cadastros existentes (CNPJ, nome ou código) e atualiza em vez de duplicar; célula vazia não apaga dado. Código em `src/lib/import-*.ts` e `src/app/(app)/importar/`.

**Configurações** (só o administrador altera): logo, **cor da empresa**, numeração de pedidos, prazos de atraso, unidades de venda, listas das contas a pagar, excluir escritório.

## 6. Banco de dados (migrações)

| Nº | Conteúdo |
|---|---|
| 001–005 | Núcleo: escritórios, membros e perfis, representadas, produtos, clientes, pedidos e itens |
| 006–007 | Clientes completos, interações e endereço |
| 008 | Configurações do escritório, itens digitados, % comissão no pedido |
| 009 | Notas fiscais, comissões, prospecção (leads), contas a pagar |
| 010 | Perfil do usuário (foto, telefone) |
| 011 | Metas |
| 012–014 | Localização no mapa (clientes e prospecção) e precisão |
| 015 | Logomarcas de clientes e representadas |
| 016 | Status `parcial` no pedido |
| 017 | Prazos de atraso, finalizar pedido, chave de acesso da NF-e |
| 018 | Comissões só para administrador/financeiro, gatilho de cancelamento, listas das contas a pagar (`payable_options`) |
| 019 | Numeração dos pedidos por representada (e renumeração dos pedidos existentes) |

Storage: `product-images` (público), `invoices` (privado, link temporário), `avatars`, `logos`.

## 7. Marca e design system

- **Cores**: Grafite `#15171C`, Papel `#F3F0E8` (no lugar do branco), Linho `#EBE7DD`, Areia `#E3DED2`, Borda `#D6D1C5`, Pedra `#6E6B64`. **Laranja `#FF5B22`** é o sinal (ação principal, meta, destaque); texto sobre laranja é sempre grafite. Petróleo `#0F3D3E` de apoio. Verde/vermelho só para status.
- **Fontes**: Schibsted Grotesk (textos, títulos 700 com espaçamento negativo) e JetBrains Mono (números, valores, etiquetas "01 — TÍTULO").
- **Símbolo**: duas setas (divisas) — a de trás grafite (papel no escuro), a da frente sempre laranja. Ícones próprios de traço reto.
- **Cor da empresa**: escolhida em Configurações, substitui o laranja dentro do sistema daquele escritório (botão principal, menu, barras, abas, links). Gerada em `src/lib/theme.ts` (`themeCss`).
- **Tema**: Claro, Escuro ou Automático no menu do usuário (guardado no aparelho). Tokens em `src/app/globals.css` (`--color-paper`, `--color-surface`, `--color-ink`, `--color-accent`, `--color-pen`…).
- Componentes base em `src/components/ui.tsx`: botões (`primaryBtn` grafite, `accentBtn` cor da empresa, `ghostBtn`…), campos, tabelas, `PageHeader`, `Card`, `Sheet` (gaveta), `SaveBar`, `Badge`, `Progress`.
- Vocabulário: pedido, cotação, representada, cliente, comissão, meta, faturar, carteira, prospecção. Evitar "lead", "usuário", "solução".

## 8. Site de apresentação

- Mora em `src/app/site`. Visitante sem login em `/` vê o site (o middleware reescreve para `/site`); logado vai ao Painel. `/site` abre sempre.
- Estilo "Papel" com tema dia/noite (botão sol/lua). Telas do produto desenhadas com dados fictícios.
- **Planos (sugestão, editar em `src/app/site/plans.ts`)**: Solo R$ 79/mês (R$ 65 no anual) · Escritório R$ 199 (R$ 165) · Equipe R$ 399 (R$ 329). Promete 14 dias grátis sem cartão — **ainda não implementado**.

## 9. Pendências e próximos passos

- **Financeiro não enxerga clientes** (regra antiga do banco): os nomes aparecem como "Cliente" para esse perfil. Correção proposta: migração 020 liberando leitura de clientes ao financeiro.
- **Importação: próxima etapa** — notas fiscais em lote (vários XMLs de uma vez, trazendo o histórico de faturamento e comissões) e pedidos antigos por planilha. Representadas, clientes e produtos já importam.
- **Cobrança/assinatura, teste grátis e limites por plano** — não existem.
- Ícones sem versão no design system (lixeira, editar, relógio…) usam o desenho antigo com o traço novo.
- Material local fora do Git: pastas `Design System/` (design system da marca) e `modelos-site/` (4 modelos de site).
