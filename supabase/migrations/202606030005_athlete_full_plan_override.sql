-- Rozszerzenie override: podmiana ćwiczenia i pomijanie
alter table athlete_exercise_overrides
  add column if not exists exercise_id_override integer references exercises(id),
  add column if not exists exercise_code_override text,
  add column if not exists skip boolean not null default false;

-- Dodatkowe ćwiczenia przypisane tylko danej zawodniczce do konkretnego bloku
create table if not exists athlete_extra_exercises (
  id uuid primary key default gen_random_uuid(),
  athlete_id bigint not null references athletes(id) on delete cascade,
  block_id bigint not null references workout_day_blocks(id) on delete cascade,
  exercise_id integer references exercises(id),
  exercise_code text,
  exercise_order integer not null default 999,
  sets integer not null default 3,
  reps text,
  tempo text,
  weight_kg numeric,
  rir integer,
  coach_note text,
  created_at timestamptz not null default now()
);

alter table athlete_extra_exercises enable row level security;

drop policy if exists coach_manage_athlete_extra_exercises on athlete_extra_exercises;
create policy coach_manage_athlete_extra_exercises
  on athlete_extra_exercises for all to authenticated
  using (auth.email() = 'cheerlevelup@gmail.com')
  with check (auth.email() = 'cheerlevelup@gmail.com');

-- Zawodniczka widzi swoje dodatkowe ćwiczenia
drop policy if exists athlete_view_own_extra_exercises on athlete_extra_exercises;
create policy athlete_view_own_extra_exercises
  on athlete_extra_exercises for select
  using (athlete_id in (select id from athletes where user_id = auth.uid()));
