-- Ćwiczenia izometryczne (ISO) w edytorze treningu — dotyczy zarówno kolumn
-- grupowych, jak i ćwiczeń w planach indywidualnych (ta sama tabela,
-- group_training_exercises, rozróżniana przez athlete_id).

alter table public.group_training_exercises add column if not exists iso boolean not null default false;
alter table public.group_training_exercises add column if not exists iso_type text;
alter table public.group_training_exercises add column if not exists iso_seconds integer;
alter table public.group_training_exercises add column if not exists iso_intensity integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'group_training_exercises_iso_type_check'
  ) then
    alter table public.group_training_exercises
      add constraint group_training_exercises_iso_type_check check (iso_type is null or iso_type in ('PIMA', 'HIMA'));
  end if;
end $$;
