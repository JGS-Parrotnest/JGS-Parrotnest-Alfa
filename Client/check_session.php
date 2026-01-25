<?php
session_start();

function is_session_valid() {
    if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
        return false;
    }

    if (!isset($_SESSION['user_agent'])) {
        return false;
    }

    // Weryfikacja "obrazu komputera" (User-Agent)
    if ($_SESSION['user_agent'] !== $_SERVER['HTTP_USER_AGENT']) {
        return false;
    }

    return true;
}

if (!is_session_valid()) {
    // Jeśli sesja jest nieprawidłowa (inny komputer, inna przeglądarka), wyloguj i przekieruj
    session_unset();
    session_destroy();
    header("Location: login.php");
    exit();
}
?>