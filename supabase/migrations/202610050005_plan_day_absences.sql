-- Nieobecności na treningu z planu grupy samodzielnej (siatka „uzupełnij za
-- zawodniczki"): lista zawodniczek nieobecnych na danym treningu planu.

alter table public.workout_days add column if not exists absent_athlete_ids bigint[] not null default '{}';

notify pgrst, 'reload schema';
