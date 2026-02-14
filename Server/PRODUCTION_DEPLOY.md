# Wdrożenie produkcyjne (DB + API)

## Najczęstsza przyczyna 404 dla `/api/production/current` i `/api/Users/all`
Jeśli `/api/messages` i SignalR działają, a te dwa endpointy zwracają 404, to praktycznie zawsze oznacza, że na porcie 6069 działa stara binarka serwera (bez nowych kontrolerów).

## Wymagany artefakt produkcyjny
Uruchamiaj i wdrażaj binarkę z:
- `Server\\bin\\Release\\net10.0-windows\\ParrotnestServer.exe`

Nie uruchamiaj przypadkowo `ParrotnestServer.exe` z katalogu głównego repo, jeśli nie jest aktualizowany razem z buildem.

## Lokalizacja bazy danych (produkcja)
Domyślnie (gdy `PARROTNEST_DB_PATH` nie jest ustawiony) baza jest tworzona/odczytywana jako:
- `parrotnest.db` obok uruchamianej binarki (`AppDomain.CurrentDomain.BaseDirectory`)

Wymuszenie ścieżki bazy:
- `PARROTNEST_DB_PATH=C:\\ścieżka\\parrotnest.db`

Wymuszenie bazy w AppData:
- `PARROTNEST_DB_PREFER_APPDATA=1`

## Kroki wdrożenia (6069)
1. Zatrzymaj działający proces serwera na hoście produkcyjnym (port 6069).
2. Wykonaj build release:
   - `dotnet build .\\Server\\ParrotnestServer.csproj -c Release`
3. Skopiuj cały katalog:
   - `Server\\bin\\Release\\net10.0-windows\\`
   na hosta produkcyjnego (w jedno miejsce) i uruchom `ParrotnestServer.exe`.
4. Upewnij się, że na hoście w tym katalogu jest `Client\\` (serwer serwuje statyki z folderu Client znalezionego względem ContentRoot; najpewniej jest trzymać repo w całości).

## Walidacja po wdrożeniu (bez zgadywania)

### 1) Identyfikacja binarki i bazy
- `GET /api/diag/build`
  - zwraca `AssemblyLastWriteUtc` oraz `DbPath` (gdzie faktycznie jest baza)

### 2) Lista routów (tylko admin)
- `GET /api/diag/routes`
  - wymaga zalogowania jako admin (Bearer token)
  - w odpowiedzi powinny być m.in.:
    - `/api/production/current`
    - `/api/Users/all`

### 3) Liczniki danych (tylko admin)
- `GET /api/diag/dbstats`
  - pokazuje ile jest rekordów w Users/Messages/Friendships/Groups/GroupMembers/ProductionContents
  - jeśli baza została usunięta, wartości typu `messages=0` są oczekiwane, dopóki ktoś nie wyśle wiadomości

## Uwaga o “0 messages / 0 sent requests”
Jeśli baza była usunięta/wyczyszczona, to API poprawnie zwróci puste listy, bo nie ma danych do zwrócenia.
Weryfikuj to przez `GET /api/diag/dbstats`.

