-- ============================================================
-- CHEER LEVELUP — polityki RLS dla panelu trenera
-- Wklej i uruchom w: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Trener może aktualizować grupy
DROP POLICY IF EXISTS "coach_update_groups" ON groups;
CREATE POLICY "coach_update_groups" ON groups
  FOR UPDATE TO authenticated
  USING     (auth.email() = 'cheerlevelup@gmail.com')
  WITH CHECK(auth.email() = 'cheerlevelup@gmail.com');

-- 2. Trener może aktualizować zawodniczki (np. zmiana grupy)
DROP POLICY IF EXISTS "coach_update_athletes" ON athletes;
CREATE POLICY "coach_update_athletes" ON athletes
  FOR UPDATE TO authenticated
  USING     (auth.email() = 'cheerlevelup@gmail.com')
  WITH CHECK(auth.email() = 'cheerlevelup@gmail.com');

-- 3. Trener może zarządzać przypisaniami planów
DROP POLICY IF EXISTS "coach_manage_assignments" ON athlete_workout_assignments;
CREATE POLICY "coach_manage_assignments" ON athlete_workout_assignments
  FOR ALL TO authenticated
  USING     (auth.email() = 'cheerlevelup@gmail.com')
  WITH CHECK(auth.email() = 'cheerlevelup@gmail.com');

-- 4. Trener może edytować dni treningowe (coach_intro, coach_outro, coach_closing)
DROP POLICY IF EXISTS "coach_update_days" ON workout_days;
CREATE POLICY "coach_update_days" ON workout_days
  FOR UPDATE TO authenticated
  USING     (auth.email() = 'cheerlevelup@gmail.com')
  WITH CHECK(auth.email() = 'cheerlevelup@gmail.com');

-- Gotowe! Sprawdź czy działa wchodząc w panel trenera.
