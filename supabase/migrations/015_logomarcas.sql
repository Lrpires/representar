-- 015 — Logomarca de clientes e representadas.
-- Só acrescenta. Pode ser rodada mais de uma vez sem erro.

alter table public.customers  add column if not exists logo_path text;
alter table public.principals add column if not exists logo_path text;

-- Pasta pública das logos: <id-do-escritório>/<clientes|representadas>/<id>/<arquivo>.
-- Qualquer pessoa do escritório envia (o vendedor cuida da logo dos clientes dele).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists logos_insert on storage.objects;
create policy logos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists logos_update on storage.objects;
create policy logos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists logos_delete on storage.objects;
create policy logos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and public.is_member(((storage.foldername(name))[1])::uuid));
