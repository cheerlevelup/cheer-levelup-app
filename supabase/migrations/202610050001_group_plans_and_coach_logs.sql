-- Plany grup samodzielnych tworzone w zakładce Plan grupy + uzupełnianie
-- treningu przez trenera za zawodniczki.

-- 1. Plan należący do jednej grupy (null = plan ogólny z listy „Plany")
alter table public.workout_plans
  add column if not exists group_id bigint references public.groups(id) on delete set null;
create index if not exists workout_plans_group_id_idx on public.workout_plans (group_id);

-- 2. Trener może tworzyć i edytować sesje, serie i ból zawodniczek
--    (wcześniej tylko zawodniczka mogła pisać do własnych wierszy).
drop policy if exists "coach_manage_workout_sessions" on public.workout_sessions;
create policy "coach_manage_workout_sessions" on public.workout_sessions
  for all to authenticated
  using ((select auth.email()) = 'cheerlevelup@gmail.com')
  with check ((select auth.email()) = 'cheerlevelup@gmail.com');

drop policy if exists "coach_manage_set_logs" on public.set_logs;
create policy "coach_manage_set_logs" on public.set_logs
  for all to authenticated
  using ((select auth.email()) = 'cheerlevelup@gmail.com')
  with check ((select auth.email()) = 'cheerlevelup@gmail.com');

drop policy if exists "coach_manage_pain_logs" on public.pain_logs;
create policy "coach_manage_pain_logs" on public.pain_logs
  for all to authenticated
  using ((select auth.email()) = 'cheerlevelup@gmail.com')
  with check ((select auth.email()) = 'cheerlevelup@gmail.com');

notify pgrst, 'reload schema';
