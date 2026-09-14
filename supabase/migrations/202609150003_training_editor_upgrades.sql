-- Rozszerzenie edytora treningu grupy zorganizowanej (wzorowane na nowym
-- mockupie trening-live.html), bez usuwania istniejących funkcji (warianty,
-- ból VAS, tryb indywidualny per-kolumna, kolejność ćwiczeń):
--
-- 1) wykluczenie POJEDYNCZEJ zawodniczki z POJEDYNCZEGO ćwiczenia (inaczej niż
--    "nieobecna na całym treningu", która już istnieje jako absent_athlete_ids);
-- 2) zupełnie odrębne plany indywidualne — ćwiczenie przypisane do jednej
--    zawodniczki (athlete_id na group_training_exercises), pokazywane w osobnej
--    sekcji zamiast w głównej siatce grupy;
-- 3) lista zawodniczek aktualnie "wyciągniętych" do treningu indywidualnego na
--    tym treningu (chowa je z głównej siatki, tak jak absent_athlete_ids chowa
--    nieobecne — ale to inny, niezależny stan).

alter table public.group_training_entries add column if not exists excluded boolean not null default false;

alter table public.group_training_exercises add column if not exists athlete_id bigint references public.athletes(id) on delete cascade;

alter table public.group_trainings add column if not exists individual_athlete_ids integer[] not null default '{}';
