-- 011 — Metas de vendas (geral, por representada, por vendedor ou vendedor numa representada).
-- Só acrescenta. Pode ser rodada mais de uma vez sem erro.
--
-- O alvo da meta depende do que estiver preenchido:
--   sem representada e sem vendedor  -> meta geral do escritório
--   só representada                  -> meta da representada
--   só vendedor                      -> meta do vendedor
--   representada e vendedor          -> meta do vendedor naquela representada
-- O realizado é calculado na hora, a partir dos pedidos e notas fiscais.

create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  principal_id  uuid,
  seller_id     uuid references auth.users (id) on delete cascade,
  metric        text not null default 'vendido'
    check (metric in ('vendido', 'faturado', 'pedidos', 'clientes')),
  period_start  date not null,
  period_end    date not null,
  target        numeric(14, 2) not null check (target > 0),
  notes         text,
  created_by    uuid default auth.uid() references auth.users (id),
  created_at    timestamptz not null default now(),
  check (period_end >= period_start),
  foreign key (principal_id, org_id) references public.principals (id, org_id) on delete cascade
);
create index if not exists goals_org_period_idx on public.goals (org_id, period_start, period_end);

alter table public.goals enable row level security;

-- Backoffice vê todas; o vendedor vê as metas dele. Só administrador e gerente lançam.
drop policy if exists goals_select on public.goals;
create policy goals_select on public.goals
  for select to authenticated
  using (public.is_back_office(org_id) or (public.is_member(org_id) and seller_id = (select auth.uid())));

drop policy if exists goals_write on public.goals;
create policy goals_write on public.goals
  for all to authenticated
  using (public.is_manager(org_id))
  with check (public.is_manager(org_id));
