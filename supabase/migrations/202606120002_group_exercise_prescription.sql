-- ============================================================
-- Rozpiska ćwiczenia dla całej grupy (nagłówek kolumny tabeli):
-- liczba serii, powtórzenia, tempo
-- Uruchom w Supabase SQL Editor
-- ============================================================

ALTER TABLE public.group_training_exercises
  ADD COLUMN IF NOT EXISTS sets_planned int,
  ADD COLUMN IF NOT EXISTS reps text,
  ADD COLUMN IF NOT EXISTS tempo text;
