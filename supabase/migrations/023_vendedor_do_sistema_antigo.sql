-- 023 — Nome do vendedor vindo do sistema antigo (importação).
-- Os vendedores antigos ainda não têm login no Representar: o nome fica guardado no pedido e no cliente.
-- Quando o vendedor entrar pela Equipe, os pedidos e clientes dele passam a ser dele (seller_id).
-- Pode ser rodada mais de uma vez sem erro.

alter table public.orders    add column if not exists seller_name text;
alter table public.customers add column if not exists seller_name text;

create index if not exists orders_seller_name_idx    on public.orders (org_id, seller_name) where seller_name is not null;
create index if not exists customers_seller_name_idx on public.customers (org_id, seller_name) where seller_name is not null;
