-- 025 — Itens da nota fiscal, exatamente como vieram na NF (código, descrição, unidade, quantidade, preço).
-- Antes, a nota guardava só as quantidades dos itens que casavam com o pedido; os outros se perdiam.
-- Agora todos os itens ficam na nota, e cada um pode (ou não) estar ligado a um item do pedido.
-- Pode ser rodada mais de uma vez sem erro.

create table if not exists public.order_invoice_lines (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  invoice_id    uuid not null references public.order_invoices (id) on delete cascade,
  position      int not null default 0,
  code          text,                                       -- código do produto na nota
  description   text not null,                              -- descrição na nota
  unit          text,                                       -- unidade na nota (KG, MT, UN…)
  qty           numeric(14, 3) not null check (qty >= 0),
  unit_price    numeric(14, 4) not null default 0 check (unit_price >= 0),
  total         numeric(14, 2) not null default 0 check (total >= 0),
  order_item_id uuid references public.order_items (id) on delete set null, -- item do pedido (vazio = não ligado)
  created_at    timestamptz not null default now()
);
create index if not exists order_invoice_lines_invoice_idx on public.order_invoice_lines (invoice_id, position);

alter table public.order_invoice_lines enable row level security;
-- Mesma visibilidade e permissão da nota.
drop policy if exists order_invoice_lines_select on public.order_invoice_lines;
create policy order_invoice_lines_select on public.order_invoice_lines
  for select to authenticated
  using (exists (select 1 from public.order_invoices i where i.id = order_invoice_lines.invoice_id));
drop policy if exists order_invoice_lines_write on public.order_invoice_lines;
create policy order_invoice_lines_write on public.order_invoice_lines
  for all to authenticated
  using (exists (
    select 1 from public.order_invoices i join public.orders o on o.id = i.order_id
    where i.id = order_invoice_lines.invoice_id
      and (public.is_back_office(o.org_id) or o.seller_id = (select auth.uid()))
  ))
  with check (exists (
    select 1 from public.order_invoices i join public.orders o on o.id = i.order_id
    where i.id = order_invoice_lines.invoice_id
      and (public.is_back_office(o.org_id) or o.seller_id = (select auth.uid()))
  ));
