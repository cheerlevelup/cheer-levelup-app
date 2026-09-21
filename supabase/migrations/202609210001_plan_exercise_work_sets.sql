-- Edytor planu: możliwość wpisania każdej serii osobno (powtórzenia, ciężar,
-- tempo, RIR per seria), zamiast jednej wspólnej rozpiski dla całego ćwiczenia.
-- Wzorem już istniejącej kolumny warmup_sets (serie rozgrzewkowe).

alter table public.workout_block_exercises add column if not exists work_sets jsonb;
