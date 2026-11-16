-- Plan „do samodzielnej pracy": zawodniczka widzi wszystkie treningi planu i może je
-- uzupełniać w dowolnym czasie. Bez tego widzi tylko trening rozpoczęty przez trenera
-- (z dzisiejszą datą) oraz treningi już rozpoczęte / zakończone.
-- null = domyślnie: grupa samodzielna → tak, grupa zorganizowana → nie.
-- Uruchom w Supabase SQL Editor.
alter table public.athlete_workout_assignments
  add column if not exists self_access boolean;

notify pgrst, 'reload schema';
