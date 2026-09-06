-- Usuwa zakładkę Diety wraz z jej danymi — funkcja niewykorzystywana.

-- 1) Skasuj ustawienia modułu diety (per grupa / per zawodniczka).
delete from public.group_module_config where module = 'diet';

-- 2) Ogranicz odtąd group_module_config tylko do wellness.
alter table public.group_module_config drop constraint if exists group_module_config_module_check;
alter table public.group_module_config add constraint group_module_config_module_check check (module in ('wellness'));

-- 3) Skasuj tabelę z dziennikami diety (posiłki, woda, kawa) — nieodwracalne.
drop table if exists public.diet_logs;
