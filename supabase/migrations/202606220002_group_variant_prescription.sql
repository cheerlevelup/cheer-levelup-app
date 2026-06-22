-- ============================================================
-- WARIANT Z WŁASNĄ ROZPISKĄ (serie / powtórzenia / tempo)
-- Uruchom w Supabase SQL Editor (po 202606220001)
-- ============================================================

-- Dotychczas variants to text[] (same nazwy). Zmieniamy na jsonb — każdy wariant
-- to obiekt { name, sets, reps, tempo }, więc może mieć własną rozpiskę.
-- Konwersja zachowuje istniejące nazwy: 'Negatywne' -> { "name": "Negatywne" }.
ALTER TABLE public.group_training_exercises
  ALTER COLUMN variants DROP DEFAULT;

ALTER TABLE public.group_training_exercises
  ALTER COLUMN variants TYPE jsonb USING (
    CASE
      WHEN variants IS NULL THEN '[]'::jsonb
      ELSE (
        SELECT coalesce(jsonb_agg(jsonb_build_object('name', v)), '[]'::jsonb)
        FROM unnest(variants) AS v
      )
    END
  );

ALTER TABLE public.group_training_exercises
  ALTER COLUMN variants SET DEFAULT '[]'::jsonb;

ALTER TABLE public.group_training_exercises
  ALTER COLUMN variants SET NOT NULL;
