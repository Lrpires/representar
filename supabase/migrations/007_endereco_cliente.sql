-- 007 — Endereço completo do cliente (preenchido pela busca de CEP ou CNPJ).
-- Só acrescenta colunas. A coluna antiga "address" (texto livre) continua
-- existindo e aparece na ficha quando os campos novos estão vazios.
-- As representadas já têm esses campos desde a migração 002.

alter table public.customers
  add column if not exists zip           text,  -- CEP
  add column if not exists street        text,  -- Rua / logradouro
  add column if not exists street_number text,  -- Número
  add column if not exists complement    text,  -- Complemento
  add column if not exists district      text,  -- Bairro
  add column if not exists state         text check (state is null or state ~ '^[A-Z]{2}$');  -- UF
