-- =============================================================
-- 002 — Representada completa + regra de comissão por fábrica
-- Só ADICIONA colunas e tabelas. Nada da 001 é apagado ou alterado.
-- Rode uma única vez, no SQL Editor do Supabase.
-- =============================================================

-- ---------- Ficha da representada ----------
alter table public.principals
  add column legal_name    text,            -- razão social
  add column state_reg     text,            -- inscrição estadual
  add column email         text,
  add column phone         text,
  add column website       text,
  add column zip           text,
  add column street        text,
  add column street_number text,
  add column complement    text,
  add column district      text,
  add column city          text,
  add column state         text check (state is null or char_length(state) = 2),
  add column contract_start date,           -- início da representação
  add column contract_end   date,           -- fim (vazio = prazo indeterminado)
  add column territory      text,           -- região/exclusividade
  add column order_email    text,           -- e-mail onde a fábrica recebe pedidos
  add column notes          text;

-- ---------- Regra de comissão (cada fábrica paga de um jeito) ----------
-- Base de cálculo: sobre o quê incide o percentual.
-- Evento: quando a comissão passa a ser devida.
-- Forma: como é liberada depois do evento.
-- Fechamento: quando a fábrica acerta com você.
-- Pagamento: por onde o dinheiro chega.
alter table public.principals
  add column commission_base text not null default 'valor_total'
    check (commission_base in ('valor_total', 'sem_ipi', 'sem_impostos', 'sem_impostos_frete')),
  add column commission_trigger text not null default 'recebimento_cliente'
    check (commission_trigger in ('pedido', 'faturamento', 'recebimento_cliente')),
  add column commission_release text not null default 'por_parcela'
    check (commission_release in ('integral', 'por_parcela')),
  add column commission_close_mode text not null default 'dia_fixo'
    check (commission_close_mode in ('dia_fixo', 'dias_apos_evento', 'semanal', 'quinzenal')),
  add column commission_close_day  smallint check (commission_close_day between 1 and 31),
  add column commission_days_after smallint check (commission_days_after between 0 and 365),
  add column commission_pay_method text not null default 'pix'
    check (commission_pay_method in ('pix', 'ted', 'boleto', 'deposito', 'desconto_em_conta', 'outro')),
  add column commission_needs_invoice boolean not null default false,  -- você emite NF/RPA?
  add column commission_chargeback boolean not null default true,      -- devolução/inadimplência estorna?
  add column commission_chargeback_days smallint check (commission_chargeback_days between 0 and 730),
  add column commission_notes text;

-- Comissão por faixa de desconto dado ao cliente (comum em confecção/têxtil).
-- Ex.: até 5% de desconto → 5%; de 5,01 a 10% → 4%; acima → 3%.
create table public.principal_commission_tiers (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  principal_id  uuid not null,
  discount_from numeric(5, 2) not null default 0 check (discount_from between 0 and 100),
  discount_to   numeric(5, 2) check (discount_to between 0 and 100),
  commission_pct numeric(5, 2) not null check (commission_pct between 0 and 100),
  created_at    timestamptz not null default now(),
  check (discount_to is null or discount_to >= discount_from),
  foreign key (principal_id, org_id)
    references public.principals (id, org_id) on delete cascade
);
create index principal_commission_tiers_idx
  on public.principal_commission_tiers (org_id, principal_id);

-- Comissão específica de um produto (sobrepõe a padrão da representada).
alter table public.products
  add column commission_pct numeric(5, 2) check (commission_pct between 0 and 100);

-- ---------- Contatos na fábrica ----------
create table public.principal_contacts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  principal_id uuid not null,
  name         text not null,
  role         text,          -- comercial, financeiro, logística...
  phone        text,
  email        text,
  birthday     date,          -- aniversário (dia e mês; o ano é opcional na tela)
  is_main      boolean not null default false,
  created_at   timestamptz not null default now(),
  foreign key (principal_id, org_id)
    references public.principals (id, org_id) on delete cascade
);
create index principal_contacts_idx on public.principal_contacts (org_id, principal_id);

-- Aniversário também nos contatos dos clientes (já existem desde a 001).
alter table public.customer_contacts
  add column if not exists birthday date;

-- ---------- Segurança por linha (mesmo padrão do catálogo) ----------
alter table public.principal_commission_tiers enable row level security;
alter table public.principal_contacts        enable row level security;

create policy principal_commission_tiers_select on public.principal_commission_tiers
  for select to authenticated using (public.is_member(org_id));
create policy principal_commission_tiers_write on public.principal_commission_tiers
  for all to authenticated
  using (public.is_manager(org_id)) with check (public.is_manager(org_id));

create policy principal_contacts_select on public.principal_contacts
  for select to authenticated using (public.is_member(org_id));
create policy principal_contacts_write on public.principal_contacts
  for all to authenticated
  using (public.is_manager(org_id)) with check (public.is_manager(org_id));
