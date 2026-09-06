-- Migawka składu grupy w momencie utworzenia treningu — bez tego widok starego
-- treningu (błędnie) pokazywał AKTUALNYCH członków grupy, więc zawodniczka dodana
-- do grupy już PO treningu pojawiała się w nim, mimo że wtedy jej tam nie było.
alter table public.group_trainings
  add column if not exists roster_athlete_ids jsonb not null default '[]'::jsonb;
