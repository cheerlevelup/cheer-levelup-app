-- Komentarz trenera do ćwiczenia w edytorze treningu grupy zorganizowanej
-- (pole pod przyciskami BW / Powtórzenia / Indywidualnie / ISO) — także w PDF.

alter table public.group_training_exercises add column if not exists coach_comment text;
