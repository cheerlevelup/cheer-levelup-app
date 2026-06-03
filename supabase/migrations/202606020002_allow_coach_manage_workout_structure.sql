do $$
declare
  coach_check text := '(auth.jwt() ->> ''email'') = ''cheerlevelup@gmail.com''';
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_plans' and policyname = 'coach_manage_workout_plans'
  ) then
    execute 'create policy coach_manage_workout_plans on workout_plans for all to authenticated using (' || coach_check || ') with check (' || coach_check || ')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_weeks' and policyname = 'coach_manage_workout_weeks'
  ) then
    execute 'create policy coach_manage_workout_weeks on workout_weeks for all to authenticated using (' || coach_check || ') with check (' || coach_check || ')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_days' and policyname = 'coach_manage_workout_days'
  ) then
    execute 'create policy coach_manage_workout_days on workout_days for all to authenticated using (' || coach_check || ') with check (' || coach_check || ')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_day_blocks' and policyname = 'coach_manage_workout_day_blocks'
  ) then
    execute 'create policy coach_manage_workout_day_blocks on workout_day_blocks for all to authenticated using (' || coach_check || ') with check (' || coach_check || ')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_block_exercises' and policyname = 'coach_manage_workout_block_exercises'
  ) then
    execute 'create policy coach_manage_workout_block_exercises on workout_block_exercises for all to authenticated using (' || coach_check || ') with check (' || coach_check || ')';
  end if;
end $$;
