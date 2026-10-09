-- =============================================================
-- 004 · Usuários e perfis
-- Perfis: Administrador (owner), Gerente (manager), Vendedor (seller),
--         Financeiro (finance, novo).
-- Rode UMA vez no SQL Editor do Supabase.
-- =============================================================

-- Novo perfil: Financeiro
alter type public.member_role add value if not exists 'finance';

-- Nome e e-mail visíveis na lista da equipe
alter table public.members add column if not exists full_name text;
alter table public.members add column if not exists email text;

update public.members m
   set email = lower(u.email)
  from auth.users u
 where u.id = m.user_id and m.email is null;

-- Convites: o administrador cadastra nome + e-mail + perfil.
-- Quando essa pessoa criar a conta com o MESMO e-mail, entra no escritório sozinha.
create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null check (role in ('owner', 'manager', 'seller', 'finance')),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists invites_pending_idx
  on public.invites (org_id, lower(email)) where accepted_at is null;
create index if not exists invites_email_idx on public.invites (lower(email));

alter table public.invites enable row level security;

drop policy if exists invites_owner on public.invites;
create policy invites_owner on public.invites
  for all to authenticated
  using (public.is_owner(org_id)) with check (public.is_owner(org_id));

-- A criação do escritório passa a guardar o e-mail do administrador.
create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'usuário não autenticado';
  end if;

  insert into public.organizations (name) values (p_name) returning id into v_org;
  insert into public.members (org_id, user_id, role, email)
  values (v_org, (select auth.uid()), 'owner', lower((select auth.jwt() ->> 'email')));

  return v_org;
end;
$$;

-- Aceita os convites pendentes do e-mail de quem está logado (e-mail já confirmado).
create or replace function public.accept_invites()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text;
  v_n     integer := 0;
  r       record;
begin
  if v_uid is null then
    return 0;
  end if;

  select lower(u.email) into v_email
    from auth.users u
   where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    return 0;
  end if;

  for r in
    select * from public.invites
     where lower(email) = v_email and accepted_at is null
  loop
    insert into public.members (org_id, user_id, role, full_name, email)
    values (r.org_id, v_uid, r.role::public.member_role, r.full_name, v_email)
    on conflict (org_id, user_id) do nothing;

    update public.invites set accepted_at = now() where id = r.id;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

revoke execute on function public.accept_invites() from public, anon;
grant  execute on function public.accept_invites() to authenticated;
