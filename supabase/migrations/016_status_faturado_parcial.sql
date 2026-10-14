-- 016 — Status "Faturado parcial" do pedido.
-- Fica sozinho neste arquivo porque o PostgreSQL só deixa usar um valor novo de lista
-- depois que ele foi gravado. Rode este arquivo e, em seguida, o 017.
-- Pode ser rodada mais de uma vez sem erro.

alter type public.order_status add value if not exists 'parcial' before 'faturado';
