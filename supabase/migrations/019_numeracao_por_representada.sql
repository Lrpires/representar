-- 019 — Numeração dos pedidos separada por representada.
-- Cada representada tem a sua sequência: a representada A tem os pedidos 1, 2, 3…
-- e a representada B começa no 1 dela. O "Número inicial" das configurações vale para
-- o primeiro pedido de cada representada.
-- Pode ser rodada mais de uma vez sem erro.

-- 1) A regra única passa a ser (escritório, representada, número).
alter table public.orders drop constraint if exists orders_org_id_number_key;

-- 2) Renumera os pedidos que já existem, por representada, na ordem em que foram criados.
--    (Rodar de novo dá o mesmo resultado.)
with ordered as (
  select o.id,
         row_number() over (partition by o.org_id, o.principal_id order by o.created_at, o.number, o.id) as rn,
         coalesce(org.order_number_start, 1) as start
  from public.orders o
  join public.organizations org on org.id = o.org_id
)
update public.orders o
set number = ordered.start + ordered.rn - 1
from ordered
where o.id = ordered.id
  and o.number is distinct from ordered.start + ordered.rn - 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_org_principal_number_key') then
    alter table public.orders
      add constraint orders_org_principal_number_key unique (org_id, principal_id, number);
  end if;
end $$;

-- 3) Próximo número: o maior da mesma representada + 1 (respeitando o número inicial).
--    "security definer": conta todos os pedidos da representada, inclusive os que o vendedor
--    não enxerga (antes, o vendedor só "via" os próprios e o número podia repetir).
create or replace function public.set_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start integer;
begin
  -- Na edição, só renumera se a representada do pedido mudou.
  if tg_op = 'UPDATE' and new.principal_id is not distinct from old.principal_id then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext(new.org_id::text || ':' || new.principal_id::text));
  select order_number_start into v_start from public.organizations where id = new.org_id;
  select greatest(coalesce(max(number), 0) + 1, coalesce(v_start, 1)) into new.number
    from public.orders
   where org_id = new.org_id
     and principal_id = new.principal_id
     and id <> new.id;
  return new;
end;
$$;

drop trigger if exists orders_set_number on public.orders;
create trigger orders_set_number
  before insert on public.orders
  for each row execute function public.set_order_number();

drop trigger if exists orders_set_number_on_principal_change on public.orders;
create trigger orders_set_number_on_principal_change
  before update of principal_id on public.orders
  for each row execute function public.set_order_number();
