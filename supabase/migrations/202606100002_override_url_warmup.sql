-- Dodaj kolumny exercise_url_override i warmup_sets_override do athlete_exercise_overrides
ALTER TABLE athlete_exercise_overrides
  ADD COLUMN IF NOT EXISTS exercise_url_override text,
  ADD COLUMN IF NOT EXISTS warmup_sets_override jsonb;
