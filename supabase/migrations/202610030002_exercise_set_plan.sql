-- Rozpiska per seria w edytorze treningu (tabelka serii w nagłówku ćwiczenia):
-- element i-ty = wartość serii i+1; null = seria bierze wspólną wartość
-- z reps / tempo / iso_intensity (te trzymają wartość 1. serii).

alter table public.group_training_exercises add column if not exists iso_seconds_sets integer[];
alter table public.group_training_exercises add column if not exists reps_sets text[];
alter table public.group_training_exercises add column if not exists tempo_sets text[];
alter table public.group_training_exercises add column if not exists iso_intensity_sets integer[];
