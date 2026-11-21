-- Data tygodnia w planie (edytor planu): tygodnie ustawiają się chronologicznie
-- według tej daty, a numer tygodnia idzie za kolejnością dat.
alter table public.workout_weeks add column if not exists start_date date;
notify pgrst, 'reload schema';
