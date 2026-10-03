-- Bloki ćwiczeń w edytorze treningu (A, B, C...): numer bloku kolumny ćwiczenia,
-- 0 = blok A. Litery i numeracja A1, A2... liczone w aplikacji z kolejności.

alter table public.group_training_exercises add column if not exists block_index integer not null default 0;
