\# Cheer LevelUP — dokumentacja projektu



\## Stack

\- Next.js 16.2.6 (Turbopack)

\- Supabase (auth + baza danych PostgreSQL)

\- TypeScript

\- Inline styles (czcionki: Space Grotesk + Space Mono)

\- Pakiety: @supabase/supabase-js, @supabase/ssr



\## Lokalizacja projektu

C:\\Users\\urszu\\cheer-levelup-app



\## Supabase

URL: https://nizqbinjxtkwbgbodzml.supabase.co

Anon key: sb\_publishable\_4Q2S5V7\_eNLS3HP5vVv0rw\_1lB3Mcha



\## Kolory i design

\- Tło: #F0EEE9 (kremowe)

\- Główny kolor: #111 (granat/czarny)

\- Akcent: #F5C842 (żółty)

\- Styl: editorial, bez kart z zaokrąglonymi rogami, typografia jako główny element



\## Strony które istnieją

\- /login — logowanie emailem i hasłem z opcją pokazania hasła

\- /session/1 — widok treningu zawodniczki (na razie hardcoded id=1)

\- /coach — panel trenera z listą zawodniczek i formularzem dodawania



\## Co działa

\- Logowanie przez Supabase Auth (email + hasło)

\- Po zalogowaniu przekierowanie na /session/1

\- Wellness przed treningiem — modal automatyczny przy wejściu, zapis do wellness\_logs

\- Serie z ciężarami — tapnięcie serii otwiera modal, wpisanie ciężaru, zapis do set\_logs

\- Serie rozgrzewkowe odróżnione od właściwych (is\_warmup)

\- Poprzedni ciężar wyświetla się przy seriach

\- Raportowanie bólu krok po kroku (4 kroki: tak/nie, lokalizacja, VAS 0-10, podsumowanie) zapis do pain\_logs

\- Feedback po treningu z RPE 0-10 i samopoczuciem, zapis do post\_session\_feedback

\- Panel trenera /coach: lista zawodniczek, statystyki, formularz dodawania zawodniczki

\- Dodawanie zawodniczki tworzy konto Auth + rekord w tabeli athletes

\- Wylogowanie z panelu trenera



\## Tabele w Supabase (schemat public)

\- athletes: id, full\_name, birth\_year, group\_id, user\_id, created\_at

\- groups: id, name, training\_level, sort\_order (grupy: Mini, Ultra, Stars, Girls, Senior Pom, Jazz)

\- exercises: id, name, category, movement\_pattern, unilateral, default\_tempo, created\_at

\- exercise\_logs: id, session\_id, template\_exercise\_id, actual\_exercise\_id, completed, modification\_comment

\- set\_logs: id, exercise\_log\_id, set\_number, weight, reps\_completed, completed, created\_at, is\_warmup, duration\_seconds, athlete\_id

\- pain\_logs: id, exercise\_log\_id, location, vas\_score, description, created\_at

\- post\_session\_feedback: id, session\_id, athlete\_id, session\_rpe, pain\_after\_comment, general\_comment, what\_went\_well, general\_notes, feeling\_after, created\_at

\- wellness\_logs: id, athlete\_id, session\_id, sleep\_hours, energy, stress, motivationa, muscle\_sorness, readiness, comment, created\_at, sleep\_quality, mood, energy\_source, concerns

\- workout\_blocks: id, template\_id, block\_name, block\_order, description, created\_at, rounds

\- workout\_exercise\_prescriptions: (tabela przygotowana, bez logiki)

\- workout\_sessions: (tabela przygotowana, bez logiki)

\- workout\_templates: id, name, description, created\_at

\- workout\_template\_exercises: id, template\_id, block\_id, exercise\_code, exercise\_order, accessories, default\_tempo, coach\_comment, created\_at

\- athlete\_exercise\_overrides: (tabela przygotowana, bez logiki)



\## Dane testowe w bazie

\- workout\_templates: id=2, name="Plan 6 — maj"

\- workout\_blocks: id=6, template\_id=2, block\_name="Blok A", rounds=3

\- workout\_template\_exercises: 3 ćwiczenia w bloku 6 (windmill-kb, bulgarian-split-squat, podciaganie-negatywne)

\- exercises: chest press bb, TGU, RDL, Windmill KB, Bulgarian Split Squat, Podciąganie negatywne



\## RLS (Row Level Security)

Włączone na wszystkich tabelach. Polityki:

\- workout\_templates, workout\_blocks, workout\_template\_exercises, exercises: SELECT dla anon i authenticated

\- wellness\_logs, pain\_logs, set\_logs, post\_session\_feedback: SELECT i INSERT dla authenticated

\- athletes, groups: SELECT i INSERT dla authenticated



\## Konto trenera

Email: cheerlevelup@gmail.com

Hasło: Ula04300506220!



\## Konto testowe

Email: urszula.papka@gmail.com

Hasło: CheerLevelUP2026!





\---



\## PEŁNA SPECYFIKACJA — co należy zbudować



\### 1. Nowa struktura bazy danych (do wdrożenia)



Obecna struktura jest zbyt prosta. Potrzebna nowa:



workout\_plans — nadrzędny plan (np. "Plan 6 — maj")

&#x20; workout\_weeks — tygodnie w planie (dowolna liczba, nie zawsze 4)

&#x20;   workout\_days — konkretny dzień treningowy (Dzień A, Dzień B)

&#x20;     workout\_blocks — bloki (A, B, C, D)

&#x20;       workout\_block\_exercises — ćwiczenia z pełnymi parametrami



athlete\_workout\_assignments — przypisanie planu do zawodniczki lub grupy

&#x20; - plan\_id

&#x20; - athlete\_id (nullable)

&#x20; - group\_id (nullable)

&#x20; - start\_date (nullable)

&#x20; - order\_mode: 'sequential' lub 'dated'



athlete\_exercise\_overrides — indywidualne modyfikacje per zawodniczka

&#x20; - athlete\_id

&#x20; - block\_exercise\_id

&#x20; - sets\_override, reps\_override, weight\_override

&#x20; - coach\_note\_override

&#x20; - is\_substitution (czy ćwiczenie zastąpione innym)



workout\_sessions — wykonany trening

&#x20; - athlete\_id

&#x20; - workout\_day\_id

&#x20; - date\_completed

&#x20; - completed (boolean)

&#x20; - report\_sent (boolean)



\### 2. Logika przypisywania treningów

\- Zawodniczka może mieć kilka planów równolegle

\- Tryb sequential: zawodniczka widzi kolejny trening do wykonania (bez daty)

\- Tryb dated: trening przypisany do konkretnej daty

\- Zawodniczka zawsze widzi jasno "jaki trening mam teraz wykonać"

\- Jeśli opuści tydzień, wraca do niewykonanego treningu — system nie przeskakuje automatycznie



\### 3. Panel zawodniczki /athlete

Główny ekran po zalogowaniu zawodniczki. Zawiera:

\- Imię i nazwisko

\- Najbliższy trening do wykonania (najważniejszy element)

\- Szybki dostęp do historii treningów

\- Nawigacja: "Mój trening" i "Historia"



\### 4. Widok treningu /athlete/training

\- Pełny trening z wszystkimi blokami (nie tylko Blok A jak teraz)

\- Wellness przed treningiem (już działa)

\- Serie z ciężarami dla każdego ćwiczenia (już działa)

\- Poprzedni ciężar jako referecja (już działa)

\- Raportowanie bólu per ćwiczenie (już działa)

\- Po zakończeniu: feedback + automatyczny raport do trenera



\### 5. Automatyczny raport do trenera

Po kliknięciu "Zakończ trening":

1\. Zapisuje kompletne dane w bazie (workout\_sessions jako completed)

2\. Tworzy raport z wykonanego treningu

3\. Wysyła powiadomienie do panelu trenera

4\. Wysyła email na urszula.papka@gmail.com z pełnym raportem

5\. Oznacza trening jako wykonany



Email ma zawierać pełny spis: zawodniczka, data, ćwiczenia, ciężary, RPE, ból, samopoczucie.



\### 6. Historia treningów /athlete/history

\- Lista wszystkich wykonanych treningów

\- Kliknięcie w trening pokazuje szczegóły: ćwiczenia, ciężary, daty, raport



\### 7. Panel trenera — rozbudowa

Obecny /coach pokazuje tylko listę zawodniczek. Docelowo:



/coach — główny dashboard

/coach/groups — lista grup (Mini, Ultra, Stars, Girls, Senior Pom, Jazz)

/coach/groups/\[id] — zawodniczki w grupie + tabela realizacji treningów

/coach/athletes/\[id] — profil zawodniczki

/coach/athletes/\[id]/training — trening zawodniczki z możliwością edycji indywidualnej

/coach/plans — lista planów treningowych

/coach/plans/new — edytor nowego planu

/coach/plans/\[id] — edytor istniejącego planu



\### 8. Tabela realizacji treningów (lista obecności)

W /coach/groups/\[id]:

\- Wybór planu (zakładki lub dropdown)

\- Tabela: wiersze = zawodniczki, kolumny = treningi (T1, T2, T3...)

\- Statusy w komórkach: wykonany ✓, niewykonany ○, w trakcie ◑, zaległy !, raport wysłany 📋

\- Szybki podgląd — wejście w komórkę pokazuje szczegóły



\### 9. Indywidualne modyfikacje treningów

Trzy poziomy edycji:

1\. Szablon (zmiana dotyczy wszystkich)

2\. Przypisanie grupowe (zmiana dotyczy całej grupy)

3\. Override indywidualny przez athlete\_exercise\_overrides (zmiana tylko dla jednej zawodniczki)



Z poziomu /coach/athletes/\[id]/training trener może:

\- Zobaczyć trening zawodniczki

\- Kliknąć na ćwiczenie i zmodyfikować parametry TYLKO dla tej zawodniczki

\- System ostrzega: "Ta zmiana dotyczy tylko \[imię], nie zmienia szablonu"



\### 10. Edytor treningów

W /coach/plans/\[id]:

\- Tworzenie tygodni i dni treningowych

\- Dodawanie bloków i ćwiczeń

\- Ustawianie parametrów: serie, powtórzenia, tempo, ciężar, RIR, komentarz

\- Przypisywanie do grupy lub konkretnych zawodniczek

\- Tryb przypisania: sequential lub dated



\---



\## KOLEJNOŚĆ IMPLEMENTACJI



Sesja 2: Nowa struktura bazy + panel zawodniczki /athlete + routing

Sesja 3: Pełny widok treningu (wszystkie bloki) + zakończenie treningu + raport

Sesja 4: Email z raportem + historia treningów + powiadomienia w panelu trenera

Sesja 5: Tabela realizacji w panelu trenera + profile zawodniczek

Sesja 6: Indywidualne modyfikacje + edytor treningów

