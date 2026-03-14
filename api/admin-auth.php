<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$data = json_decode(file_get_contents('php://input'), true) ?? [];

$email = $data['email'] ?? '';
$password = $data['password'] ?? '';
$mode = $data['mode'] ?? 'password';

if (!$email || ($mode === 'password' && !$password)) {
    echo json_encode(['success' => false, 'error' => 'Credenciais incompletas.']);
    exit;
}

// Global allowed list
$allowedAdmins = ['moisesvvanti@gmail.com', 'kazzicompany@gmail.com'];

if ($mode === 'google') {
    if (!in_array($email, $allowedAdmins)) {
        echo json_encode(['success' => false, 'error' => 'Este e-mail não tem permissão de administrador.']);
        exit;
    }

    $token = bin2hex(random_bytes(32));
    $tokensFile = __DIR__ . '/admin_tokens.json';
    $tokens = file_exists($tokensFile) ? json_decode(file_get_contents($tokensFile), true) : [];
    if (!is_array($tokens)) $tokens = [];
    $tokens = array_values(array_filter($tokens, function($t) { return $t['expires'] > time(); }));
    $tokens[] = ['token' => $token, 'expires' => time() + 86400];
    file_put_contents($tokensFile, json_encode($tokens));

    echo json_encode(['success' => true, 'token' => $token]);
    exit;
}

$apiKey = 'AIzaSyCWfFdav3JLU7nvkYk2FAl6aXbvQ2F9jhU';
$url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" . $apiKey;

$postData = json_encode([
    'email' => $email,
    'password' => $password,
    'returnSecureToken' => true
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    // Apenas permitir admins predefinidos
    if (!in_array($email, $allowedAdmins)) {
        echo json_encode(['success' => false, 'error' => 'Acesso negado. Administrador não reconhecido.']);
        exit;
    }

    $token = bin2hex(random_bytes(32));
    
    // Armazena o token para manter a compatibilidade com o REST da aplicação Kazzi
    $tokensFile = __DIR__ . '/admin_tokens.json';
    $tokens = file_exists($tokensFile) ? json_decode(file_get_contents($tokensFile), true) : [];
    if (!is_array($tokens)) $tokens = [];
    
    $tokens = array_values(array_filter($tokens, function($t) { return $t['expires'] > time(); }));
    $tokens[] = ['token' => $token, 'expires' => time() + 86400]; // 24h
    file_put_contents($tokensFile, json_encode($tokens));
    
    echo json_encode(['success' => true, 'token' => $token]);
} else {
    $fbErr = json_decode($response, true);
    $firebaseErrorMsg = $fbErr['error']['message'] ?? '';
    
    // Check if the user is disabled
    if (strpos($firebaseErrorMsg, 'USER_DISABLED') !== false) {
        $errorMsg = 'Esta conta de administrador foi desativada.';
    } elseif (strpos($firebaseErrorMsg, 'INVALID_PASSWORD') !== false || strpos($firebaseErrorMsg, 'INVALID_LOGIN_CREDENTIALS') !== false) {
        $errorMsg = 'Senha incorreta. Verifique suas credenciais.';
    } elseif (strpos($firebaseErrorMsg, 'EMAIL_NOT_FOUND') !== false) {
        $errorMsg = 'Conta de administrador não encontrada.';
    } else {
        $errorMsg = 'Houve um problema de comunicação com o sistema de autenticação.';
    }
    
    echo json_encode(['success' => false, 'error' => $errorMsg]);
}
