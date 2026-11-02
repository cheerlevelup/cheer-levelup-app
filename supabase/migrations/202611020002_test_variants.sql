-- Warianty wykonania testu (np. rodzaj chwytu w pull up). Test w katalogu
-- może mieć nazwę wariantu (variant_label, np. „Chwyt”) i listę opcji;
-- przy wyniku zapisuje się wybrana opcja (benchmark_tests.variant).

alter table public.test_catalog add column if not exists variant_label text;
alter table public.test_catalog add column if not exists variant_options text[] not null default '{}';
alter table public.benchmark_tests add column if not exists variant text;

-- Pull up: rodzaj chwytu
update public.test_catalog
set variant_label = 'Chwyt',
    variant_options = array['podchwyt', 'nachwyt', 'neutralny', 'mieszany']
where (name ilike '%pull%up%' or name ilike '%pullup%' or name ilike '%podciąg%')
  and coalesce(array_length(variant_options, 1), 0) = 0;

notify pgrst, 'reload schema';
