-- ============================================================
-- ĆWICZENIA Z WARIANTAMI + TRYB INDYWIDUALNY (trening grupowy)
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- Jedno zadanie treningowe (np. „Podciąganie") może mieć kilka wariantów
-- wykonania (Podciąganie / Negatywne / z gumą). Lista wariantów na ćwiczeniu.
ALTER TABLE public.group_training_exercises
  ADD COLUMN IF NOT EXISTS variants text[] NOT NULL DEFAULT '{}';

-- Tryb indywidualny: serie/powt./tempo różnią się per zawodniczka, nagłówek
-- grupy może być pusty (to nie błąd). Analiza liczy się z danych zawodniczek.
ALTER TABLE public.group_training_exercises
  ADD COLUMN IF NOT EXISTS individual boolean NOT NULL DEFAULT false;

-- Wybrany wariant dla danej zawodniczki (jedna z wartości z variants ćwiczenia).
ALTER TABLE public.group_training_entries
  ADD COLUMN IF NOT EXISTS variant text;
