-- Treningi grupy (moduł „Trening grupy") widoczne w aplikacji zawodniczki:
-- zawodniczka czyta treningi swojej grupy i ich ćwiczenia (grupowe + swoje
-- indywidualne) oraz czyta i zapisuje WŁASNE wpisy. Wpisów zablokowanych przez
-- trenera (locked) nie może zmieniać. Uprawnienia trenera bez zmian.

-- kolumna blokady (gdyby migracja 202611050001 nie była jeszcze uruchomiona)
alter table public.group_training_entries add column if not exists locked boolean not null default false;

-- Pomocnicze: id zawodniczki / grupy zalogowanego użytkownika (security definer —
-- bez zależności od polityk tabeli athletes i bez rekurencji polityk)
create or replace function public.my_athlete_ids() returns setof bigint
  language sql stable security definer set search_path = public as $$
  select id from public.athletes where user_id = auth.uid()
$$;
create or replace function public.my_group_ids() returns setof bigint
  language sql stable security definer set search_path = public as $$
  select group_id from public.athletes where user_id = auth.uid() and group_id is not null
$$;
grant execute on function public.my_athlete_ids() to authenticated;
grant execute on function public.my_group_ids() to authenticated;

-- Treningi swojej grupy
drop policy if exists "athlete_read_group_trainings" on public.group_trainings;
create policy "athlete_read_group_trainings" on public.group_trainings
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

-- Ćwiczenia tych treningów: grupowe i własne indywidualne
drop policy if exists "athlete_read_group_training_exercises" on public.group_training_exercises;
create policy "athlete_read_group_training_exercises" on public.group_training_exercises
  for select to authenticated
  using (
    training_id in (select id from public.group_trainings where group_id in (select public.my_group_ids()))
    and (athlete_id is null or athlete_id in (select public.my_athlete_ids()))
  );

-- Własne wpisy: odczyt, dodanie, zmiana (bez zablokowanych)
drop policy if exists "athlete_read_own_group_entries" on public.group_training_entries;
create policy "athlete_read_own_group_entries" on public.group_training_entries
  for select to authenticated
  using (athlete_id in (select public.my_athlete_ids()));

drop policy if exists "athlete_insert_own_group_entries" on public.group_training_entries;
create policy "athlete_insert_own_group_entries" on public.group_training_entries
  for insert to authenticated
  with check (
    athlete_id in (select public.my_athlete_ids())
    and training_id in (select id from public.group_trainings where group_id in (select public.my_group_ids()))
    and not locked
  );

drop policy if exists "athlete_update_own_group_entries" on public.group_training_entries;
create policy "athlete_update_own_group_entries" on public.group_training_entries
  for update to authenticated
  using (athlete_id in (select public.my_athlete_ids()) and not locked)
  with check (athlete_id in (select public.my_athlete_ids()) and not locked);

notify pgrst, 'reload schema';
