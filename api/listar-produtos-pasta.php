<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$pasta = __DIR__ . '/../produtos';

if (!is_dir($pasta)) {
    echo json_encode(['error' => 'Pasta produtos não encontrada', 'items' => []]);
    exit;
}

$extensoes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'];
$itens = [];

$arquivos = scandir($pasta);
foreach ($arquivos as $arquivo) {
    if ($arquivo === '.' || $arquivo === '..') continue;
    
    $caminhoCompleto = $pasta . '/' . $arquivo;
    if (!is_file($caminhoCompleto)) continue;
    
    $ext = strtolower(pathinfo($arquivo, PATHINFO_EXTENSION));
    if (!in_array($ext, $extensoes)) continue;
    
    $nome = pathinfo($arquivo, PATHINFO_FILENAME);
    $nome = str_replace(['_', '-'], ' ', $nome);
    $nome = ucwords(trim($nome));
    
    $tipo = in_array($ext, ['mp4', 'webm', 'mov']) ? 'video' : 'imagem';
    
    $itens[] = [
        'arquivo' => $arquivo,
        'nome' => $nome,
        'caminho' => '/produtos/' . $arquivo,
        'tipo' => $tipo,
        'extensao' => $ext,
        'tamanho' => filesize($caminhoCompleto)
    ];
}

echo json_encode(['items' => $itens, 'total' => count($itens)]);
