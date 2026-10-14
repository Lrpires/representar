# Representar

Pedidos, clientes, comissões e contas do representante comercial em um só lugar.
Next.js (App Router) + Supabase (Postgres, Auth, RLS) + Tailwind. Web app responsivo e instalável (PWA).

## Módulos

- **Painel**: vendido no mês, comissão a receber, contas dos próximos 7 dias, saldo do mês e follow-ups do dia.
- **Pedidos**: lançamento em tela cheia (itens do catálogo ou digitados), comissão prevista, envio,
  faturamento com notas fiscais (parcial ou total, com PDF/XML), impressão/PDF com a logo, duplicar.
- **Comissões**: previsto, a receber e recebido por mês e por representada; atrasadas em destaque.
- **Clientes**: busca por nome/CNPJ, preenchimento automático por CNPJ (BrasilAPI) e CEP (ViaCEP),
  WhatsApp, histórico de pedidos e interações, próximo contato.
- **Leads**: funil em quadro (Novo → Contato feito → Proposta → Ganho/Perdido), interações, conversão em cliente.
- **Contas a pagar**: despesas por categoria, vencidas em vermelho, contas fixas repetidas por mês.
- **Representadas** e **Produtos** (catálogo opcional com fotos e variações).
- **Equipe** (perfis Administrador, Gerente, Vendedor, Financeiro) e **Configurações** (logo, cor,
  unidades, numeração dos pedidos, exclusão do escritório e dados).

## Como rodar

1. Crie um projeto no [Supabase](https://supabase.com).
2. No SQL Editor, rode **em ordem** os arquivos de `supabase/migrations/` (001 a 009).
   Da 006 em diante, todos podem ser rodados de novo sem erro.
3. Em Authentication, defina a Site URL como `http://localhost:3000` e adicione
   `http://localhost:3000/auth/callback` nas Redirect URLs.
4. Copie `.env.example` para `.env.local` e preencha a URL e a chave pública (Project Settings > API).
5. Instale e rode:

```bash
npm install
npm run dev
```

Abra http://localhost:3000, crie uma conta e depois o escritório.

## Segurança

Cada escritório só enxerga os próprios dados: isso é garantido pelo banco (RLS), não só pelas telas.
As notas fiscais ficam numa pasta privada e são abertas por link temporário.
