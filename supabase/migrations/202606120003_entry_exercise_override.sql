-- ============================================================
-- Modyfikacja ćwiczenia dla pojedynczej zawodniczki
-- (np. inna wersja ćwiczenia / zamiana tylko dla jednej osoby)
-- Uruchom w Supabase SQL Editor
-- ============================================================

ALTER TABLE public.group_training_entries
  ADD COLUMN IF NOT EXISTS exercise_override text;

NOTIFY pgrst, 'reload schema';
