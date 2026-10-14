-- 012 — Posição dos clientes no mapa (latitude/longitude a partir do endereço).
-- Só acrescenta. Pode ser rodada mais de uma vez sem erro.

alter table public.customers
  add column if not exists latitude      double precision check (latitude is null or latitude between -90 and 90),
  add column if not exists longitude     double precision check (longitude is null or longitude between -180 and 180),
  add column if not exists geo_quality   text check (geo_quality is null or geo_quality in ('endereco', 'cep', 'cidade', 'manual')),
  add column if not exists geocoded_at   timestamptz;

create index if not exists customers_geo_idx on public.customers (org_id) where latitude is not null;
