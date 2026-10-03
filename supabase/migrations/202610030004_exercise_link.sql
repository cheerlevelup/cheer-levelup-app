-- Link do ćwiczenia (np. film z techniką) — ikonka w edytorze treningu i w PDF.

alter table public.group_training_exercises add column if not exists link_url text;
