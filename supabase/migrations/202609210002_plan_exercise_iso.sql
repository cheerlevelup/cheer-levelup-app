-- Ćwiczenia izometryczne (ISO) w edytorze planu — ta sama koncepcja co w
-- edytorze treningu live (PIMA/HIMA), tylko na poziomie ćwiczenia w bloku
-- planu. Poszczególne serie (czas/intensywność) trzymane są w już istniejącej
-- kolumnie work_sets (jsonb) — bez zmiany schematu, tylko dodatkowe klucze
-- w tych samych obiektach JSON.

alter table public.workout_block_exercises add column if not exists iso boolean not null default false;
alter table public.workout_block_exercises add column if not exists iso_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workout_block_exercises_iso_type_check'
  ) then
    alter table public.workout_block_exercises
      add constraint workout_block_exercises_iso_type_check check (iso_type is null or iso_type in ('PIMA', 'HIMA'));
  end if;
end $$;
