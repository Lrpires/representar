-- 026 — Histórico de observações do pedido: o que aconteceu entre o pedido e o faturamento
-- (ex.: "fábrica pediu mais 10 dias", "cliente trocou a cor"), com data, hora e quem escreveu.
-- Pode ser rodada mais de uma vez sem erro.

create table if not exists public.order_notes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  order_id    uuid not null references public.orders (id) on delete cascade,
  author_id   uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists order_notes_order_idx on public.order_notes (order_id, created_at);

alter table public.order_notes enable row level security;

-- Quem vê o pedido vê as observações dele.
drop policy if exists order_notes_select on public.order_notes;
create policy order_notes_select on public.order_notes
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_notes.order_id));

-- Quem vê o pedido pode registrar observação (inclusive o financeiro), sempre em nome próprio.
drop policy if exists order_notes_insert on public.order_notes;
create policy order_notes_insert on public.order_notes
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_member(org_id)
    and exists (select 1 from public.orders o where o.id = order_notes.order_id and o.org_id = order_notes.org_id)
  );

-- Apaga a própria observação; administrador e gerente apagam qualquer uma.
drop policy if exists order_notes_delete on public.order_notes;
create policy order_notes_delete on public.order_notes
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_manager(org_id));
