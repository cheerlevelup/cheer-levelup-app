-- Warianty ćwiczenia w planie (1a, 1b, 1c...): wariant to osobny wiersz
-- workout_block_exercises wskazujący na ćwiczenie bazowe (1a) w tym samym bloku.
-- variant_athlete_ids — zawodniczki wykonujące ten wariant; kto nie jest
-- przypisany do żadnego wariantu, robi ćwiczenie bazowe (nikt nie zostaje bez
-- wariantu, nikt nie robi dwóch).

alter table public.workout_block_exercises
  add column if not exists variant_of bigint references public.workout_block_exercises(id) on delete cascade;
alter table public.workout_block_exercises
  add column if not exists variant_athlete_ids bigint[];
create index if not exists workout_block_exercises_variant_of_idx on public.workout_block_exercises (variant_of);

notify pgrst, 'reload schema';
