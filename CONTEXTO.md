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
- **Antes de mudar o banco de dados: avisar** e criar uma **nova migração numerada** (a próxima é a **030**). Nunca alterar migrações já existentes. Migrações devem poder rodar mais de uma vez sem erro.
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
supabase/migrations/    001 a 020
```

## 4. Perfis e o que cada um vê

| Perfil (role) | Nome na tela | Vê / faz |
|---|---|---|
| `owner` | Administrador | Tudo, inclusive comissões, equipe, configurações e exclusão do escritório |
| `manager` | Gerente | Todos os pedidos e clientes, cadastra representadas/produtos, vê equipe. **Não vê comissões** |
| `seller` | Vendedor | Só os **próprios** clientes, pedidos, prospecção e meta. **Não vê comissões** nem contas a pagar |
| `finance` | Financeiro | Pedidos, faturamento, **comissões** e contas a pagar (hoje não enxerga a ficha de clientes — ver pendências) |

Regras no código: `getContext()` em `src/lib/session.ts` devolve `role`, `canManage`, `isOwner`, `isBackOffice` e `canSeeCommissions` (owner + manager + finance). No banco: funções `is_member`, `is_manager`, `is_owner`, `is_back_office`, `can_see_commissions`.

## 5. Módulos e regras de negócio

> **Regra de ouro da comissão:** o vendedor não vê **nada** de comissão — nem valor, nem %, nem menção em textos e confirmações (pedido, nota, PDF, telas). Só quem tem `canSeeCommissions` (administrador, gerente e financeiro). No banco (migração 027), % do pedido, regra da representada e % do produto ficam em tabelas próprias que só essas pessoas leem; as comissões da nota são criadas pela função `create_invoice_commissions` (o vendedor lança a nota sem ver o %). O % do pedido não vai para o navegador de quem não vê comissão; para essas pessoas, o servidor usa o % do próprio pedido (na edição) ou o padrão da representada.

**Pedidos**
- Status: `rascunho` → `enviado` → `parcial` (faturado em parte) → `faturado` → `entregue`; ou `cancelado`.
- Itens do catálogo ou digitados à mão. **Numeração separada por representada** (cada uma tem a sua sequência 1, 2, 3…), com início, prefixo e sufixo configuráveis (migração 019).
- Representada sugerida pela última compra do cliente. % de comissão vem da representada (campo oculto para quem não vê comissões).
- **Baixar PDF** direto com um clique (gerado no servidor, A4, com logo, cor da empresa e número de páginas: `src/lib/order-pdf.tsx`, rota `/pedidos/[id]/pdf`), além da tela de impressão e do envio por WhatsApp.

**Faturamento (notas fiscais)**
- Um pedido pode ter várias notas (faturamento parcial). Se faltar saldo, o pedido fica `parcial`; o botão **"Finalizar pedido"** encerra mesmo sem o restante (pode reabrir).
- Pedido **enviado ou faturado em parte pode ser editado** (botão "Editar pedido"): os itens são atualizados no lugar (as notas continuam ligadas), item já faturado não sai nem fica com menos do que o faturado, e a representada não muda se já houver nota; o status é recalculado (`syncOrder`). Faturado e cancelado não se editam. A ficha mostra a **comissão prevista** (% do pedido × total), a das notas lançadas e a já recebida (só administrador e financeiro), e tem o **histórico de observações** (`order_notes`, migração 026: data, hora e autor; quem escreveu ou administrador/gerente apaga).

Na ficha do pedido, as notas aparecem **por último e só para consulta**, numa tabela (NF, emissão, quantidade, valor, vencimentos) com o resumo faturado / falta faturar; clicar abre o painel da nota ali mesmo (`?nota=`, componente `faturamento/invoice-panel.tsx`, o mesmo do Faturamento, sem o botão de excluir). Detalhes e **exclusão da nota** (que apaga a comissão dela junto) ficam na área **Faturamento**, ao clicar na nota (`/faturamento?nota=…`).
- Lançamento **à mão** (escolhendo o pedido) ou pelo **XML da NF-e**, os dois pela área Faturamento: o sistema lê número, série, data, valor, chave de acesso e itens, sugere o pedido pelo CNPJ do emitente (representada) e do destinatário (cliente) e casa os itens por código/descrição. A mesma chave não entra duas vezes.

**Avisos de atraso**: contados a partir da **previsão de entrega** do pedido. Passou da previsão e não foi totalmente faturado: fica amarelo (atenção) e vermelho (crítico) após X/Y dias, definidos em Configurações. Pedido sem previsão de entrega não entra na conta. Aparecem no Painel, Pedidos e Faturamento.

**Opções do produto (cor, tamanho, voltagem…)**: listas cadastradas uma vez em Produtos → "Cores, tamanhos e opções" (`/produtos/opcoes`), **sempre de uma representada**. No pedido, os itens só aparecem depois de escolher a representada (um pedido tem produtos de uma representada só; trocar a representada tira os itens da outra). Todo produto da representada pode usar as listas dela: a grade começa vazia e as cores entram uma a uma por uma busca (código ou nome), porque cartelas passam de 100 cores; dá para escolher a lista e cruzar com outra (ex.: cor × tamanho); botão "Sem cor" lança a linha comum. Ligar a lista a produtos (até 2 por produto) é opcional: faz a grade abrir direto nela. No produto, dá para desmarcar opções que ele não tem. Cada opção pode ter acréscimo de preço (valor ou %). No pedido, escolher um produto com lista abre uma grade (por cor, ou cor × tamanho); cada opção com quantidade vira uma linha, com a descrição "Produto — Cor / Tamanho" e as opções guardadas em `order_items.options`.

**Vários escritórios**: quem participa de mais de um troca pelo menu do usuário ("Escritórios"); a escolha fica no cookie `rep_org` (`src/lib/session.ts`, ação `switchOrg`). Toda consulta do servidor vai com o cabeçalho `x-org-id` do escritório aberto e o banco (migração 024) limita os dados a ele; consultas de membros devem filtrar `org_id`, porque a pessoa sempre enxerga os próprios vínculos.

**Importação do sistema antigo (Bubble)**: os arquivos SQL ficam em `importacao/` (fora do git, têm dados de clientes), numerados na ordem de rodar no Supabase. IDs fixos: rodar de novo não duplica. 3 escritórios (RV, BV, VF), só 2026; vendedor antigo em `seller_name` (Painel, lista e pedido mostram esse nome até o vendedor ter login).

**Vendedor do cliente e do pedido**: o cliente tem um **vendedor padrão** (`customers.seller_id`), escolhido por administrador/gerente no cadastro; quando um vendedor cadastra, fica com ele mesmo. No pedido, o vendedor vem do cliente e administrador/gerente podem trocar na hora (`orders.seller_id`); o vendedor lança sempre no próprio nome.

**Preço sugerido no pedido**: o último preço que aquele cliente pagou no produto (e na mesma cor, se houver); se ele nunca comprou, o preço fica em branco. Tabelas de preço são opcionais (Configurações → Preços nos pedidos): ligadas, aparecem no menu e o pedido sugere o preço da tabela vigente.

**Lançar nota pelo XML**: só aparecem os pedidos em aberto do cliente e da representada da nota (`src/lib/nfe-match.ts`). A representada é reconhecida pela raiz do CNPJ (matriz e filiais) ou pelo nome na razão social do emitente; o cliente, pelo CNPJ/CPF ou pela razão social. Há busca pelo número do pedido, e o número citado na nota (`xPed` dos itens ou "Pedido 360" nas informações complementares) já vem escolhido, com o selo "Citado na nota". **Todos os itens da nota** são gravados como vieram (`order_invoice_lines`); cada um é ligado a um item do pedido (sugerido pelo código/descrição, dá para trocar ou deixar sem ligação), e a quantidade faturada de cada item do pedido é a soma dos itens da nota ligados a ele (pode passar do que faltava). Lançada à mão, os itens da nota são os do pedido. O painel da nota (Faturamento, `?nota=`) é largo e, quando a nota tem XML guardado, mostra o espelho completo lido do XML (`nfe-mirror.tsx`, rota `/nf/[id]?xml=1`): identificação, emitente, destinatário, produtos com NCM/CFOP, totais, parcelas (Parcela | Vencimento | Valor), transporte e informações complementares.

**Repasse aos vendedores** (migração 029, só quem vê comissões): cada vendedor tem **uma regra** (Equipe → Comissão dos vendedores), para todas as representadas: **% da comissão do escritório** (ex.: 40%) ou **% do valor faturado** (ex.: 1%, proporcional ao que o escritório recebeu daquela comissão). O vendedor ganha **quando o escritório recebe** (recebimentos em `commission_receipts`). Vendedores do sistema antigo (sem login) têm regra pelo nome (`seller_name`). Cálculo em `src/lib/seller-payout.ts`. O vendedor não vê nada disso.

**Relatórios** (`/relatorios`, administrador, gerente e financeiro): Repasse aos vendedores (por período de recebimento, com "Registrar pagamento" e desfazer, para não pagar duas vezes), Comissões por representada (previsto, recebido, em aberto, atrasado), Vendas por vendedor, por cliente (curva ABC), por representada e Produtos mais vendidos (todas as cores juntas). Os de vendas **nunca mostram valor de comissão**: para quem vê comissões, mostram só o **peso** (% do resultado, levando em conta o % de comissão de cada venda: 100 mil a 3% e 100 mil a 5% → 37,5% e 62,5%) e o **% médio**; dá para ordenar e calcular a curva ABC por **peso** em vez de valor. Todos com filtro de período e representada botão **Imprimir / PDF** (página A4 em `/imprimir/relatorio`, abre a janela de impressão; no repasse, um vendedor por linha) e **Planilha** em Excel (`/relatorios/planilha`, com o detalhe). As duas saídas usam a mesma tabela (`src/lib/report-table.ts`). O "Acumulado" (curva ABC) só aparece no relatório de clientes. A tabela ordena clicando no título da coluna (`?ordem=&dir=`, mesma ordem na impressão e na planilha). Clicar numa linha abre um painel (`?detalhe=`) com os pedidos dela (no de produtos: pedido, cliente, produto, quantidade, valor unitário, total do item e valor do pedido) ou, no de comissões, as comissões da representada. Dados em `src/lib/reports.ts`.

**Comissões**: nascem de cada nota (valor da nota × % do pedido), com vencimento pela regra da representada. Se a representada paga **no faturamento**, é uma comissão só, com o valor completo, contada da emissão. Se paga **na liquidez**, nasce **uma comissão por parcela** da nota (duplicata), proporcional ao valor dela e vencendo pela regra aplicada ao vencimento da parcela (ex.: "dia 10 do mês seguinte": parcela de 10/12 → comissão em janeiro). As parcelas vêm do XML (`<dup>`) ou são digitadas/geradas pelo prazo do pedido ao lançar a nota (migração 021). Recebimento em **várias partes** (cada pagamento é lançado e somado; enquanto faltar, fica em aberto) e **encerramento manual com motivo** (devolução parcial, inadimplência…), que pode ser reaberto. Busca pelo número da NF em todos os meses (migração 020). Cancelar o pedido cancela as comissões a receber (gatilho no banco). Só administrador e financeiro veem.

**Metas**: por vendedor, por representada ou geral. A meta do escritório é sempre a **soma** das metas distribuídas (não existe número solto). Mostra ritmo diário pelos dias úteis restantes.

**Painel (cockpit)**: filtros de período, representada e vendedor; indicadores (vendido, pedidos, ticket, faturado, **produtos vendidos** — quantos produtos *diferentes* saíram no período (70 long necks + 4 packs + 30 latas = 3 produtos) —, clientes atendidos); gráfico de vendas; meta; situação dos pedidos; pedidos em atraso; rankings (representadas, vendedores, clientes, produtos); contatos do dia; clientes para reativar. **Comissões não aparecem no Painel** (ficam só na tela Comissões). O vendedor vê só os números dele. As consultas do Painel buscam em páginas de 1.000 linhas (limite do banco), para nada ficar de fora em períodos movimentados.

**Clientes e Prospecção**: CNPJ preenche dados (BrasilAPI), CEP preenche endereço (ViaCEP); mapa com pinos (OpenStreetMap/Nominatim, pino arrastável para corrigir); interações e próximo contato; prospecto vira cliente com um clique.

**Contas a pagar**: tipo de despesa, centro de custo, forma de pagamento e fornecedor (listas editáveis em Configurações, já vêm prontas), contas repetidas por mês, vencidas em vermelho, resumo por centro de custo.

**Importar dados** (`/importar`, administrador e gerente): modelos em Excel para Representadas → Clientes → Produtos, com aba de instruções e listas de escolha; ao enviar, prévia linha a linha (novo, atualiza, com erro) antes de gravar. Reconhece cadastros existentes (CNPJ, nome ou código) e atualiza em vez de duplicar; célula vazia não apaga dado. Código em `src/lib/import-*.ts` e `src/app/(app)/importar/`.

**Configurações** (só o administrador altera): logo, **cor da empresa**, **moeda e formato dos números** (uma moeda por escritório; separadores 1.234,56 ou 1,234.56 e milhar ligado/desligado — vale para mostrar e para ler o que se digita; regra em `src/lib/number-format.ts`, nas telas do navegador via `useNumberFormat()`), numeração de pedidos, prazos de atraso, unidades de venda, listas das contas a pagar, excluir escritório.

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
| 020 | Recebimentos de comissão em partes (`commission_receipts`), comissão encerrada com motivo, moeda e formato dos números do escritório |
| 021 | Parcelas da nota (`order_invoice_installments`) e comissão por parcela (`commissions.installment_id`) |
| 022 | Listas de opções (`option_lists`, `option_values`, `product_option_lists`, `product_option_hidden`), `order_items.options`, `organizations.use_price_tables` |
| 023 | Nome do vendedor do sistema antigo (`orders.seller_name`, `customers.seller_name`) |
| 024 | Escritório aberto: consultas levam `x-org-id` e as permissões valem só para esse escritório |
| 025 | Itens da nota como vieram na NF (`order_invoice_lines`), ligados ou não a um item do pedido |
| 026 | Histórico de observações do pedido (`order_notes`) |
| 027 | Comissão protegida: `order_commission_terms`, `principal_commission_terms`, `product_commission_terms` (só quem vê comissões lê), % padrão do pedido por gatilho, `create_invoice_commissions` (comissões da nota calculadas no banco), gerente passa a ver comissões |
| 028 | Remove as colunas antigas de comissão de `orders`, `principals` e `products` (rodar depois do sistema novo no ar) |
| 029 | Repasse aos vendedores: `seller_commission_rules` (regra por vendedor, com login ou pelo nome do sistema antigo), `seller_payouts` e `commission_receipts.seller_payout_id` |

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

- **API para integrações (fazer quando o primeiro cliente pedir):** chaves por escritório em Configurações (criar, ver uma vez, desativar; permissões por área; histórico), começando por Prospecção (formulário do site → Kanban), depois Clientes/Produtos, Notas por XML, leitura de pedidos e webhooks. A API nunca devolve comissão sem permissão explícita.

- **Financeiro não enxerga clientes** (regra antiga do banco): os nomes aparecem como "Cliente" para esse perfil. Correção proposta: migração 030 liberando leitura de clientes ao financeiro.
- **Importação: próxima etapa** — notas fiscais em lote (vários XMLs de uma vez, trazendo o histórico de faturamento e comissões) e pedidos antigos por planilha. Representadas, clientes e produtos já importam.
- **Cobrança/assinatura, teste grátis e limites por plano** — não existem.
- Ícones sem versão no design system (lixeira, editar, relógio…) usam o desenho antigo com o traço novo.
- Material local fora do Git: pastas `Design System/` (design system da marca) e `modelos-site/` (4 modelos de site).
