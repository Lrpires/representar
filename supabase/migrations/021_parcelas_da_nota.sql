-- 021 — Parcelas (duplicatas) da nota fiscal e comissão por parcela.
-- Cada nota pode ter parcelas com vencimento e valor (lidas do XML ou digitadas).
-- Quando a regra da representada é "proporcional a cada parcela", nasce uma comissão por parcela,
-- vencendo conforme a regra aplicada ao vencimento de cada parcela (ex.: dia 10 do mês seguinte).
-- Pode ser rodada mais de uma vez sem erro.

create table if not exists public.order_invoice_installments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.order_invoices (id) on delete cascade,
  position   int not null default 1,
  number     text,                                   -- nº da duplicata (ex.: 001)
  due_date   date not null,                          -- vencimento da parcela para o cliente
  value      numeric(14, 2) not null check (value > 0),
  created_at timestamptz not null default now()
);
create index if not exists order_invoice_installments_invoice_idx on public.order_invoice_installments (invoice_id, position);

alter table public.order_invoice_installments enable row level security;
-- Mesma visibilidade da nota (quem vê o pedido vê as parcelas).
drop policy if exists order_invoice_installments_select on public.order_invoice_installments;
create policy order_invoice_installments_select on public.order_invoice_installments
  for select to authenticated
  using (exists (select 1 from public.order_invoices i where i.id = order_invoice_installments.invoice_id));
drop policy if exists order_invoice_installments_write on public.order_invoice_installments;
create policy order_invoice_installments_write on public.order_invoice_installments
  for all to authenticated
  using (exists (
    select 1 from public.order_invoices i join public.orders o on o.id = i.order_id
    where i.id = order_invoice_installments.invoice_id
      and (public.is_back_office(o.org_id) or o.seller_id = (select auth.uid()))
  ))
  with check (exists (
    select 1 from public.order_invoices i join public.orders o on o.id = i.order_id
    where i.id = order_invoice_installments.invoice_id
      and (public.is_back_office(o.org_id) or o.seller_id = (select auth.uid()))
  ));

-- Uma nota pode ter várias comissões (uma por parcela): sai a regra "uma comissão por nota".
alter table public.commissions drop constraint if exists commissions_invoice_id_key;
alter table public.commissions
  add column if not exists installment_id uuid references public.order_invoice_installments (id) on delete cascade;
create unique index if not exists commissions_installment_uq on public.commissions (installment_id) where installment_id is not null;
create index if not exists commissions_invoice_idx on public.commissions (invoice_id);
