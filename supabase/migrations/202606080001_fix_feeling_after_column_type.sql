-- Zmiana feeling_after z integer na text
-- Kolumna była integer, ale kod wysyła wartości tekstowe: 'swietnie', 'dobrze', 'srednie', 'zmeczona', 'slabo'
ALTER TABLE post_session_feedback
  ALTER COLUMN feeling_after TYPE text USING NULL;
