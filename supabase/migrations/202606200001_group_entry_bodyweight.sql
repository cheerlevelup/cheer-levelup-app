-- ============================================================
-- TRYB „BEZ CIĘŻARU" DLA POJEDYNCZEJ ZAWODNICZKI W TRENINGU GRUPOWYM
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- Gdy ćwiczenie dla danej zawodniczki jest na masie własnej (np. zmiana
-- na „podciąganie”), w tabeli wpisujemy powtórzenia zamiast kilogramów.
ALTER TABLE public.group_training_entries
  ADD COLUMN IF NOT EXISTS bodyweight boolean NOT NULL DEFAULT false;
