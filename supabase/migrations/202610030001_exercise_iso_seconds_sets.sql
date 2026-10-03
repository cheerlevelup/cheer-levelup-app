-- Ćwiczenia izometryczne (ISO): osobny czas dla każdej serii. Element i-ty to
-- czas serii i+1 w sekundach; null (cała kolumna lub pojedynczy element) =
-- seria dziedziczy wspólny czas z iso_seconds.

alter table public.group_training_exercises add column if not exists iso_seconds_sets integer[];
