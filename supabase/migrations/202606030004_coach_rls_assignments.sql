-- Coach może zarządzać przypisaniami planów
create policy if not exists coach_manage_athlete_workout_assignments
  on athlete_workout_assignments for all to authenticated
  using (auth.email() = 'cheerlevelup@gmail.com')
  with check (auth.email() = 'cheerlevelup@gmail.com');
