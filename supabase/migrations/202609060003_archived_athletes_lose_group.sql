-- Od teraz archiwizacja zawodniczki automatycznie odczepia ją od grupy
-- (przywrócenie wymaga wybrania nowej grupy w aplikacji).
-- Jednorazowe czyszczenie dla zawodniczek zarchiwizowanych zanim ta zmiana weszła.
update athletes set group_id = null where archived = true and group_id is not null;
