-- Ćwiczenia ekscentryczne w planie (obok standardowych i izometrycznych):
-- w seriach (work_sets) zamiast tempa czas fazy ekscentrycznej (ecc) i hold
-- w rozciągnięciu (hold); kolumna tempo dostaje czytelny skrót „ECC 5'' · hold 3''".

alter table public.workout_block_exercises add column if not exists ecc boolean not null default false;

notify pgrst, 'reload schema';
