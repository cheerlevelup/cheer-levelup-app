-- Usunięcie funkcji "wariantów wykonania" z edytora treningu grupy
-- zorganizowanej — trenerka ręcznie wyczyściła warianty z każdego planu przed
-- tą migracją, więc kolumny można bezpiecznie usunąć.

alter table public.group_training_exercises drop column if exists variants;
alter table public.group_training_entries drop column if exists variant;
