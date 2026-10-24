-- 028 — Tira as colunas antigas de comissão das tabelas que todos leem (pedido, representada, produto).
-- RODAR SÓ DEPOIS que o sistema novo (que usa as tabelas da migração 027) estiver no ar.
-- Antes de apagar, copia o que ainda não estiver nas tabelas protegidas (não sobrescreve o que já está lá).
-- Pode ser rodada mais de uma vez sem erro.

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'commission_pct') then
    insert into public.order_commission_terms (order_id, org_id, commission_pct)
    select id, org_id, commission_pct from public.orders
    on conflict (order_id) do nothing;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'principals' and column_name = 'default_commission_pct') then
    insert into public.principal_commission_terms (
      principal_id, org_id, default_commission_pct, commission_base, commission_trigger, commission_release,
      commission_close_mode, commission_close_day, commission_days_after, commission_pay_method,
      commission_needs_invoice, commission_chargeback, commission_chargeback_days, commission_notes)
    select id, org_id, default_commission_pct, commission_base, commission_trigger, commission_release,
      commission_close_mode, commission_close_day, commission_days_after, commission_pay_method,
      commission_needs_invoice, commission_chargeback, commission_chargeback_days, commission_notes
    from public.principals
    on conflict (principal_id) do nothing;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'commission_pct') then
    insert into public.product_commission_terms (product_id, org_id, commission_pct)
    select id, org_id, commission_pct from public.products where commission_pct is not null
    on conflict (product_id) do nothing;
  end if;
end $$;

alter table public.orders drop column if exists commission_pct;
alter table public.products drop column if exists commission_pct;
alter table public.principals
  drop column if exists default_commission_pct,
  drop column if exists commission_base,
  drop column if exists commission_trigger,
  drop column if exists commission_release,
  drop column if exists commission_close_mode,
  drop column if exists commission_close_day,
  drop column if exists commission_days_after,
  drop column if exists commission_pay_method,
  drop column if exists commission_needs_invoice,
  drop column if exists commission_chargeback,
  drop column if exists commission_chargeback_days,
  drop column if exists commission_notes;
