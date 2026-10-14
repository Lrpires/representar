-- 008 — Configurações do escritório + pedido no padrão do playbook.
-- Só acrescenta/afrouxa regras. Nenhum dado existente é apagado.

-- ---------- Configurações do escritório ----------
alter table public.organizations
  add column if not exists logo_path          text,                    -- logo no bucket product-images (<org>/marca/...)
  add column if not exists brand_color        text
    check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),  -- cor principal do sistema
  add column if not exists enabled_units      text[],                  -- unidades que aparecem nos produtos (vazio = todas)
  add column if not exists order_number_start integer not null default 1
    check (order_number_start between 1 and 99999999),               -- número do primeiro pedido
  add column if not exists order_prefix       text
    check (order_prefix is null or length(order_prefix) <= 12),      -- ex.: "PED-"
  add column if not exists order_suffix       text
    check (order_suffix is null or length(order_suffix) <= 12);      -- ex.: "/26"

-- O próximo número respeita o número inicial escolhido nas configurações.
create or replace function public.set_order_number()
returns trigger
language plpgsql
as $$
declare
  v_start integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.org_id::text));
  select order_number_start into v_start from public.organizations where id = new.org_id;
  select greatest(coalesce(max(number), 0) + 1, coalesce(v_start, 1)) into new.number
    from public.orders where org_id = new.org_id;
  return new;
end;
$$;

-- ---------- Itens livres (digitados à mão, sem catálogo) ----------
alter table public.order_items alter column variant_id drop not null;
alter table public.order_items alter column code set default '';
-- O mesmo produto pode aparecer em mais de uma linha (ex.: cores diferentes digitadas à mão).
alter table public.order_items drop constraint if exists order_items_order_id_variant_id_key;

-- ---------- Comissão e faturamento do pedido ----------
alter table public.orders
  add column if not exists commission_pct numeric(5, 2)
    check (commission_pct is null or commission_pct between 0 and 100),  -- % aplicado no pedido
  add column if not exists invoiced_value numeric(14, 2)
    check (invoiced_value is null or invoiced_value >= 0);               -- valor faturado pela representada

-- Pedidos antigos herdam a comissão padrão da representada.
update public.orders o
   set commission_pct = p.default_commission_pct
  from public.principals p
 where p.id = o.principal_id and o.commission_pct is null;
