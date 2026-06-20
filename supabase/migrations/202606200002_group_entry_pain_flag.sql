-- ============================================================
-- FLAGA BÓLU (bez konieczności podawania skali VAS) W TRENINGU GRUPOWYM
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- Trener może zaznaczyć, że wystąpił ból, nawet bez wpisywania VAS.
ALTER TABLE public.group_training_entries
  ADD COLUMN IF NOT EXISTS pain boolean NOT NULL DEFAULT false;
