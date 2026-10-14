-- 013 — Endereço e posição no mapa para os leads.
-- Só acrescenta. Pode ser rodada mais de uma vez sem erro.

alter table public.leads
  add column if not exists zip           text,
  add column if not exists street        text,
  add column if not exists street_number text,
  add column if not exists complement    text,
  add column if not exists district      text,
  add column if not exists state         text check (state is null or state ~ '^[A-Z]{2}$'),
  add column if not exists latitude      double precision check (latitude is null or latitude between -90 and 90),
  add column if not exists longitude     double precision check (longitude is null or longitude between -180 and 180),
  add column if not exists geo_quality   text check (geo_quality is null or geo_quality in ('endereco', 'cep', 'cidade', 'manual')),
  add column if not exists geocoded_at   timestamptz;
