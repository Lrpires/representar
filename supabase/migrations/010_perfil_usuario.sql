-- 010 — Perfil do usuário: foto, nome e telefone.
-- Só acrescenta. Pode ser rodada mais de uma vez sem erro.

alter table public.members
  add column if not exists avatar_path text,   -- foto no armazenamento "avatars" (<id-do-usuário>/<arquivo>)
  add column if not exists phone       text;

-- Cada pessoa edita o próprio perfil (nome, telefone, foto) em todos os escritórios
-- em que participa, sem poder mudar o próprio perfil de acesso.
create or replace function public.update_my_profile(p_full_name text, p_phone text, p_avatar_path text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_avatar_path is not null and p_avatar_path <> ''
     and split_part(p_avatar_path, '/', 1) <> (select auth.uid())::text then
    raise exception 'Foto inválida.';
  end if;
  update public.members
     set full_name   = nullif(trim(p_full_name), ''),
         phone       = nullif(trim(p_phone), ''),
         avatar_path = nullif(p_avatar_path, '')
   where user_id = (select auth.uid());
end;
$$;
revoke execute on function public.update_my_profile(text, text, text) from public, anon;
grant  execute on function public.update_my_profile(text, text, text) to authenticated;

-- Fotos de perfil: leitura pública (aparecem rápido), escrita só na própria pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
