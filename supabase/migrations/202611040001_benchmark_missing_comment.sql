-- „Brak testu” (np. nieobecność) i komentarz do wyniku (np. kontuzja).
-- Wpis z missing = true nie ma wartości — oznacza, że zawodniczka nie zrobiła
-- testu w danym dniu; komentarz może mieć też zwykły wynik.

alter table public.benchmark_tests alter column value drop not null;
alter table public.benchmark_tests add column if not exists missing boolean not null default false;
alter table public.benchmark_tests add column if not exists comment text;

notify pgrst, 'reload schema';
