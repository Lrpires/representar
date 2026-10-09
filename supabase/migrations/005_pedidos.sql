-- =============================================================
-- 005 · Pedidos
-- Rode UMA vez no SQL Editor do Supabase (depois da 004).
-- =============================================================

create type public.order_status as enum ('rascunho', 'enviado', 'faturado', 'entregue', 'cancelado');

-- Quem enxerga todos os pedidos do escritório: administrador, gerente e financeiro.
create or replace function public.is_back_office(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'manager', 'finance')
  );
$$;
revoke execute on function public.is_back_office(uuid) from public, anon;
grant  execute on function public.is_back_office(uuid) to authenticated;

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  number           integer not null,
  principal_id     uuid not null,
  customer_id      uuid not null,
  seller_id        uuid not null references auth.users (id),
  price_table_id   uuid,
  status           public.order_status not null default 'rascunho',
  order_date       date not null default current_date,
  expected_delivery date,
  payment_terms    text,
  freight_mode     text check (freight_mode in ('cif', 'fob')),
  freight_value    numeric(14, 2) not null default 0 check (freight_value >= 0),
  discount_pct     numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  subtotal         numeric(14, 2) not null default 0,
  total            numeric(14, 2) not null default 0,
  notes            text,
  invoice_number   text,
  invoiced_at      date,
  delivered_at     date,
  sent_at          timestamptz,
  cancel_reason    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, number),
  foreign key (principal_id, org_id) references public.principals (id, org_id),
  foreign key (customer_id, org_id)  references public.customers (id, org_id),
  foreign key (price_table_id, org_id)
    references public.price_tables (id, org_id) on delete set null (price_table_id)
);
create index orders_org_idx      on public.orders (org_id, number desc);
create index orders_seller_idx   on public.orders (seller_id);
create index orders_customer_idx on public.orders (customer_id);
create index orders_principal_idx on public.orders (principal_id);

-- Número sequencial dentro de cada escritório (1, 2, 3…).
create or replace function public.set_order_number()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.org_id::text));
  select coalesce(max(number), 0) + 1 into new.number
    from public.orders where org_id = new.org_id;
  return new;
end;
$$;
create trigger orders_set_number
  before insert on public.orders
  for each row execute function public.set_order_number();

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  order_id    uuid not null,
  variant_id  uuid not null,
  position    integer not null default 0,
  code        text not null,
  description text not null,
  unit        text not null,
  qty         numeric(14, 3) not null check (qty > 0),
  list_price  numeric(14, 4) not null check (list_price >= 0),
  discount_pct numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  unit_price  numeric(14, 4) not null check (unit_price >= 0),
  line_total  numeric(14, 2) not null check (line_total >= 0),
  created_at  timestamptz not null default now(),
  unique (order_id, variant_id),
  foreign key (order_id, org_id)   references public.orders (id, org_id) on delete cascade,
  foreign key (variant_id, org_id) references public.product_variants (id, org_id)
);
create index order_items_order_idx on public.order_items (order_id);

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

create policy orders_select on public.orders
  for select to authenticated
  using (public.is_back_office(org_id)
         or (public.is_member(org_id) and seller_id = (select auth.uid())));

create policy orders_insert on public.orders
  for insert to authenticated
  with check (public.is_manager(org_id)
              or (public.is_member(org_id) and seller_id = (select auth.uid())));

create policy orders_update on public.orders
  for update to authenticated
  using (public.is_back_office(org_id)
         or (public.is_member(org_id) and seller_id = (select auth.uid())))
  with check (public.is_back_office(org_id)
              or (public.is_member(org_id) and seller_id = (select auth.uid())));

create policy orders_delete on public.orders
  for delete to authenticated
  using (public.is_manager(org_id)
         or (public.is_member(org_id) and seller_id = (select auth.uid()) and status = 'rascunho'));

create policy order_items_select on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id));

create policy order_items_write on public.order_items
  for all to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_items.order_id
                   and (public.is_manager(o.org_id) or o.seller_id = (select auth.uid()))))
  with check (exists (select 1 from public.orders o
                      where o.id = order_items.order_id
                        and (public.is_manager(o.org_id) or o.seller_id = (select auth.uid()))));
