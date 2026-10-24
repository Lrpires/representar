-- 029 — Repasse de comissão aos vendedores.
-- Cada vendedor tem uma regra (uma só, vale para todas as representadas):
--   share → % da comissão que o escritório recebeu (ex.: 40% de R$ 300 = R$ 120)
--   rate  → % do valor faturado da nota (ex.: 1% de uma nota de R$ 10.000 = R$ 100), proporcional ao que o escritório recebeu
-- O vendedor ganha quando o escritório recebe. O pagamento do repasse fica registrado (seller_payouts) e cada
-- recebimento repassado aponta para ele, para nada ser pago duas vezes.
-- Vendedor sem login (do sistema antigo) tem regra pelo nome (seller_name), como está nos pedidos.
-- Só quem vê comissões (administrador, gerente e financeiro) lê e altera. O vendedor não vê.
-- Pode ser rodada mais de uma vez sem erro.

create table if not exists public.seller_commission_rules (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  seller_id   uuid references auth.users (id) on delete cascade,  -- vendedor com login
  seller_name text,                                             -- ou vendedor do sistema antigo, pelo nome
  mode        text not null check (mode in ('share', 'rate')),
  value       numeric(7, 3) not null check (value >= 0 and value <= 100),
  notes       text,
  updated_at  timestamptz not null default now(),
  check (seller_id is not null or nullif(trim(seller_name), '') is not null)
);
create unique index if not exists seller_commission_rules_user_uq
  on public.seller_commission_rules (org_id, seller_id) where seller_id is not null;
create unique index if not exists seller_commission_rules_name_uq
  on public.seller_commission_rules (org_id, lower(seller_name)) where seller_id is null;

create table if not exists public.seller_payouts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  seller_id    uuid references auth.users (id) on delete set null,
  seller_name  text,
  period_start date not null,
  period_end   date not null,
  amount       numeric(14, 2) not null check (amount >= 0),
  paid_at      date not null default current_date,
  notes        text,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists seller_payouts_org_idx on public.seller_payouts (org_id, paid_at);

-- Cada recebimento de comissão repassado aponta para o pagamento do repasse.
alter table public.commission_receipts
  add column if not exists seller_payout_id uuid references public.seller_payouts (id) on delete set null;
create index if not exists commission_receipts_payout_idx on public.commission_receipts (seller_payout_id);

alter table public.seller_commission_rules enable row level security;
alter table public.seller_payouts          enable row level security;
do $$
declare t text;
begin
  foreach t in array array['seller_commission_rules', 'seller_payouts'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_see_commissions(org_id)) with check (public.can_see_commissions(org_id))',
      t || '_all', t);
  end loop;
end $$;
