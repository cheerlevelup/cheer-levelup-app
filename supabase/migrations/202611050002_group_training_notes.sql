-- Notatki trenera do całego treningu grupy (krótkie najważniejsze rzeczy) —
-- pole nad tabelą w edytorze treningu.
alter table public.group_trainings add column if not exists notes text;
notify pgrst, 'reload schema';
