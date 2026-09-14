-- Rozszerzenie grupy o pełny skład sztabu: trener główny i lista trenerów
-- asystentów (obok już istniejącego trener_name = trener motoryczny),
-- edytowalne z poziomu nagłówka grupy (GroupHero).

alter table public.groups add column if not exists head_coach_name text;
alter table public.groups add column if not exists assistant_coaches text[] not null default '{}';
