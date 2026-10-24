-- 027 — Comissão protegida no banco: o vendedor não consegue ler nada de comissão, nem consultando o banco direto.
-- Os dados de comissão saem das tabelas que todos leem (pedido, representada, produto) e vão para tabelas próprias,
-- que só quem vê comissões enxerga (administrador, gerente e financeiro).
--   order_commission_terms      → % de comissão de cada pedido
--   principal_commission_terms  → regra de comissão de cada representada (%, base, quando é devida, quando paga…)
--   product_commission_terms    → % de comissão próprio de um produto (vazio = regra da representada)
-- O banco preenche sozinho o % do pedido de quem não vê comissão (padrão da representada) e calcula as
-- comissões de cada nota (create_invoice_commissions), sem precisar mostrar o % a quem lança a nota.
-- Também passa a deixar o gerente ver comissões.
-- As colunas antigas continuam existindo até a migração 028 (rodar depois que o sistema novo estiver no ar).
-- Pode ser rodada mais de uma vez sem erro.

-- 1) Gerente também vê comissões (continua valendo só para o escritório aberto, migração 024).
create or replace function public.can_see_commissions(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.in_current_org(p_org) and exists (
    select 1 from public.members m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'manager', 'finance')
  );
$$;

-- 2) Tabelas protegidas.
create table if not exists public.order_commission_terms (
  order_id       uuid primary key references public.orders (id) on delete cascade,
  org_id         uuid not null references public.organizations (id) on delete cascade,
  commission_pct numeric(5, 2) check (commission_pct is null or commission_pct between 0 and 100),
  updated_at     timestamptz not null default now()
);

create table if not exists public.principal_commission_terms (
  principal_id               uuid primary key references public.principals (id) on delete cascade,
  org_id                     uuid not null references public.organizations (id) on delete cascade,
  default_commission_pct     numeric(5, 2) check (default_commission_pct is null or default_commission_pct between 0 and 100),
  commission_base            text not null default 'valor_total',
  commission_trigger         text not null default 'recebimento_cliente',
  commission_release         text not null default 'por_parcela',
  commission_close_mode      text not null default 'dia_fixo',
  commission_close_day       smallint check (commission_close_day is null or commission_close_day between 1 and 31),
  commission_days_after      smallint check (commission_days_after is null or commission_days_after between 0 and 365),
  commission_pay_method      text not null default 'pix',
  commission_needs_invoice   boolean not null default false,
  commission_chargeback      boolean not null default true,
  commission_chargeback_days smallint check (commission_chargeback_days is null or commission_chargeback_days between 0 and 730),
  commission_notes           text,
  updated_at                 timestamptz not null default now()
);

create table if not exists public.product_commission_terms (
  product_id     uuid primary key references public.products (id) on delete cascade,
  org_id         uuid not null references public.organizations (id) on delete cascade,
  commission_pct numeric(5, 2) check (commission_pct is null or commission_pct between 0 and 100),
  updated_at     timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['order_commission_terms', 'principal_commission_terms', 'product_commission_terms'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_see_commissions(org_id)) with check (public.can_see_commissions(org_id))',
      t || '_all', t);
  end loop;
end $$;

-- 3) Copia o que já existe (rodar de novo atualiza com o valor das colunas antigas).
insert into public.order_commission_terms (order_id, org_id, commission_pct)
select id, org_id, commission_pct from public.orders
on conflict (order_id) do update set commission_pct = excluded.commission_pct, updated_at = now();

insert into public.principal_commission_terms (
  principal_id, org_id, default_commission_pct, commission_base, commission_trigger, commission_release,
  commission_close_mode, commission_close_day, commission_days_after, commission_pay_method,
  commission_needs_invoice, commission_chargeback, commission_chargeback_days, commission_notes)
select id, org_id, default_commission_pct, commission_base, commission_trigger, commission_release,
  commission_close_mode, commission_close_day, commission_days_after, commission_pay_method,
  commission_needs_invoice, commission_chargeback, commission_chargeback_days, commission_notes
from public.principals
on conflict (principal_id) do update set
  default_commission_pct = excluded.default_commission_pct, commission_base = excluded.commission_base,
  commission_trigger = excluded.commission_trigger, commission_release = excluded.commission_release,
  commission_close_mode = excluded.commission_close_mode, commission_close_day = excluded.commission_close_day,
  commission_days_after = excluded.commission_days_after, commission_pay_method = excluded.commission_pay_method,
  commission_needs_invoice = excluded.commission_needs_invoice, commission_chargeback = excluded.commission_chargeback,
  commission_chargeback_days = excluded.commission_chargeback_days, commission_notes = excluded.commission_notes,
  updated_at = now();

insert into public.product_commission_terms (product_id, org_id, commission_pct)
select id, org_id, commission_pct from public.products where commission_pct is not null
on conflict (product_id) do update set commission_pct = excluded.commission_pct, updated_at = now();

-- 4) Toda representada nova já nasce com a regra padrão.
create or replace function public.principal_terms_default()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.principal_commission_terms (principal_id, org_id) values (new.id, new.org_id)
  on conflict (principal_id) do nothing;
  return new;
end;
$$;
drop trigger if exists principals_terms_default on public.principals;
create trigger principals_terms_default
  after insert on public.principals
  for each row execute function public.principal_terms_default();

-- 5) Todo pedido novo (ou que troca de representada) recebe o % padrão da representada.
--    Quem vê comissões pode trocar depois (o sistema grava o % escolhido logo em seguida).
create or replace function public.order_terms_default()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_pct numeric(5, 2);
begin
  if tg_op = 'UPDATE' and new.principal_id is not distinct from old.principal_id then
    return new;
  end if;
  select default_commission_pct into v_pct from public.principal_commission_terms where principal_id = new.principal_id;
  insert into public.order_commission_terms (order_id, org_id, commission_pct) values (new.id, new.org_id, v_pct)
  on conflict (order_id) do update set commission_pct = excluded.commission_pct, updated_at = now();
  return new;
end;
$$;
drop trigger if exists orders_terms_default on public.orders;
create trigger orders_terms_default
  after insert or update of principal_id on public.orders
  for each row execute function public.order_terms_default();

-- 6) Vencimento da comissão pela regra da representada (mesma regra de src/lib/commission-due.ts).
create or replace function public.commission_due_date(p_date date, p_mode text, p_close_day int, p_days_after int)
returns date
language plpgsql immutable
as $$
declare
  v_first date;
  v_last int;
begin
  if p_mode = 'dias_apos_evento' then
    return p_date + coalesce(p_days_after, 30);
  elsif p_mode = 'dia_fixo' then
    -- Dia fixo do mês seguinte (ex.: dia 10). Meses curtos usam o último dia.
    v_first := (date_trunc('month', p_date) + interval '1 month')::date;
    v_last := extract(day from (v_first + interval '1 month' - interval '1 day'))::int;
    return v_first + (least(coalesce(p_close_day, 10), v_last) - 1);
  elsif p_mode = 'semanal' then
    return p_date + 7;
  elsif p_mode = 'quinzenal' then
    return p_date + 15;
  end if;
  return p_date + 30;
end;
$$;

-- 7) Comissões de uma nota (mesma regra de src/lib/commission-plan.ts):
--    na liquidez, uma por parcela, proporcional ao valor da parcela (a última fica com o arredondamento);
--    no faturamento (ou sem parcelas), uma só, com o valor completo, contada da emissão.
--    Quem lança a nota (inclusive o vendedor) chama; o % nunca volta para quem chamou.
create or replace function public.create_invoice_commissions(p_invoice uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_inv record;
  v_ord record;
  v_rule record;
  v_pct numeric := 0;
  v_sum numeric;
  v_base_left numeric;
  v_val_left numeric;
  v_base numeric;
  v_val numeric;
  v_n int := 0;
  v_count int;
  v_i int := 0;
  r record;
begin
  select i.id, i.org_id, i.order_id, i.value, i.issued_at into v_inv from public.order_invoices i where i.id = p_invoice;
  if v_inv.id is null then
    return 0;
  end if;
  select o.id, o.org_id, o.seller_id, o.principal_id into v_ord from public.orders o where o.id = v_inv.order_id;
  -- Só quem pode lançar nota neste pedido (escritório aberto, migração 024).
  if not (public.is_back_office(v_ord.org_id) or (public.is_member(v_ord.org_id) and v_ord.seller_id = (select auth.uid()))) then
    raise exception 'Sem permissão para lançar comissões desta nota.';
  end if;
  if exists (select 1 from public.commissions c where c.invoice_id = p_invoice) then
    return 0;
  end if;

  select coalesce(t.commission_pct, 0) into v_pct from public.order_commission_terms t where t.order_id = v_ord.id;
  v_pct := coalesce(v_pct, 0);
  select * into v_rule from public.principal_commission_terms where principal_id = v_ord.principal_id;
  select count(*), coalesce(sum(value), 0) into v_count, v_sum from public.order_invoice_installments where invoice_id = p_invoice;

  if (coalesce(v_rule.commission_trigger, 'recebimento_cliente') = 'recebimento_cliente'
      or coalesce(v_rule.commission_release, 'por_parcela') = 'por_parcela')
     and v_count > 0 and v_sum > 0 then
    v_base_left := round(v_inv.value, 2);
    v_val_left := round(v_inv.value * v_pct / 100, 2);
    for r in select * from public.order_invoice_installments where invoice_id = p_invoice order by position loop
      v_i := v_i + 1;
      if v_i = v_count then
        v_base := v_base_left;
        v_val := v_val_left;
      else
        v_base := round(v_inv.value * r.value / v_sum, 2);
        v_val := round(v_base * v_pct / 100, 2);
      end if;
      v_base_left := round(v_base_left - v_base, 2);
      v_val_left := round(v_val_left - v_val, 2);
      insert into public.commissions (org_id, order_id, invoice_id, installment_id, principal_id, seller_id, base_value, pct, value, due_date)
      values (v_ord.org_id, v_ord.id, p_invoice, r.id, v_ord.principal_id, v_ord.seller_id, greatest(v_base, 0), v_pct, greatest(v_val, 0),
              public.commission_due_date(r.due_date, v_rule.commission_close_mode, v_rule.commission_close_day, v_rule.commission_days_after));
      v_n := v_n + 1;
    end loop;
  else
    insert into public.commissions (org_id, order_id, invoice_id, principal_id, seller_id, base_value, pct, value, due_date)
    values (v_ord.org_id, v_ord.id, p_invoice, v_ord.principal_id, v_ord.seller_id, round(v_inv.value, 2), v_pct,
            round(v_inv.value * v_pct / 100, 2),
            public.commission_due_date(v_inv.issued_at, v_rule.commission_close_mode, v_rule.commission_close_day, v_rule.commission_days_after));
    v_n := 1;
  end if;
  return v_n;
end;
$$;
revoke execute on function public.create_invoice_commissions(uuid) from public, anon;
grant execute on function public.create_invoice_commissions(uuid) to authenticated;
