-- 006 — Playbook "Representar", Fase 1: ficha do cliente e interações.
-- Só acrescenta colunas e uma tabela nova. Nenhum dado existente é alterado.
-- Pode ser rodada mais de uma vez sem erro (o que já existe é mantido).
-- "Dias para pagamento da comissão" da representada reaproveita a coluna
-- commission_days_after, criada na migração 002.

-- ---------- Cliente: campos do playbook ----------
alter table public.customers
  add column if not exists contact_name text,          -- Contato
  add column if not exists phone        text,          -- Telefone (com DDD)
  add column if not exists city         text,          -- Cidade / UF
  add column if not exists principal_id uuid,          -- Representada vinculada
  add column if not exists notes        text;          -- Observações

-- A representada precisa ser do mesmo escritório do cliente.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_principal_fk') then
    alter table public.customers
      add constraint customers_principal_fk
      foreign key (principal_id, org_id) references public.principals (id, org_id)
      on delete set null (principal_id);
  end if;
end $$;

create index if not exists customers_principal_idx on public.customers (principal_id);

-- ---------- Interações (contatos feitos com o cliente) ----------
-- Na Fase 3 a mesma tabela recebe lead_id, para interações com leads.
create table if not exists public.interactions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid,
  author_id   uuid not null default auth.uid() references auth.users (id),
  happened_at timestamptz not null default now(),   -- Data e hora do contato
  note        text not null check (length(trim(note)) > 0),  -- O que foi conversado
  created_at  timestamptz not null default now(),
  foreign key (customer_id, org_id) references public.customers (id, org_id) on delete cascade
);
create index if not exists interactions_customer_idx on public.interactions (customer_id, happened_at desc);

alter table public.interactions enable row level security;

-- Quem enxerga o cliente enxerga e registra as interações dele.
drop policy if exists interactions_select on public.interactions;
create policy interactions_select on public.interactions
  for select to authenticated
  using (
    public.is_member(org_id)
    and exists (select 1 from public.customers c where c.id = interactions.customer_id)
  );

drop policy if exists interactions_insert on public.interactions;
create policy interactions_insert on public.interactions
  for insert to authenticated
  with check (
    public.is_member(org_id)
    and author_id = (select auth.uid())
    and exists (select 1 from public.customers c where c.id = interactions.customer_id)
  );

-- Só o autor (ou gerente/dono) apaga.
drop policy if exists interactions_delete on public.interactions;
create policy interactions_delete on public.interactions
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_manager(org_id));
