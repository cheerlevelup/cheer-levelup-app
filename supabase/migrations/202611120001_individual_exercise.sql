-- Ćwiczenie indywidualne w planie: każda zawodniczka ma własne parametry
-- (serie / powtórzenia / ciężar / tempo w athlete_exercise_overrides).
alter table public.workout_block_exercises add column if not exists is_individual boolean not null default false;
notify pgrst, 'reload schema';
