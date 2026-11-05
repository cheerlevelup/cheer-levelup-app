-- Blokada wpisu zawodniczki w danym ćwiczeniu treningu grupy — zablokowanego
-- wpisu nie da się edytować, a operacje zbiorcze (dodaj/usuń serię w nagłówku,
-- BW, wyczyść ćwiczenie) go pomijają.
alter table public.group_training_entries add column if not exists locked boolean not null default false;
