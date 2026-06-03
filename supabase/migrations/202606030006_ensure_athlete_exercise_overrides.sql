-- Ensure athlete_exercise_overrides table exists with all required columns
create table if not exists athlete_exercise_overrides (
  id bigserial primary key,
  athlete_id bigint not null references athletes(id) on delete cascade,
  block_exercise_id bigint not null references workout_block_exercises(id) on delete cascade,
  sets_override integer,
  reps_override text,
  weight_override numeric,
  tempo_override text,
  coach_note_override text,
  is_substitution boolean not null default false,
  exercise_id_override integer references exercises(id),
  exercise_code_override text,
  skip boolean not null default false,
  created_at timestamptz not null default now(),
  unique (athlete_id, block_exercise_id)
);

-- Add any missing columns in case table already existed without them
alter table athlete_exercise_overrides
  add column if not exists block_exercise_id bigint references workout_block_exercises(id) on delete cascade,
  add column if not exists sets_override integer,
  add column if not exists reps_override text,
  add column if not exists weight_override numeric,
  add column if not exists tempo_override text,
  add column if not exists coach_note_override text,
  add column if not exists is_substitution boolean not null default false,
  add column if not exists exercise_id_override integer references exercises(id),
  add column if not exists exercise_code_override text,
  add column if not exists skip boolean not null default false;

alter table athlete_exercise_overrides enable row level security;

drop policy if exists coach_manage_athlete_exercise_overrides on athlete_exercise_overrides;
create policy coach_manage_athlete_exercise_overrides
  on athlete_exercise_overrides for all to authenticated
  using (auth.email() = 'cheerlevelup@gmail.com')
  with check (auth.email() = 'cheerlevelup@gmail.com');

drop policy if exists athlete_view_own_overrides on athlete_exercise_overrides;
create policy athlete_view_own_overrides
  on athlete_exercise_overrides for select
  using (athlete_id in (select id from athletes where user_id = auth.uid()));
