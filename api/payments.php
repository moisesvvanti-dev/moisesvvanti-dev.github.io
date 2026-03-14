<?php
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(['success' => false, 'error' => 'Nenhum dado recebido pelo servidor.']);
    exit;
}

$method = $data['method'] ?? 'unknown';
$total = $data['total'] ?? 0;
$customer = $data['customer'] ?? [];
$items = $data['items'] ?? [];

// Log the order
$logEntry = date('Y-m-d H:i:s') . " | Pedido: $method | R$ $total | Cliente: " . ($customer['name'] ?? 'N/A') . "\n";
file_put_contents(__DIR__ . '/payment_logs.txt', $logEntry, FILE_APPEND);

// Save order to orders.json
$orderId = strtoupper(substr($method, 0, 2)) . '_' . uniqid();

$ordersFile = __DIR__ . '/orders.json';
$orders = file_exists($ordersFile) ? json_decode(file_get_contents($ordersFile), true) : [];
if (!is_array($orders)) $orders = [];

$order = [
    '_key' => 'order_' . uniqid(),
    'name' => $customer['name'] ?? '',
    'email' => $customer['email'] ?? '',
    'cpf' => $customer['cpf'] ?? '',
    'cep' => $customer['cep'] ?? '',
    'address' => $customer['address'] ?? '',
    'number' => $customer['number'] ?? '',
    'neighborhood' => $customer['neighborhood'] ?? '',
    'city' => $customer['city'] ?? '',
    'state' => $customer['state'] ?? '',
    'paymentMethod' => $method,
    'total' => floatval($total),
    'items' => $items,
    'orderId' => $orderId,
    'status' => 'pending',
    'trackingCode' => '',
    'createdAt' => date('c')
];

$orders[] = $order;
file_put_contents($ordersFile, json_encode($orders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo json_encode([
    'success' => true,
    'message' => 'Pedido registrado com sucesso via ' . ucfirst($method) . '.',
    'order_id' => $orderId
]);
