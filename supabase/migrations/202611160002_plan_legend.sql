-- Skróty i legenda (panel ℹ️ zawodniczki) edytowalne dla każdego planu.
-- null = domyślna lista skrótów. Uruchom w Supabase SQL Editor.
alter table public.workout_plans
  add column if not exists legend jsonb;

notify pgrst, 'reload schema';
