-- ============================================================
-- CHEER LEVELUP — polityki RLS
-- Wklej i uruchom w: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── TRENER — edycja danych ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "coach_update_groups" ON groups;
CREATE POLICY "coach_update_groups" ON groups
  FOR UPDATE TO authenticated
  USING     (auth.email() = 'cheerlevelup@gmail.com')
  WITH CHECK(auth.email() = 'cheerlevelup@gmail.com');

DROP POLICY IF EXISTS "coach_update_athletes" ON athletes;
CREATE POLICY "coach_update_athletes" ON athletes
  FOR UPDATE TO authenticated
  USING     (auth.email() = 'cheerlevelup@gmail.com')
  WITH CHECK(auth.email() = 'cheerlevelup@gmail.com');

DROP POLICY IF EXISTS "coach_manage_assignments" ON athlete_workout_assignments;
CREATE POLICY "coach_manage_assignments" ON athlete_workout_assignments
  FOR ALL TO authenticated
  USING     (auth.email() = 'cheerlevelup@gmail.com')
  WITH CHECK(auth.email() = 'cheerlevelup@gmail.com');

DROP POLICY IF EXISTS "coach_update_days" ON workout_days;
CREATE POLICY "coach_update_days" ON workout_days
  FOR UPDATE TO authenticated
  USING     (auth.email() = 'cheerlevelup@gmail.com')
  WITH CHECK(auth.email() = 'cheerlevelup@gmail.com');

-- ── ZAWODNICZKI — zapis własnych danych ──────────────────────────────────────

-- Wellness przed treningiem
DROP POLICY IF EXISTS "athlete_manage_wellness" ON wellness_logs;
CREATE POLICY "athlete_manage_wellness" ON wellness_logs
  FOR ALL TO authenticated
  USING     (athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK(athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()));

-- Ból / pain logs
DROP POLICY IF EXISTS "athlete_manage_pain" ON pain_logs;
CREATE POLICY "athlete_manage_pain" ON pain_logs
  FOR ALL TO authenticated
  USING     (athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK(athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()));

-- Feedback po treningu (RPE, samopoczucie, notatki)
DROP POLICY IF EXISTS "athlete_manage_feedback" ON post_session_feedback;
CREATE POLICY "athlete_manage_feedback" ON post_session_feedback
  FOR ALL TO authenticated
  USING     (athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK(athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()));

-- Serie treningowe (set_logs)
DROP POLICY IF EXISTS "athlete_manage_set_logs" ON set_logs;
CREATE POLICY "athlete_manage_set_logs" ON set_logs
  FOR ALL TO authenticated
  USING     (athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK(athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()));

-- Sesje treningowe
DROP POLICY IF EXISTS "athlete_manage_sessions" ON workout_sessions;
CREATE POLICY "athlete_manage_sessions" ON workout_sessions
  FOR ALL TO authenticated
  USING     (athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK(athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()));

-- ── SPRAWDZENIE ──────────────────────────────────────────────────────────────
-- Po uruchomieniu powyższego SQL możesz sprawdzić polityki:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
