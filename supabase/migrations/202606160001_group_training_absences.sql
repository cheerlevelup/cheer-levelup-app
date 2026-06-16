-- ============================================================
-- NIEOBECNOŚĆ / WYKREŚLENIE ZAWODNICZKI Z TRENINGU GRUPOWEGO
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- Lista zawodniczek wykreślonych z danego treningu (nieobecne).
-- Trzymamy jako tablicę ID — trener oznacza nieobecność jednym kliknięciem,
-- a wykreślone wiersze lądują na końcu listy.
ALTER TABLE public.group_trainings
  ADD COLUMN IF NOT EXISTS absent_athlete_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
