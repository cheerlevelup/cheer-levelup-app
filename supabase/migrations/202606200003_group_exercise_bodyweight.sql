-- ============================================================
-- TRYB „BEZ CIĘŻARU" DLA CAŁEJ KOLUMNY (CAŁA DRUŻYNA) W TRENINGU GRUPOWYM
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- Gdy ćwiczenie jest na masie własnej dla całej grupy — w tabeli wpisujemy
-- powtórzenia zamiast kilogramów dla wszystkich zawodniczek.
ALTER TABLE public.group_training_exercises
  ADD COLUMN IF NOT EXISTS bodyweight boolean NOT NULL DEFAULT false;
