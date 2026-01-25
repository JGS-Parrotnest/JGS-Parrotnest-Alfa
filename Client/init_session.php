<?php
session_start();

// Zabezpieczenie przed Session Fixation
session_regenerate_id(true);

// Przypisanie sesji do User-Agent ("obrazku komputera")
$_SESSION['user_agent'] = $_SERVER['HTTP_USER_AGENT'];
$_SESSION['logged_in'] = true;

// Opcjonalnie: Zapisz IP (choć User-Agent jest lepszy dla "obrazu komputera" przy zmiennym IP)
// $_SESSION['user_ip'] = $_SERVER['REMOTE_ADDR'];

header('Content-Type: application/json');
echo json_encode(['status' => 'success', 'message' => 'Session initialized']);
?>