-- 017 — Finalização manual do pedido e prazos de atraso (rode depois da 016).
-- Só acrescenta. Pode ser rodada mais de uma vez sem erro.

-- Pedido finalizado à mão com saldo não faturado (ex.: a fábrica não vai mandar o restante).
alter table public.orders
  add column if not exists closed_at  timestamptz,
  add column if not exists close_note text;

-- Prazos de atraso (dias desde o envio sem faturar tudo): amarelo = aviso, vermelho = crítico.
alter table public.organizations
  add column if not exists order_warn_days     smallint not null default 7  check (order_warn_days between 1 and 365),
  add column if not exists order_critical_days smallint not null default 15 check (order_critical_days between 1 and 730);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_order_days_chk') then
    alter table public.organizations
      add constraint organizations_order_days_chk check (order_critical_days > order_warn_days);
  end if;
end $$;

-- Pedidos marcados como "Faturado" mas com quantidade faltando nas notas passam a "Faturado parcial".
-- (Só os que têm quantidades registradas nas notas e não foram finalizados à mão.)
update public.orders o
   set status = 'parcial'
 where o.status = 'faturado'
   and o.closed_at is null
   and exists (select 1 from public.order_invoice_items ii join public.order_invoices i on i.id = ii.invoice_id where i.order_id = o.id)
   and (select coalesce(sum(ii.qty), 0) from public.order_invoice_items ii join public.order_invoices i on i.id = ii.invoice_id where i.order_id = o.id)
       < (select coalesce(sum(it.qty), 0) from public.order_items it where it.order_id = o.id) - 0.0005;

-- Chave de acesso da NF-e (44 números), lida do XML: impede lançar a mesma nota duas vezes.
alter table public.order_invoices add column if not exists access_key text
  check (access_key is null or access_key ~ '^[0-9]{44}$');
create unique index if not exists order_invoices_access_key_uq
  on public.order_invoices (org_id, access_key) where access_key is not null;
