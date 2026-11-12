-- Seria „nie wykonana" — zaznacza zawodniczka (ekran treningu) albo trener
-- (wpisywanie wyników). Każda seria musi być zrobiona albo niewykonana, zanim
-- zawodniczka zakończy trening i wyśle raport.
alter table public.set_logs add column if not exists skipped boolean not null default false;
notify pgrst, 'reload schema';
