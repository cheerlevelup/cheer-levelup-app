-- ============================================================
-- Polityki RLS dla zawodniczek — zapis własnych danych
-- ============================================================

-- Wellness przed treningiem
DROP POLICY IF EXISTS "athlete_manage_wellness" ON wellness_logs;
CREATE POLICY "athlete_manage_wellness" ON wellness_logs
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

-- Feedback po treningu
DROP POLICY IF EXISTS "athlete_manage_feedback" ON post_session_feedback;
CREATE POLICY "athlete_manage_feedback" ON post_session_feedback
  FOR ALL TO authenticated
  USING     (athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK(athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()));

-- Ból / pain logs (brak athlete_id — przez workout_session_id)
DROP POLICY IF EXISTS "athlete_manage_pain" ON pain_logs;
CREATE POLICY "athlete_manage_pain" ON pain_logs
  FOR ALL TO authenticated
  USING (
    workout_session_id IN (
      SELECT id FROM workout_sessions
      WHERE athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    workout_session_id IN (
      SELECT id FROM workout_sessions
      WHERE athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid())
    )
  );

-- Fix feeling_after column type (integer → text)
ALTER TABLE post_session_feedback
  ALTER COLUMN feeling_after TYPE text USING feeling_after::text;
