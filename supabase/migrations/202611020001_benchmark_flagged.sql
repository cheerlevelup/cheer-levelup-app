-- Oznaczenie wyniku testu jako podejrzanego (do sprawdzenia / powtórzenia).
-- Trener zaznacza to ręcznie w zakładce Testy; wynik podświetla się na czerwono.

alter table public.benchmark_tests add column if not exists flagged boolean not null default false;

notify pgrst, 'reload schema';
