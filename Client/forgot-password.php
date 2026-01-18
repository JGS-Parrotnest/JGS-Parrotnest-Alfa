<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parrotnest - Reset hasła</title>
    <link rel="icon" href="logo.png" type="image/png">
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
    <div class="login-container">
        <div class="logo-area">
            <img src="logo.png" alt="Parrotnest Logo" class="logo">
            <h1>Parrotnest</h1>
        </div>
        <div class="login-card">
            <h2>Zresetuj hasło</h2>
            <p style="text-align: center; color: var(--text-muted); margin-bottom: 20px;">
                Podaj swój adres e-mail, a wyślemy Ci instrukcje resetowania hasła.
            </p>
            <form id="forgotPasswordForm">
                <div class="input-group">
                    <label for="email">Adres e-mail</label>
                    <input type="email" id="email" name="email" required placeholder="Wpisz swój e-mail">
                </div>
                <button type="submit" class="btn-primary">Wyślij link resetujący</button>
            </form>
            <div class="footer-links">
                <p>Pamiętasz hasło? <a href="login.php">Wróć do logowania</a></p>
            </div>
        </div>
    </div>
    <script src="app.js?v=3"></script>
    <script src="particles.js"></script>
</body>
</html>
