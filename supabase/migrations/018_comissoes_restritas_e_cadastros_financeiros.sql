-- 018 — Comissões só para o administrador (e o financeiro) + cadastros das contas a pagar.
-- Pode ser rodada mais de uma vez sem erro.

-- =============================================================
-- 1) Comissões: vendedor e gerente deixam de ver valores de comissão.
--    Quem vê: Administrador (owner) e Financeiro.
--    O vendedor ainda consegue LANÇAR a nota do próprio pedido: a comissão
--    dessa nota é criada, mas ele não enxerga nem altera.
-- =============================================================
create or replace function public.can_see_commissions(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'finance')
  );
$$;
revoke execute on function public.can_see_commissions(uuid) from public, anon;
grant execute on function public.can_see_commissions(uuid) to authenticated;

drop policy if exists commissions_select on public.commissions;
create policy commissions_select on public.commissions
  for select to authenticated
  using (public.can_see_commissions(org_id));

drop policy if exists commissions_write on public.commissions;
drop policy if exists commissions_insert on public.commissions;
create policy commissions_insert on public.commissions
  for insert to authenticated
  with check (
    public.can_see_commissions(org_id)
    or public.is_back_office(org_id)
    or (public.is_member(org_id) and seller_id = (select auth.uid()))
  );

drop policy if exists commissions_update on public.commissions;
create policy commissions_update on public.commissions
  for update to authenticated
  using (public.can_see_commissions(org_id))
  with check (public.can_see_commissions(org_id));

drop policy if exists commissions_delete on public.commissions;
create policy commissions_delete on public.commissions
  for delete to authenticated
  using (public.can_see_commissions(org_id));

-- A comissão desta nota já foi recebida? (o vendedor não enxerga comissões, então o sistema pergunta por aqui
-- antes de deixar excluir a nota; só responde sobre notas de pedidos que a pessoa pode ver)
drop trigger if exists order_invoices_block_paid_delete on public.order_invoices;
drop function if exists public.block_invoice_delete_if_paid();
create or replace function public.invoice_commission_received(p_invoice uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.commissions c
    join public.order_invoices i on i.id = c.invoice_id
    join public.orders o on o.id = i.order_id
    where c.invoice_id = p_invoice
      and c.status = 'recebida'
      and (public.is_back_office(o.org_id) or o.seller_id = (select auth.uid()))
  );
$$;
revoke execute on function public.invoice_commission_received(uuid) from public, anon;
grant execute on function public.invoice_commission_received(uuid) to authenticated;

-- Pedido cancelado cancela as comissões ainda não recebidas (RN4), seja quem for que cancelou.
create or replace function public.cancel_commissions_on_order_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text = 'cancelado' and old.status::text <> 'cancelado' then
    update public.commissions set status = 'cancelada'
    where order_id = new.id and status = 'a_receber';
  end if;
  return new;
end;
$$;
drop trigger if exists orders_cancel_commissions on public.orders;
create trigger orders_cancel_commissions
  after update of status on public.orders
  for each row execute function public.cancel_commissions_on_order_cancel();

-- =============================================================
-- 2) Cadastros das contas a pagar: tipos de despesa, centros de custo
--    e formas de pagamento. Cada escritório tem os seus, já com uma lista pronta.
-- =============================================================
create table if not exists public.payable_options (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  kind       text not null check (kind in ('tipo', 'centro', 'forma')),
  name       text not null check (length(trim(name)) > 0),
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists payable_options_unique on public.payable_options (org_id, kind, lower(name));
create index if not exists payable_options_org_idx on public.payable_options (org_id, kind, sort);

alter table public.payable_options enable row level security;
drop policy if exists payable_options_select on public.payable_options;
create policy payable_options_select on public.payable_options
  for select to authenticated using (public.is_back_office(org_id));
drop policy if exists payable_options_write on public.payable_options;
create policy payable_options_write on public.payable_options
  for all to authenticated
  using (public.is_back_office(org_id))
  with check (public.is_back_office(org_id));

alter table public.payables
  add column if not exists type_id           uuid references public.payable_options (id) on delete set null,
  add column if not exists cost_center_id    uuid references public.payable_options (id) on delete set null,
  add column if not exists payment_method_id uuid references public.payable_options (id) on delete set null,
  add column if not exists supplier          text;
create index if not exists payables_type_idx on public.payables (type_id);
create index if not exists payables_center_idx on public.payables (cost_center_id);

-- Lista pronta de um escritório (só cria o que ainda não existe).
create or replace function public.seed_payable_options(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tipos text[] := array[
    'Combustível', 'Pedágio', 'Estacionamento', 'Hospedagem', 'Alimentação', 'Passagens e viagens',
    'Manutenção de veículo', 'Aluguel', 'Condomínio', 'Energia elétrica', 'Água', 'Telefone e internet',
    'Software e sistemas', 'Material de escritório', 'Marketing e brindes', 'Amostras e mostruário',
    'Correios e frete', 'Contabilidade', 'Impostos e taxas', 'Salários e pró-labore',
    'Comissão de vendedores', 'Encargos e benefícios', 'Tarifas bancárias', 'Seguros', 'Outros'
  ];
  centros text[] := array[
    'Administrativo', 'Comercial', 'Viagens e visitas', 'Marketing', 'Financeiro', 'Veículos', 'Pessoal', 'Geral'
  ];
  formas text[] := array[
    'Pix', 'Boleto', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Dinheiro', 'Débito automático'
  ];
  i int;
begin
  for i in 1 .. array_length(tipos, 1) loop
    insert into public.payable_options (org_id, kind, name, sort) values (p_org, 'tipo', tipos[i], i)
    on conflict do nothing;
  end loop;
  for i in 1 .. array_length(centros, 1) loop
    insert into public.payable_options (org_id, kind, name, sort) values (p_org, 'centro', centros[i], i)
    on conflict do nothing;
  end loop;
  for i in 1 .. array_length(formas, 1) loop
    insert into public.payable_options (org_id, kind, name, sort) values (p_org, 'forma', formas[i], i)
    on conflict do nothing;
  end loop;
end;
$$;
revoke execute on function public.seed_payable_options(uuid) from public, anon, authenticated;

-- Botão "Restaurar lista pronta" em Configurações: só o administrador do próprio escritório.
create or replace function public.restore_payable_options(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner(p_org) then
    raise exception 'sem_permissao';
  end if;
  perform public.seed_payable_options(p_org);
end;
$$;
revoke execute on function public.restore_payable_options(uuid) from public, anon;
grant execute on function public.restore_payable_options(uuid) to authenticated;

-- Escritórios que já existem ganham a lista pronta.
do $$
declare o record;
begin
  for o in select id from public.organizations loop
    perform public.seed_payable_options(o.id);
  end loop;
end $$;

-- Escritórios novos também.
create or replace function public.seed_payable_options_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_payable_options(new.id);
  return new;
end;
$$;
drop trigger if exists organizations_seed_payable_options on public.organizations;
create trigger organizations_seed_payable_options
  after insert on public.organizations
  for each row execute function public.seed_payable_options_trigger();

-- Contas antigas: a categoria antiga vira o tipo de despesa correspondente.
update public.payables p
set type_id = o.id
from public.payable_options o
where p.type_id is null
  and o.org_id = p.org_id
  and o.kind = 'tipo'
  and o.name = case p.category
    when 'combustivel' then 'Combustível'
    when 'hospedagem' then 'Hospedagem'
    when 'alimentacao' then 'Alimentação'
    when 'impostos' then 'Impostos e taxas'
    when 'telefone_internet' then 'Telefone e internet'
    else 'Outros'
  end;
