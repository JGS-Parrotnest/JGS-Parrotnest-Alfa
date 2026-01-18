# Dokumentacja Bazy Danych Parrotnest

## Tabele w bazie danych `parrotnest`

### 1. Users
Tabela przechowująca informacje o użytkownikach.

```sql
CREATE TABLE Users (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Username VARCHAR(50) NOT NULL UNIQUE,
    Email VARCHAR(100) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    AvatarUrl VARCHAR(255),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Kolumny:**
- `Id` - Unikalny identyfikator użytkownika
- `Username` - Nazwa użytkownika (unikalna)
- `Email` - Adres email (unikalny)
- `PasswordHash` - Zahashowane hasło użytkownika
- `AvatarUrl` - Opcjonalny URL do awatara użytkownika
- `CreatedAt` - Data utworzenia konta

---

### 2. Friendships
Tabela przechowująca relacje znajomości między użytkownikami.

```sql
CREATE TABLE Friendships (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    RequesterId INT NOT NULL,
    AddresseeId INT NOT NULL,
    Status ENUM('Pending', 'Accepted', 'Blocked') DEFAULT 'Pending',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (RequesterId) REFERENCES Users(Id) ON DELETE CASCADE,
    FOREIGN KEY (AddresseeId) REFERENCES Users(Id) ON DELETE CASCADE
);
```

**Kolumny:**
- `Id` - Unikalny identyfikator relacji
- `RequesterId` - ID użytkownika wysyłającego zaproszenie
- `AddresseeId` - ID użytkownika otrzymującego zaproszenie
- `Status` - Status relacji:
  - `Pending` - Oczekujące zaproszenie
  - `Accepted` - Zaakceptowane (znajomi)
  - `Blocked` - Zablokowane
- `CreatedAt` - Data utworzenia relacji

**Uwaga:** Nie można dodać samego siebie jako znajomego.

---

### 3. Messages
Tabela przechowująca wiadomości w czacie.

```sql
CREATE TABLE Messages (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    SenderId INT NOT NULL,
    ReceiverId INT NULL,
    GroupId INT NULL,
    Content TEXT,
    ImageUrl VARCHAR(500) NULL,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (SenderId) REFERENCES Users(Id) ON DELETE CASCADE,
    FOREIGN KEY (ReceiverId) REFERENCES Users(Id) ON DELETE CASCADE,
    FOREIGN KEY (GroupId) REFERENCES Groups(Id) ON DELETE CASCADE
);
```

**Kolumny:**
- `Id` - Unikalny identyfikator wiadomości
- `SenderId` - ID użytkownika wysyłającego wiadomość (wymagane)
- `ReceiverId` - ID użytkownika odbierającego (NULL dla wiadomości grupowych)
- `GroupId` - ID grupy (NULL dla wiadomości prywatnych)
- `Content` - Treść wiadomości tekstowej
- `ImageUrl` - URL do załączonego obrazu (NULL jeśli brak obrazu)
- `Timestamp` - Czas wysłania wiadomości

**Uwagi:**
- Wiadomość może być prywatna (ReceiverId) lub grupowa (GroupId)
- Wiadomość może zawierać tekst, obraz lub oba
- Jeśli oba ReceiverId i GroupId są NULL, wiadomość traktowana jest jako globalna

---

### 4. Groups
Tabela przechowująca informacje o grupach czatu.

```sql
CREATE TABLE Groups (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    OwnerId INT NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (OwnerId) REFERENCES Users(Id) ON DELETE CASCADE
);
```

**Kolumny:**
- `Id` - Unikalny identyfikator grupy
- `Name` - Nazwa grupy
- `OwnerId` - ID użytkownika będącego właścicielem grupy
- `CreatedAt` - Data utworzenia grupy

---

### 5. GroupMembers
Tabela przechowująca członków grup.

```sql
CREATE TABLE GroupMembers (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    GroupId INT NOT NULL,
    UserId INT NOT NULL,
    JoinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (GroupId) REFERENCES Groups(Id) ON DELETE CASCADE,
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    UNIQUE KEY unique_group_user (GroupId, UserId)
);
```

**Kolumny:**
- `Id` - Unikalny identyfikator członkostwa
- `GroupId` - ID grupy
- `UserId` - ID użytkownika
- `JoinedAt` - Data dołączenia do grupy

**Uwaga:** Kombinacja GroupId + UserId musi być unikalna (użytkownik nie może być dwa razy w tej samej grupie).

---

## Relacje między tabelami

```
Users (1) ──< Friendships (RequesterId)
Users (1) ──< Friendships (AddresseeId)
Users (1) ──< Messages (SenderId)
Users (1) ──< Messages (ReceiverId)
Users (1) ──< Groups (OwnerId)
Users (1) ──< GroupMembers (UserId)
Groups (1) ──< Messages (GroupId)
Groups (1) ──< GroupMembers (GroupId)
```

---

## Indeksy

Dodatkowe indeksy są automatycznie tworzone przez Entity Framework:
- `Users.Email` - UNIQUE INDEX
- `Users.Username` - UNIQUE INDEX
- `GroupMembers(GroupId, UserId)` - UNIQUE INDEX

---

## Przykładowe zapytania

### Pobranie wszystkich znajomych użytkownika
```sql
SELECT u.* FROM Users u
INNER JOIN Friendships f ON (f.AddresseeId = u.Id AND f.RequesterId = ?)
    OR (f.RequesterId = u.Id AND f.AddresseeId = ?)
WHERE f.Status = 'Accepted';
```

### Pobranie wiadomości z obrazami
```sql
SELECT * FROM Messages
WHERE ImageUrl IS NOT NULL
ORDER BY Timestamp DESC;
```

### Pobranie oczekujących zaproszeń do znajomych
```sql
SELECT f.*, u.Username as RequesterUsername 
FROM Friendships f
INNER JOIN Users u ON f.RequesterId = u.Id
WHERE f.AddresseeId = ? AND f.Status = 'Pending';
```

---

## Migracje Entity Framework

Baza danych jest automatycznie tworzona przy starcie aplikacji dzięki `EnsureCreated()` w `Program.cs`.

Jeśli potrzebujesz ręcznie utworzyć bazę danych, użyj pliku `schema.sql` znajdującego się w folderze `Server/`.

---

## Folder uploads

Aplikacja tworzy folder `wwwroot/uploads/` do przechowywania przesłanych obrazów. Upewnij się, że serwer ma uprawnienia do zapisu w tym folderze.

