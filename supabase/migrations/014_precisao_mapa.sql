-- 014 — Precisão da posição no mapa (clientes e leads).
-- A busca antiga usava a posição do CEP da BrasilAPI, que na prática é o centro da cidade,
-- e marcava como "endereço" quando só a rua era encontrada. Esta migração:
--   1) aceita os níveis novos: endereço exato, rua, bairro, cidade e manual;
--   2) apaga as posições calculadas pela busca antiga, para serem refeitas com a nova.
--      As posições corrigidas à mão (manual) e as já feitas pela busca nova (geo_version 2) são mantidas.
-- Pode ser rodada mais de uma vez sem erro e sem apagar posições novas.

alter table public.customers add column if not exists geo_version smallint;
alter table public.leads     add column if not exists geo_version smallint;

alter table public.customers drop constraint if exists customers_geo_quality_check;
alter table public.customers add constraint customers_geo_quality_check
  check (geo_quality is null or geo_quality in ('endereco', 'rua', 'bairro', 'cidade', 'cep', 'manual'));

alter table public.leads drop constraint if exists leads_geo_quality_check;
alter table public.leads add constraint leads_geo_quality_check
  check (geo_quality is null or geo_quality in ('endereco', 'rua', 'bairro', 'cidade', 'cep', 'manual'));

update public.customers
   set latitude = null, longitude = null, geo_quality = null, geocoded_at = null
 where geo_quality is distinct from 'manual'
   and coalesce(geo_version, 1) < 2
   and (latitude is not null or geocoded_at is not null);

update public.leads
   set latitude = null, longitude = null, geo_quality = null, geocoded_at = null
 where geo_quality is distinct from 'manual'
   and coalesce(geo_version, 1) < 2
   and (latitude is not null or geocoded_at is not null);
