-- =============================================================
-- 003 — Produto completo (serve a qualquer ramo): mais unidades,
--       descrição, medidas, fiscais, características livres, imagens (com armazenamento) e variações com EAN.
-- Só ADICIONA coisas. Nada existente é apagado ou alterado.
-- Rode uma única vez, no SQL Editor do Supabase.
-- =============================================================

-- ---------- Mais unidades de venda ----------
-- (a lista da 001 tinha: unidade, caixa, metro, kg)
alter type public.unit_type add value if not exists 'peca';
alter type public.unit_type add value if not exists 'par';
alter type public.unit_type add value if not exists 'duzia';
alter type public.unit_type add value if not exists 'cento';
alter type public.unit_type add value if not exists 'milheiro';
alter type public.unit_type add value if not exists 'pacote';
alter type public.unit_type add value if not exists 'fardo';
alter type public.unit_type add value if not exists 'saco';
alter type public.unit_type add value if not exists 'rolo';
alter type public.unit_type add value if not exists 'bobina';
alter type public.unit_type add value if not exists 'cartela';
alter type public.unit_type add value if not exists 'conjunto';
alter type public.unit_type add value if not exists 'kit';
alter type public.unit_type add value if not exists 'jogo';
alter type public.unit_type add value if not exists 'display';
alter type public.unit_type add value if not exists 'palete';
alter type public.unit_type add value if not exists 'grama';
alter type public.unit_type add value if not exists 'tonelada';
alter type public.unit_type add value if not exists 'litro';
alter type public.unit_type add value if not exists 'galao';
alter type public.unit_type add value if not exists 'lata';
alter type public.unit_type add value if not exists 'frasco';
alter type public.unit_type add value if not exists 'tubo';
alter type public.unit_type add value if not exists 'barril';
alter type public.unit_type add value if not exists 'metro_quadrado';
alter type public.unit_type add value if not exists 'metro_cubico';
alter type public.unit_type add value if not exists 'centimetro';
alter type public.unit_type add value if not exists 'hora';

-- ---------- Ficha do produto ----------
alter table public.products
  add column short_description text,                 -- 1 linha, vai no pedido/PDF
  add column description       text,                 -- descrição completa
  add column brand             text,                 -- marca
  add column category          text,                 -- categoria
  add column line              text,                 -- linha / coleção
  add column ean               text,                 -- código de barras
  add column ncm               text,                 -- classificação fiscal
  add column width_cm          numeric(10, 2) check (width_cm  is null or width_cm  >= 0),
  add column length_cm         numeric(10, 2) check (length_cm is null or length_cm >= 0),
  add column height_cm         numeric(10, 2) check (height_cm is null or height_cm >= 0),
  add column weight_kg         numeric(12, 3) check (weight_kg is null or weight_kg >= 0),
  add column units_per_pack    numeric(14, 3) check (units_per_pack  is null or units_per_pack  > 0), -- quanto vem na caixa/fardo
  add column min_order_qty     numeric(14, 3) check (min_order_qty   is null or min_order_qty   > 0), -- pedido mínimo
  add column order_multiple    numeric(14, 3) check (order_multiple  is null or order_multiple  > 0), -- vende de X em X
  add column ipi_pct           numeric(5, 2)  check (ipi_pct is null or ipi_pct between 0 and 100),
  add column lead_time_days    smallint       check (lead_time_days is null or lead_time_days between 0 and 365),
  add column tags              text[] not null default '{}',
  -- Características próprias de cada ramo, em pares nome → valor.
  -- Ex.: composição, voltagem, validade, registro na Anvisa, material, capacidade.
  add column specs             jsonb  not null default '{}'::jsonb,
  add column notes             text;                 -- observações internas

create index products_name_idx on public.products (org_id, lower(name));

-- Variação com código de barras próprio (cada cor/tamanho).
alter table public.product_variants
  add column ean text;

-- ---------- Imagens do produto ----------
create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  product_id uuid not null,
  path       text not null,                 -- caminho dentro do armazenamento
  position   integer not null default 0,
  is_cover   boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (product_id, org_id)
    references public.products (id, org_id) on delete cascade
);
create index product_images_idx on public.product_images (org_id, product_id, position);
-- no máximo uma foto de capa por produto
create unique index product_images_one_cover on public.product_images (product_id) where is_cover;

alter table public.product_images enable row level security;
create policy product_images_select on public.product_images
  for select to authenticated using (public.is_member(org_id));
create policy product_images_write on public.product_images
  for all to authenticated
  using (public.is_manager(org_id)) with check (public.is_manager(org_id));

-- ---------- Armazenamento das imagens ----------
-- Pasta pública para leitura (as fotos aparecem rápido, sem link temporário).
-- Os arquivos ficam em  <id-do-escritório>/<id-do-produto>/<arquivo>.
-- Só dono e gerente do escritório conseguem enviar, trocar ou apagar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy product_images_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_manager(((storage.foldername(name))[1])::uuid)
  );
create policy product_images_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_manager(((storage.foldername(name))[1])::uuid)
  );
create policy product_images_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_manager(((storage.foldername(name))[1])::uuid)
  );
