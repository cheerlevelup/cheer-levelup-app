-- Plany indywidualne zawodniczek (zakładka Plany → grupa → zawodniczka).
-- Uruchom w Supabase SQL Editor.

-- 1. Rodzaj przypisania: 'group' (plan narzucony przez grupę) lub 'individual'
--    (plan dodany tylko tej zawodniczce). Zawodniczka może mieć jednocześnie
--    aktywny plan grupowy i dowolną liczbę planów indywidualnych.
alter table public.athlete_workout_assignments
  add column if not exists assignment_type text not null default 'group';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'athlete_workout_assignments_assignment_type_check') then
    alter table public.athlete_workout_assignments
      add constraint athlete_workout_assignments_assignment_type_check
      check (assignment_type in ('group', 'individual'));
  end if;
end $$;

-- 2. Plan utworzony dla jednej zawodniczki (null = plan ogólny lub plan grupy).
--    Takie plany nie pokazują się na liście planów ogólnych.
alter table public.workout_plans
  add column if not exists athlete_id bigint references public.athletes(id) on delete cascade;
create index if not exists workout_plans_athlete_id_idx on public.workout_plans (athlete_id);

notify pgrst, 'reload schema';
