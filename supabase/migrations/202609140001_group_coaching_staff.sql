-- Rozszerzenie grupy o pełny skład sztabu: trener główny, trener motoryczny
-- i lista trenerów asystentów, edytowalne z poziomu nagłówka grupy (GroupHero).
-- trainer_name (trener motoryczny) był już odwoływany w starym kodzie, ale
-- nigdy nie istniał jako realna kolumna — dodajemy go tu razem z resztą.

alter table public.groups add column if not exists trainer_name text;
alter table public.groups add column if not exists head_coach_name text;
alter table public.groups add column if not exists assistant_coaches text[] not null default '{}';
