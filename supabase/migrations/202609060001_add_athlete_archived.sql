-- Dodaje możliwość archiwizowania zawodniczek (bez usuwania z grupy — group_id zostaje,
-- żeby przywrócenie z archiwum odtwarzało oryginalną grupę).
alter table athletes
  add column if not exists archived boolean not null default false;

create index if not exists athletes_archived_idx on athletes(archived);
