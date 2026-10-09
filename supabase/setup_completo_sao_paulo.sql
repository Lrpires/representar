-- =============================================================
-- INSTALAÇÃO COMPLETA (001 + 002) para um projeto Supabase NOVO e vazio.
-- Rode uma única vez, no SQL Editor. Não use em projeto que já tem as tabelas.
-- =============================================================

-- =============================================================
-- Fase 1: núcleo e catálogo
-- SaaS para representantes comerciais (qualquer setor)
-- Postgres / Supabase. Rode no SQL Editor ou como migração.
-- =============================================================

-- ---------- Tipos ----------
create type public.member_role as enum ('owner', 'manager', 'seller');

-- Lista fixa de unidades de venda. Para incluir outras depois:
--   alter type public.unit_type add value 'litro';
create type public.unit_type as enum ('unidade', 'caixa', 'metro', 'kg');

-- ---------- Escritórios e equipe ----------
create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  plan                text not null default 'trial',
  subscription_status text not null default 'trialing',
  created_at          timestamptz not null default now()
);

create table public.members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.member_role not null default 'seller',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index members_user_id_idx on public.members (user_id);

-- ---------- Funções de apoio para as políticas ----------
create or replace function public.is_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_manager(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'manager')
  );
$$;

create or replace function public.is_owner(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- Cria o escritório e já torna o usuário logado o dono.
create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'usuário não autenticado';
  end if;

  insert into public.organizations (name) values (p_name) returning id into v_org;
  insert into public.members (org_id, user_id, role)
  values (v_org, (select auth.uid()), 'owner');

  return v_org;
end;
$$;

-- ---------- Representadas (fábricas) ----------
create table public.principals (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations (id) on delete cascade,
  name                   text not null,
  cnpj                   text,
  default_commission_pct numeric(5, 2) check (default_commission_pct between 0 and 100),
  payment_terms          text,
  contact                text,
  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  unique (id, org_id)
);
create index principals_org_idx on public.principals (org_id);

-- ---------- Clientes ----------
create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  seller_id       uuid references auth.users (id),
  name            text not null,
  cnpj            text,
  address         text,
  status          text not null default 'ativo',
  last_contact_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (id, org_id)
);
create index customers_org_idx on public.customers (org_id);
create index customers_seller_idx on public.customers (seller_id);

create table public.customer_contacts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  customer_id uuid not null,
  name        text not null,
  role        text,
  phone       text,
  email       text,
  created_at  timestamptz not null default now(),
  foreign key (customer_id, org_id)
    references public.customers (id, org_id) on delete cascade
);
create index customer_contacts_customer_idx on public.customer_contacts (customer_id);

-- ---------- Catálogo ----------
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  principal_id uuid not null,
  code         text not null,
  name         text not null,
  unit         public.unit_type not null default 'unidade',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (id, org_id),
  unique (principal_id, code),
  foreign key (principal_id, org_id)
    references public.principals (id, org_id) on delete cascade
);
create index products_org_idx on public.products (org_id);

-- Variações: cor, tamanho, grade ou outros atributos, guardados em jsonb.
create table public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  product_id uuid not null,
  code       text not null,
  attributes jsonb not null default '{}'::jsonb,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  unique (product_id, code),
  foreign key (product_id, org_id)
    references public.products (id, org_id) on delete cascade
);
create index product_variants_org_idx on public.product_variants (org_id);

-- Todo produto nasce com uma variação padrão, para sempre ter onde pendurar preço.
create or replace function public.create_default_variant()
returns trigger
language plpgsql
as $$
begin
  insert into public.product_variants (org_id, product_id, code)
  values (new.org_id, new.id, new.code);
  return new;
end;
$$;

create trigger products_default_variant
  after insert on public.products
  for each row execute function public.create_default_variant();

-- ---------- Tabelas de preço ----------
create table public.price_tables (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  principal_id uuid not null,
  name         text not null,
  valid_from   date not null,
  valid_to     date,
  created_at   timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  unique (id, org_id),
  foreign key (principal_id, org_id)
    references public.principals (id, org_id) on delete cascade
);
create index price_tables_org_idx on public.price_tables (org_id);

create table public.price_items (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  price_table_id uuid not null,
  variant_id     uuid not null,
  price          numeric(14, 4) not null check (price >= 0),
  unique (price_table_id, variant_id),
  foreign key (price_table_id, org_id)
    references public.price_tables (id, org_id) on delete cascade,
  foreign key (variant_id, org_id)
    references public.product_variants (id, org_id) on delete cascade
);
create index price_items_org_idx on public.price_items (org_id);

-- =============================================================
-- Segurança por linha (RLS)
-- Regras: todos do escritório leem o catálogo; só dono e gerente
-- editam; vendedor vê apenas os próprios clientes.
-- =============================================================
alter table public.organizations     enable row level security;
alter table public.members           enable row level security;
alter table public.principals        enable row level security;
alter table public.customers         enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.products          enable row level security;
alter table public.product_variants  enable row level security;
alter table public.price_tables      enable row level security;
alter table public.price_items       enable row level security;

-- organizations (criação só pela função create_organization)
create policy organizations_select on public.organizations
  for select to authenticated using (public.is_member(id));
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

-- members (só o dono gerencia a equipe)
create policy members_select on public.members
  for select to authenticated using (public.is_member(org_id));
create policy members_write on public.members
  for all to authenticated
  using (public.is_owner(org_id)) with check (public.is_owner(org_id));

-- catálogo: leitura para todos, escrita para gerente e dono
create policy principals_select on public.principals
  for select to authenticated using (public.is_member(org_id));
create policy principals_write on public.principals
  for all to authenticated
  using (public.is_manager(org_id)) with check (public.is_manager(org_id));

create policy products_select on public.products
  for select to authenticated using (public.is_member(org_id));
create policy products_write on public.products
  for all to authenticated
  using (public.is_manager(org_id)) with check (public.is_manager(org_id));

create policy product_variants_select on public.product_variants
  for select to authenticated using (public.is_member(org_id));
create policy product_variants_write on public.product_variants
  for all to authenticated
  using (public.is_manager(org_id)) with check (public.is_manager(org_id));

create policy price_tables_select on public.price_tables
  for select to authenticated using (public.is_member(org_id));
create policy price_tables_write on public.price_tables
  for all to authenticated
  using (public.is_manager(org_id)) with check (public.is_manager(org_id));

create policy price_items_select on public.price_items
  for select to authenticated using (public.is_member(org_id));
create policy price_items_write on public.price_items
  for all to authenticated
  using (public.is_manager(org_id)) with check (public.is_manager(org_id));

-- clientes: gerente e dono veem todos; vendedor só os próprios
create policy customers_select on public.customers
  for select to authenticated
  using (
    public.is_manager(org_id)
    or (public.is_member(org_id) and seller_id = (select auth.uid()))
  );
create policy customers_insert on public.customers
  for insert to authenticated
  with check (
    public.is_manager(org_id)
    or (public.is_member(org_id) and seller_id = (select auth.uid()))
  );
create policy customers_update on public.customers
  for update to authenticated
  using (
    public.is_manager(org_id)
    or (public.is_member(org_id) and seller_id = (select auth.uid()))
  )
  with check (
    public.is_manager(org_id)
    or (public.is_member(org_id) and seller_id = (select auth.uid()))
  );
create policy customers_delete on public.customers
  for delete to authenticated using (public.is_manager(org_id));

-- contatos herdam a visibilidade do cliente (a RLS de customers filtra o exists)
create policy customer_contacts_all on public.customer_contacts
  for all to authenticated
  using (
    exists (select 1 from public.customers c where c.id = customer_contacts.customer_id)
  )
  with check (
    exists (select 1 from public.customers c where c.id = customer_contacts.customer_id)
  );

-- ---------- Permissões das funções ----------
revoke execute on function public.create_organization(text) from public, anon;
grant  execute on function public.create_organization(text) to authenticated;

revoke execute on function public.is_member(uuid)  from public, anon;
revoke execute on function public.is_manager(uuid) from public, anon;
revoke execute on function public.is_owner(uuid)   from public, anon;
grant  execute on function public.is_member(uuid)  to authenticated;
grant  execute on function public.is_manager(uuid) to authenticated;
grant  execute on function public.is_owner(uuid)   to authenticated;


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
