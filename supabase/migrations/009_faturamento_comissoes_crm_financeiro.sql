-- 009 — Faturamento com notas fiscais, comissões, leads e contas a pagar.
-- Só acrescenta tabelas e colunas. Pode ser rodada mais de uma vez sem erro.

-- =============================================================
-- Notas fiscais do pedido (um pedido pode ter várias: faturamento parcial)
-- =============================================================
create table if not exists public.order_invoices (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  order_id    uuid not null,
  number      text,                                   -- número da NF
  series      text,                                   -- série
  issued_at   date not null,                          -- data do faturamento
  value       numeric(14, 2) not null check (value >= 0),
  file_path   text,                                   -- PDF/XML da NF no armazenamento "invoices"
  file_name   text,
  notes       text,
  created_by  uuid default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now(),
  foreign key (order_id, org_id) references public.orders (id, org_id) on delete cascade
);
create index if not exists order_invoices_order_idx on public.order_invoices (order_id, issued_at);

-- Quanto de cada item saiu em cada nota.
create table if not exists public.order_invoice_items (
  invoice_id    uuid not null references public.order_invoices (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  qty           numeric(14, 3) not null check (qty > 0),
  primary key (invoice_id, order_item_id)
);

alter table public.order_invoices      enable row level security;
alter table public.order_invoice_items enable row level security;

-- Quem vê o pedido vê as notas; quem pode mexer no pedido (backoffice ou o vendedor) lança notas.
drop policy if exists order_invoices_select on public.order_invoices;
create policy order_invoices_select on public.order_invoices
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_invoices.order_id));

drop policy if exists order_invoices_write on public.order_invoices;
create policy order_invoices_write on public.order_invoices
  for all to authenticated
  using (exists (select 1 from public.orders o where o.id = order_invoices.order_id
                 and (public.is_back_office(o.org_id) or o.seller_id = (select auth.uid()))))
  with check (exists (select 1 from public.orders o where o.id = order_invoices.order_id
                      and (public.is_back_office(o.org_id) or o.seller_id = (select auth.uid()))));

drop policy if exists order_invoice_items_all on public.order_invoice_items;
create policy order_invoice_items_all on public.order_invoice_items
  for all to authenticated
  using (exists (select 1 from public.order_invoices i where i.id = order_invoice_items.invoice_id))
  with check (exists (select 1 from public.order_invoices i where i.id = order_invoice_items.invoice_id));

-- Pasta privada para os arquivos das notas: <id-do-escritório>/<id-do-pedido>/<arquivo>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoices', 'invoices', false, 10485760,
  array['application/pdf', 'application/xml', 'text/xml', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

drop policy if exists invoices_storage_select on storage.objects;
create policy invoices_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'invoices' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists invoices_storage_insert on storage.objects;
create policy invoices_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'invoices' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists invoices_storage_delete on storage.objects;
create policy invoices_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'invoices' and public.is_member(((storage.foldername(name))[1])::uuid));

-- =============================================================
-- Comissões (uma por nota fiscal)
-- =============================================================
create table if not exists public.commissions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  order_id       uuid not null,
  invoice_id     uuid unique references public.order_invoices (id) on delete cascade,
  principal_id   uuid not null,
  seller_id      uuid references auth.users (id),
  base_value     numeric(14, 2) not null check (base_value >= 0),  -- valor faturado
  pct            numeric(5, 2)  not null check (pct between 0 and 100),
  value          numeric(14, 2) not null check (value >= 0),       -- valor da comissão
  due_date       date not null,                                    -- vencimento previsto
  status         text not null default 'a_receber' check (status in ('a_receber', 'recebida', 'cancelada')),
  received_at    date,
  received_value numeric(14, 2),
  notes          text,
  created_at     timestamptz not null default now(),
  foreign key (order_id, org_id) references public.orders (id, org_id) on delete cascade,
  foreign key (principal_id, org_id) references public.principals (id, org_id)
);
create index if not exists commissions_org_due_idx on public.commissions (org_id, due_date);
create index if not exists commissions_order_idx on public.commissions (order_id);

alter table public.commissions enable row level security;
drop policy if exists commissions_select on public.commissions;
create policy commissions_select on public.commissions
  for select to authenticated
  using (public.is_back_office(org_id) or (public.is_member(org_id) and seller_id = (select auth.uid())));
drop policy if exists commissions_write on public.commissions;
create policy commissions_write on public.commissions
  for all to authenticated
  using (public.is_back_office(org_id) or (public.is_member(org_id) and seller_id = (select auth.uid())))
  with check (public.is_back_office(org_id) or (public.is_member(org_id) and seller_id = (select auth.uid())));

-- Pedidos já faturados antes desta migração viram uma nota + uma comissão.
insert into public.order_invoices (org_id, order_id, number, issued_at, value, created_by)
select o.org_id, o.id, o.invoice_number, o.invoiced_at, coalesce(o.invoiced_value, o.total), o.seller_id
  from public.orders o
 where o.invoiced_at is not null
   and not exists (select 1 from public.order_invoices i where i.order_id = o.id);

insert into public.commissions (org_id, order_id, invoice_id, principal_id, seller_id, base_value, pct, value, due_date, status)
select o.org_id, o.id, i.id, o.principal_id, o.seller_id, i.value, coalesce(o.commission_pct, 0),
       round(i.value * coalesce(o.commission_pct, 0) / 100, 2),
       i.issued_at + coalesce(p.commission_days_after, 30),
       case when o.status = 'cancelado' then 'cancelada' else 'a_receber' end
  from public.order_invoices i
  join public.orders o on o.id = i.order_id
  join public.principals p on p.id = o.principal_id
 where not exists (select 1 from public.commissions c where c.invoice_id = i.id);

-- =============================================================
-- Leads (funil de vendas)
-- =============================================================
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  owner_id      uuid not null default auth.uid() references auth.users (id),
  name          text not null check (length(trim(name)) > 0),   -- Nome
  company       text,                                           -- Empresa
  phone         text,                                           -- Telefone
  email         text,
  city          text,
  source        text,                                           -- Origem
  stage         text not null default 'novo'
    check (stage in ('novo', 'contato_feito', 'proposta', 'ganho', 'perdido')),
  next_contact  date,                                           -- Próximo contato
  estimated_value numeric(14, 2),
  lost_reason   text,
  notes         text,
  customer_id   uuid,                                           -- cliente criado na conversão
  position      double precision not null default 0,            -- ordem dentro da coluna
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, org_id),
  foreign key (customer_id, org_id) references public.customers (id, org_id) on delete set null (customer_id)
);
create index if not exists leads_org_stage_idx on public.leads (org_id, stage, position);
create index if not exists leads_next_contact_idx on public.leads (org_id, next_contact);

alter table public.leads enable row level security;
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (public.is_manager(org_id) or (public.is_member(org_id) and owner_id = (select auth.uid())));
drop policy if exists leads_write on public.leads;
create policy leads_write on public.leads
  for all to authenticated
  using (public.is_manager(org_id) or (public.is_member(org_id) and owner_id = (select auth.uid())))
  with check (public.is_manager(org_id) or (public.is_member(org_id) and owner_id = (select auth.uid())));

-- Interações passam a valer também para leads.
alter table public.interactions add column if not exists lead_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'interactions_lead_fk') then
    alter table public.interactions
      add constraint interactions_lead_fk foreign key (lead_id, org_id)
      references public.leads (id, org_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'interactions_target_chk') then
    alter table public.interactions
      add constraint interactions_target_chk check (customer_id is not null or lead_id is not null);
  end if;
end $$;
create index if not exists interactions_lead_idx on public.interactions (lead_id, happened_at desc);

drop policy if exists interactions_select on public.interactions;
create policy interactions_select on public.interactions
  for select to authenticated
  using (
    public.is_member(org_id) and (
      exists (select 1 from public.customers c where c.id = interactions.customer_id)
      or exists (select 1 from public.leads l where l.id = interactions.lead_id)
    )
  );
drop policy if exists interactions_insert on public.interactions;
create policy interactions_insert on public.interactions
  for insert to authenticated
  with check (
    public.is_member(org_id)
    and author_id = (select auth.uid())
    and (
      exists (select 1 from public.customers c where c.id = interactions.customer_id)
      or exists (select 1 from public.leads l where l.id = interactions.lead_id)
    )
  );

-- Próximo contato agendado também para clientes (follow-up da carteira).
alter table public.customers add column if not exists next_contact date;

-- =============================================================
-- Contas a pagar (despesas do escritório)
-- =============================================================
create table if not exists public.payables (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  created_by  uuid default auth.uid() references auth.users (id),
  description text not null check (length(trim(description)) > 0),
  category    text not null default 'outros'
    check (category in ('combustivel', 'hospedagem', 'alimentacao', 'impostos', 'telefone_internet', 'outros')),
  amount      numeric(14, 2) not null check (amount > 0),
  due_date    date not null,
  status      text not null default 'pendente' check (status in ('pendente', 'paga')),
  paid_at     date,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists payables_org_due_idx on public.payables (org_id, status, due_date);

alter table public.payables enable row level security;
drop policy if exists payables_all on public.payables;
create policy payables_all on public.payables
  for all to authenticated
  using (public.is_back_office(org_id))
  with check (public.is_back_office(org_id));

-- =============================================================
-- LGPD: o administrador pode excluir o escritório e todos os dados dele
-- (clientes, pedidos, comissões… são apagados em cascata).
-- =============================================================
drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations
  for delete to authenticated
  using (public.is_owner(id));
