<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$PRODUCTS_FILE = __DIR__ . '/products.json';

function loadProducts() {
    global $PRODUCTS_FILE;
    if (!file_exists($PRODUCTS_FILE)) return [];
    $data = json_decode(file_get_contents($PRODUCTS_FILE), true);
    return is_array($data) ? $data : [];
}

function saveProducts($products) {
    global $PRODUCTS_FILE;
    file_put_contents($PRODUCTS_FILE, json_encode($products, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
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

// GET - list all products (public)
if ($method === 'GET') {
    echo json_encode(loadProducts());
    exit;
}

// All other methods require admin
if (!verifyAdmin()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Não autorizado. Faça login como admin.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

// POST - add product
if ($method === 'POST') {
    $products = loadProducts();
    $key = 'prod_' . uniqid();
    
    $product = [
        '_key' => $key,
        'name' => $data['name'] ?? 'Sem Nome',
        'price' => floatval($data['price'] ?? 0),
        'stock' => intval($data['stock'] ?? 0),
        'category' => $data['category'] ?? '',
        'description' => $data['description'] ?? '',
        'images' => $data['images'] ?? [],
        'video' => $data['video'] ?? '',
        'sizes' => $data['sizes'] ?? ['P', 'M', 'G', 'GG', 'XG'],
        'active' => $data['active'] ?? true,
        'createdAt' => date('c')
    ];
    
    $products[] = $product;
    saveProducts($products);
    
    echo json_encode(['success' => true, 'product' => $product]);
    exit;
}

// PUT - update product
if ($method === 'PUT') {
    $key = $data['_key'] ?? '';
    if (!$key) {
        echo json_encode(['success' => false, 'error' => 'Identificador do produto é necessário para esta operação.']);
        exit;
    }
    
    $products = loadProducts();
    $found = false;
    
    foreach ($products as &$p) {
        if ($p['_key'] === $key) {
            // Update only provided fields
            if (isset($data['name'])) $p['name'] = $data['name'];
            if (isset($data['price'])) $p['price'] = floatval($data['price']);
            if (isset($data['stock'])) $p['stock'] = intval($data['stock']);
            if (isset($data['category'])) $p['category'] = $data['category'];
            if (isset($data['description'])) $p['description'] = $data['description'];
            if (isset($data['images'])) $p['images'] = $data['images'];
            if (isset($data['video'])) $p['video'] = $data['video'];
            if (isset($data['sizes'])) $p['sizes'] = $data['sizes'];
            if (isset($data['active'])) $p['active'] = $data['active'];
            $p['updatedAt'] = date('c');
            $found = true;
            break;
        }
    }
    unset($p);
    
    if (!$found) {
        echo json_encode(['success' => false, 'error' => 'Não localizamos este produto em nosso sistema.']);
        exit;
    }
    
    saveProducts($products);
    echo json_encode(['success' => true]);
    exit;
}

// DELETE - remove product
if ($method === 'DELETE') {
    $key = $data['_key'] ?? '';
    if (!$key) {
        echo json_encode(['success' => false, 'error' => 'Identificador do produto é necessário para esta operação.']);
        exit;
    }
    
    $products = loadProducts();
    $products = array_values(array_filter($products, function($p) use ($key) { return $p['_key'] !== $key; }));
    saveProducts($products);
    
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Método não suportado.']);
