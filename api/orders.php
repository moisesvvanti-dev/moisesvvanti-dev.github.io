<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$ORDERS_FILE = __DIR__ . '/orders.json';

function loadOrders() {
    global $ORDERS_FILE;
    if (!file_exists($ORDERS_FILE)) return [];
    $data = json_decode(file_get_contents($ORDERS_FILE), true);
    return is_array($data) ? $data : [];
}

function saveOrders($orders) {
    global $ORDERS_FILE;
    file_put_contents($ORDERS_FILE, json_encode($orders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function verifyAdmin() {
    $token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    if (!$token) return false;
    
    $tokensFile = __DIR__ . '/admin_tokens.json';
    if (!file_exists($tokensFile)) return false;
    
    $tokens = json_decode(file_get_contents($tokensFile), true);
    if (!is_array($tokens)) return false;
    
    foreach ($tokens as $t) {
        if ($t['token'] === $token && $t['expires'] > time()) return true;
    }
    return false;
}

$method = $_SERVER['REQUEST_METHOD'];

// GET - list orders (admin only)
if ($method === 'GET') {
    if (!verifyAdmin()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Não autorizado.']);
        exit;
    }
    echo json_encode(loadOrders());
    exit;
}

// POST - create order (public - from checkout)
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $orders = loadOrders();
    $key = 'order_' . uniqid();
    
    $order = [
        '_key' => $key,
        'name' => $data['name'] ?? '',
        'email' => $data['email'] ?? '',
        'cpf' => $data['cpf'] ?? '',
        'cep' => $data['cep'] ?? '',
        'address' => $data['address'] ?? '',
        'number' => $data['number'] ?? '',
        'neighborhood' => $data['neighborhood'] ?? '',
        'city' => $data['city'] ?? '',
        'state' => $data['state'] ?? '',
        'paymentMethod' => $data['paymentMethod'] ?? '',
        'total' => floatval($data['total'] ?? 0),
        'items' => $data['items'] ?? [],
        'orderId' => $data['orderId'] ?? '',
        'status' => 'pending',
        'trackingCode' => '',
        'createdAt' => date('c')
    ];
    
    $orders[] = $order;
    saveOrders($orders);
    
    echo json_encode(['success' => true, 'order' => $order]);
    exit;
}

// PUT - update order (admin only)
if ($method === 'PUT') {
    if (!verifyAdmin()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Não autorizado.']);
        exit;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $key = $data['_key'] ?? '';
    
    if (!$key) {
        echo json_encode(['success' => false, 'error' => 'É necessário informar qual pedido deseja atualizar.']);
        exit;
    }
    
    $orders = loadOrders();
    $found = false;
    
    foreach ($orders as &$o) {
        if ($o['_key'] === $key) {
            if (isset($data['status'])) $o['status'] = $data['status'];
            if (isset($data['trackingCode'])) $o['trackingCode'] = $data['trackingCode'];
            $found = true;
            break;
        }
    }
    unset($o);
    
    if (!$found) {
        echo json_encode(['success' => false, 'error' => 'O pedido solicitado não foi encontrado.']);
        exit;
    }
    
    saveOrders($orders);
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Método não suportado.']);
