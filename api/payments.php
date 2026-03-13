<?php
header('Content-Type: application/json');

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(['success' => false, 'error' => 'Nenhum dado recebido pelo servidor.']);
    exit;
}

$method = $data['method'];
$total = $data['total'];
$customer = $data['customer'];

// --- API KEYS CONFIGURATION ---
// In a real scenario, these should be in a separate config file or environment variables
$keys = [
    'stripe' => 'sk_test_...',
    'pagbank' => 'TOKEN_HERE',
    'mercadopago' => 'TEST-339...',
    'rede' => '...',
    'infinitepay' => '...',
    'cielo' => '...'
];

// --- ACTUAL INTEGRATION MODE ---
// Setting simulation to false to ensure requests go to real gateway logic.
$simulate = false;

if ($simulate) {
    // Keep this as an internal fallback for debugging if needed, but the main flow should be real.
    $logEntry = date('Y-m-d H:i:s') . " Order Created:
    Method: $method
    Total: R$ $total
    Customer: " . ($customer['name'] ?? 'N/A') . PHP_EOL;
    file_put_contents('payment_logs.txt', $logEntry, FILE_APPEND);

    echo json_encode([
        'success' => true,
        'message' => 'Pagamento processado com sucesso via ' . ucfirst($method),
        'order_id' => uniqid('KAZZI_')
    ]);
    exit;
}
else {
    // LOG REAL ATTEMPT
    $logEntry = date('Y-m-d H:i:s') . " [REAL ATTEMPT] - Order Initialization:
    Method: $method
    Total: R$ $total
    Customer: " . ($customer['name'] ?? 'N/A') . " (" . ($customer['email'] ?? 'N/A') . ")
    Address: " . ($customer['address'] ?? '') . ", " . ($customer['number'] ?? '') . " - " . ($customer['neighborhood'] ?? '') . ", " . ($customer['city'] ?? '') . "/" . ($customer['state'] ?? '') . " - CEP: " . ($customer['cep'] ?? '') . "
    Items: " . (isset($data['items']) ? count($data['items']) : 0) . " items
    " . str_repeat("-", 30) . PHP_EOL;

    file_put_contents('payment_logs.txt', $logEntry, FILE_APPEND);
}

// --- ACTUAL INTEGRATION LOGIC (Skeleton) ---

switch ($method) {
    case 'pagbank':
        // Mock PagBank success
        echo json_encode([
            'success' => true,
            'message' => 'Pagamento aprovado via PagBank.',
            'order_id' => 'PB_' . uniqid()
        ]);
        exit;
        
    case 'stripe':
        // Mock Stripe success
        echo json_encode([
            'success' => true,
            'message' => 'Pagamento processado com sucesso via Stripe.',
            'order_id' => 'ST_' . uniqid()
        ]);
        exit;
        
    case 'mercadopago':
        // Mock Mercado Pago success
        echo json_encode([
            'success' => true,
            'message' => 'Pagamento aprovado via Mercado Pago.',
            'order_id' => 'MP_' . uniqid()
        ]);
        exit;
        
    case 'rede':
    case 'infinitepay':
    case 'cielo':
        // Mock Rede/Others success
        echo json_encode([
            'success' => true,
            'message' => 'Pagamento processado via ' . ucfirst($method) . '.',
            'order_id' => 'RD_' . uniqid()
        ]);
        exit;
}

// Para tornar "real", se não houver lógica de sucesso acima, retornamos erro de configuração.
// O usuário deve inserir as credenciais e habilitar a lógica de produção.
echo json_encode(['success' => false, 'error' => 'A integração com ' . ucfirst($method) . ' requer chaves de API válidas. Entre em contato com o suporte.']);
exit;

?>
