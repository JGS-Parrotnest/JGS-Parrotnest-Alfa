<?php
session_start();
session_unset();
session_destroy();
?>
<!DOCTYPE html>
<html lang="pl">
<head>
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
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parrotnest - Zaloguj się</title>
    <link rel="icon" href="logo.png" type="image/png">
    <link rel="stylesheet" href="style.css?v=7">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
    <div class="login-container">
        <div class="logo-area">
            <img src="logo.png" alt="Parrotnest Logo" class="logo">
            <h1>Parrotnest</h1>
        </div>
        <div class="login-card">
            <h2>Zaloguj się</h2>
            <form id="loginForm" onsubmit="event.preventDefault(); handleLogin(event);">
                <div class="input-group">
                    <label for="email">Adres e-mail</label>
                    <input type="email" id="email" name="email" required placeholder="Wpisz swój e-mail">
                </div>
                <div class="input-group">
                    <label for="password">Hasło</label>
                    <input type="password" id="password" name="password" required placeholder="Wpisz hasło">
                </div>
                <div class="options">
                    <label class="checkbox-container">
                        <input type="checkbox" name="remember">
                        <span class="checkmark"></span>
                        Zapamiętaj mnie
                    </label>
                    <a href="forgot-password.php" class="forgot-link">Nie pamiętasz hasła?</a>
                </div>
                <button type="submit" class="btn-primary">Zaloguj się</button>
            </form>
            <div class="footer-links">
                <p>Nie masz konta? <a href="/register.php">Zarejestruj się</a></p>
            </div>
        </div>
    </div>
    <script src="auth.js?v=6"></script>
    <script src="particles.js"></script>
</body>
</html>
