<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parrotnest - Rejestracja</title>
    <link rel="icon" href="logo.png" type="image/png">
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
    <script>
        (function() {
            try {
                var t = localStorage.getItem('preferredTheme') || 'dark';
                document.documentElement.setAttribute('data-theme', t);
            } catch (e) {
                document.documentElement.setAttribute('data-theme', 'dark');
            }
        })();
    </script>
    <div class="login-container">
        <div class="logo-area">
            <img src="logo.png" alt="Parrotnest Logo" class="logo">
            <h1>Parrotnest</h1>
        </div>
        <div class="login-card">
            <h2>Utwórz konto</h2>
            <form id="registerForm" onsubmit="event.preventDefault(); handleRegister(event);">
                <div class="input-group">
                    <label for="username">Nazwa użytkownika</label>
                    <input type="text" id="username" name="username" required placeholder="Wybierz nazwę użytkownika">
                </div>
                <div class="input-group">
                    <label for="email">Adres e-mail</label>
                    <input type="email" id="email" name="email" required placeholder="Wpisz swój e-mail">
                </div>
                <div class="input-group">
                    <label for="password">Hasło</label>
                    <input type="password" id="password" name="password" required placeholder="Wpisz hasło (min. 6 znaków)">
                </div>
                <div class="input-group">
                    <label for="confirmPassword">Potwierdź hasło</label>
                    <input type="password" id="confirmPassword" name="confirmPassword" required placeholder="Powtórz hasło">
                </div>
                <button type="submit" class="btn-primary">Zarejestruj się</button>
            </form>
            <div class="footer-links">
                <p>Masz już konto? <a href="/login.php">Zaloguj się</a></p>
            </div>
        </div>
    </div>
    <script src="auth.js?v=4"></script>
    <script src="particles.js"></script>
</body>
</html>
