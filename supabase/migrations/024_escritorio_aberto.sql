-- 024 — Escritório aberto: quem participa de mais de um escritório vê só os dados do escritório que abriu.
-- O sistema manda, em cada consulta, o escritório aberto no cabeçalho "x-org-id".
-- As funções de permissão (is_member, is_manager, is_owner, is_back_office, can_see_commissions)
-- passam a valer só para esse escritório. Sem o cabeçalho (envio de arquivos, por exemplo),
-- continua como antes: vale para todos os escritórios da pessoa.
-- Corrige: "violates foreign key constraint orders_principal_id_org_id_fkey" ao salvar pedido
-- (a lista trazia representadas de outro escritório).
-- Pode ser rodada mais de uma vez sem erro.

-- Escritório aberto, lido do cabeçalho da requisição (vazio ou inválido = nenhum).
create or replace function public.current_org()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v text;
begin
  v := nullif(current_setting('request.headers', true), '')::json ->> 'x-org-id';
  if v ~ '^[0-9a-fA-F-]{36}$' then
    return v::uuid;
  end if;
  return null;
exception when others then
  return null;
end;
$$;
grant execute on function public.current_org() to authenticated, anon;

-- Vale para o escritório aberto (ou para qualquer um, se nenhum foi informado).
create or replace function public.in_current_org(p_org uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.current_org() is null or p_org = public.current_org();
$$;
grant execute on function public.in_current_org(uuid) to authenticated, anon;

create or replace function public.is_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.in_current_org(p_org) and exists (
    select 1 from public.members m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_manager(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.in_current_org(p_org) and exists (
    select 1 from public.members m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'manager')
  );
$$;

create or replace function public.is_owner(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.in_current_org(p_org) and exists (
    select 1 from public.members m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

create or replace function public.is_back_office(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.in_current_org(p_org) and exists (
    select 1 from public.members m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'manager', 'finance')
  );
$$;

create or replace function public.can_see_commissions(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.in_current_org(p_org) and exists (
    select 1 from public.members m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'finance')
  );
$$;

-- A pessoa sempre enxerga os próprios vínculos (é assim que o menu lista os escritórios para trocar).
drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated
  using (public.is_member(org_id) or user_id = (select auth.uid()));

-- E enxerga o nome dos escritórios de que participa (para a lista de troca), não só o aberto.
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (exists (select 1 from public.members m where m.org_id = organizations.id and m.user_id = (select auth.uid())));
