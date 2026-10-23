-- 022 — Listas de opções (cor, tamanho, voltagem, sabor…) cadastradas uma vez e usadas por vários produtos.
-- Ex.: a lista "Cartela Verão 26" (tipo Cor) é ligada aos produtos A, B, C, D e E.
-- No pedido, o produto abre uma grade com as opções e cada opção vira uma linha do pedido.
-- Cada opção pode ter um acréscimo de preço (em valor ou em %), ex.: cores especiais mais caras.
-- Pode ser rodada mais de uma vez sem erro.

-- 1) Listas.
create table if not exists public.option_lists (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  principal_id uuid references public.principals (id) on delete set null,  -- vazio = vale para todas as representadas
  kind         text not null,                                              -- Cor, Tamanho, Voltagem…
  name         text not null,                                              -- ex.: Cartela Verão 26
  created_at   timestamptz not null default now()
);
create index if not exists option_lists_org_idx on public.option_lists (org_id);

-- 2) Opções de cada lista.
create table if not exists public.option_values (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  list_id      uuid not null references public.option_lists (id) on delete cascade,
  name         text not null,                                    -- ex.: Azul Marinho
  code         text,                                             -- código da fábrica, ex.: 0412
  position     int not null default 0,
  price_adjust numeric(14, 4),                                   -- acréscimo (ou desconto, se negativo)
  adjust_type  text not null default 'valor' check (adjust_type in ('valor', 'pct')),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists option_values_list_idx on public.option_values (list_id, position);

-- 3) Quais listas cada produto usa (no máximo duas aparecem na grade: ex.: Cor × Tamanho).
create table if not exists public.product_option_lists (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  list_id    uuid not null references public.option_lists (id) on delete cascade,
  position   int not null default 0,
  primary key (product_id, list_id)
);
create index if not exists product_option_lists_list_idx on public.product_option_lists (list_id);

-- 4) Opções que um produto NÃO tem (ex.: o produto C não sai na cor Vinho).
create table if not exists public.product_option_hidden (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  value_id   uuid not null references public.option_values (id) on delete cascade,
  primary key (product_id, value_id)
);

-- 5) A linha do pedido guarda as opções escolhidas, ex.: {"Cor": "Azul", "Tamanho": "M"}.
alter table public.order_items add column if not exists options jsonb;

-- Segurança: todos do escritório leem; administrador e gerente alteram (igual ao catálogo).
alter table public.option_lists          enable row level security;
alter table public.option_values         enable row level security;
alter table public.product_option_lists  enable row level security;
alter table public.product_option_hidden enable row level security;

do $$
declare t text;
begin
  foreach t in array array['option_lists', 'option_values', 'product_option_lists', 'product_option_hidden'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(org_id))', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_manager(org_id)) with check (public.is_manager(org_id))',
      t || '_write', t);
  end loop;
end $$;

-- 6) Tabelas de preço viram opcionais (Configurações → Tabelas de preço). Desligadas, somem do menu.
--    O pedido sugere o último preço praticado com o cliente (ou com qualquer cliente).
alter table public.organizations add column if not exists use_price_tables boolean not null default false;
