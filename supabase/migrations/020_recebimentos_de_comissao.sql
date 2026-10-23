-- 020 — Comissão recebida em partes, comissão encerrada com motivo, e moeda e formato dos números.
-- Cada pagamento que entra vira um "recebimento" (commission_receipts). A soma deles é o recebido.
-- Enquanto a soma não chega ao valor da comissão, ela continua "a receber" (recebida em parte).
-- A comissão pode ser "encerrada" à mão, com motivo (devolução parcial, cliente não pagou…):
-- aí sai do "a receber", ficando com o que entrou até ali.
-- Pode ser rodada mais de uma vez sem erro.

-- 1) Novo status "encerrada" e o motivo.
alter table public.commissions drop constraint if exists commissions_status_check;
alter table public.commissions
  add constraint commissions_status_check check (status in ('a_receber', 'recebida', 'encerrada', 'cancelada'));
alter table public.commissions
  add column if not exists closed_at    date,
  add column if not exists close_reason text;

-- 2) Recebimentos.
create table if not exists public.commission_receipts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  commission_id uuid not null references public.commissions (id) on delete cascade,
  amount        numeric(14, 2) not null check (amount > 0),
  received_at   date not null default current_date,
  notes         text,
  created_by    uuid default auth.uid() references auth.users (id),
  created_at    timestamptz not null default now()
);
create index if not exists commission_receipts_commission_idx on public.commission_receipts (commission_id);
create index if not exists commission_receipts_org_date_idx on public.commission_receipts (org_id, received_at);

alter table public.commission_receipts enable row level security;
drop policy if exists commission_receipts_all on public.commission_receipts;
create policy commission_receipts_all on public.commission_receipts
  for all to authenticated
  using (public.can_see_commissions(org_id))
  with check (public.can_see_commissions(org_id));

-- 3) Comissões já marcadas como recebidas viram um recebimento (uma vez só).
insert into public.commission_receipts (org_id, commission_id, amount, received_at, notes)
select c.org_id, c.id, coalesce(c.received_value, c.value), coalesce(c.received_at, current_date), 'Recebimento anterior'
from public.commissions c
where c.status = 'recebida'
  and coalesce(c.received_value, c.value) > 0
  and not exists (select 1 from public.commission_receipts r where r.commission_id = c.id);

-- 4) Mantém a comissão em dia com os recebimentos: total recebido, última data e status.
create or replace function public.sync_commission_receipts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce(new.commission_id, old.commission_id);
  v_sum numeric(14, 2);
  v_last date;
begin
  select coalesce(sum(amount), 0), max(received_at) into v_sum, v_last
  from public.commission_receipts where commission_id = v_id;

  update public.commissions c
  set received_value = case when v_sum > 0 then v_sum else null end,
      received_at = v_last,
      status = case
        when c.status in ('encerrada', 'cancelada') then c.status
        when v_sum >= c.value - 0.009 and c.value > 0 then 'recebida'
        else 'a_receber'
      end
  where c.id = v_id;
  return null;
end;
$$;

drop trigger if exists commission_receipts_sync on public.commission_receipts;
create trigger commission_receipts_sync
  after insert or update or delete on public.commission_receipts
  for each row execute function public.sync_commission_receipts();

-- 5) Nota com comissão já paga (no todo ou em parte) não pode ser excluída.
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
      and (c.status = 'recebida' or exists (select 1 from public.commission_receipts r where r.commission_id = c.id))
      and (public.is_back_office(o.org_id) or o.seller_id = (select auth.uid()))
  );
$$;

-- 6) Moeda e formato dos números do escritório (Configurações → Moeda e números).
alter table public.organizations
  add column if not exists currency     text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists number_style text not null default 'br' check (number_style in ('br', 'us')),
  add column if not exists number_group boolean not null default true;
