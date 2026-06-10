-- ============================================================
-- FIX: sesje, RLS, duplikaty
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- 1. Usuń zduplikowane niezakończone sesje (zostaw najnowszą per athlete+day)
DELETE FROM workout_sessions
WHERE id NOT IN (
  SELECT DISTINCT ON (athlete_id, workout_day_id) id
  FROM workout_sessions
  WHERE completed = false
  ORDER BY athlete_id, workout_day_id, created_at DESC
)
AND completed = false;

-- 2. Unique index — tylko jedna niezakończona sesja per (athlete, day)
DROP INDEX IF EXISTS idx_unique_active_session;
CREATE UNIQUE INDEX idx_unique_active_session
  ON workout_sessions (athlete_id, workout_day_id)
  WHERE completed = false;

-- 3. RLS — zawodniczki mogą zarządzać własnymi danymi
-- Sesje
DROP POLICY IF EXISTS "athlete_manage_sessions" ON workout_sessions;
CREATE POLICY "athlete_manage_sessions" ON workout_sessions
  FOR ALL TO authenticated
  USING     (athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK(athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()));

-- Serie (set_logs)
DROP POLICY IF EXISTS "athlete_manage_set_logs" ON set_logs;
CREATE POLICY "athlete_manage_set_logs" ON set_logs
  FOR ALL TO authenticated
  USING     (athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK(athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()));

-- Wellness
DROP POLICY IF EXISTS "athlete_manage_wellness" ON wellness_logs;
CREATE POLICY "athlete_manage_wellness" ON wellness_logs
  FOR ALL TO authenticated
  USING     (athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK(athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()));

-- Feedback po treningu
DROP POLICY IF EXISTS "athlete_manage_feedback" ON post_session_feedback;
CREATE POLICY "athlete_manage_feedback" ON post_session_feedback
  FOR ALL TO authenticated
  USING     (athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK(athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid()));

-- Ból
DROP POLICY IF EXISTS "athlete_manage_pain" ON pain_logs;
CREATE POLICY "athlete_manage_pain" ON pain_logs
  FOR ALL TO authenticated
  USING (workout_session_id IN (
    SELECT id FROM workout_sessions
    WHERE athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid())
  ))
  WITH CHECK (workout_session_id IN (
    SELECT id FROM workout_sessions
    WHERE athlete_id = (SELECT id FROM athletes WHERE user_id = auth.uid())
  ));

-- 4. Fix feeling_after (integer → text)
ALTER TABLE post_session_feedback
  ALTER COLUMN feeling_after TYPE text USING feeling_after::text;

-- 5. Feedback — unique per session (unikaj duplikatów feedbacku)
DELETE FROM post_session_feedback
WHERE id NOT IN (
  SELECT DISTINCT ON (workout_session_id) id
  FROM post_session_feedback
  ORDER BY workout_session_id, created_at DESC
);

DROP INDEX IF EXISTS idx_unique_session_feedback;
CREATE UNIQUE INDEX idx_unique_session_feedback
  ON post_session_feedback (workout_session_id);

-- 6. Wellness — unique per session
DELETE FROM wellness_logs
WHERE id NOT IN (
  SELECT DISTINCT ON (workout_session_id) id
  FROM wellness_logs
  ORDER BY workout_session_id, created_at DESC
);

DROP INDEX IF EXISTS idx_unique_session_wellness;
CREATE UNIQUE INDEX idx_unique_session_wellness
  ON wellness_logs (workout_session_id);
