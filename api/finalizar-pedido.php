<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['items'])) {
    echo json_encode(['success' => false, 'error' => 'Nenhum item recebido no pedido.']);
    exit;
}

$pasta = __DIR__ . '/../produtos';
$apagados = 0;
$falhas = [];

// A list of all files in the directory
$arquivosNaPasta = is_dir($pasta) ? scandir($pasta) : [];

foreach ($input['items'] as $item) {
    // We expect the image filename to be something like a path e.g. /produtos/imagem.jpg
    // or just the clean name. Let's try to find it.
    if (!empty($item['img'])) {
        $basename = basename($item['img']); // imagem.jpg
        $caminhoCompleto = $pasta . '/' . $basename;
        
        if (file_exists($caminhoCompleto) && is_file($caminhoCompleto)) {
            if (unlink($caminhoCompleto)) {
                $apagados++;
            } else {
                $falhas[] = $basename;
            }
        } else {
            // Se a imagem não for um caminho local, tentamos pelo nome e extensão
            $found = false;
            foreach ($arquivosNaPasta as $arquivo) {
                if ($arquivo === '.' || $arquivo === '..') continue;
                $nomeSujo = pathinfo($arquivo, PATHINFO_FILENAME); // ex: camiseta_preta
                $nomeLimpo = str_replace(['_', '-'], ' ', $nomeSujo);
                $nomeLimpo = ucwords(trim($nomeLimpo)); // Camiseta Preta
                
                if (strtolower($nomeLimpo) === strtolower(trim($item['nome']))) {
                    if (unlink($pasta . '/' . $arquivo)) {
                        $apagados++;
                        $found = true;
                    } else {
                        $falhas[] = $arquivo;
                    }
                    break;
                }
            }
            if (!$found) $falhas[] = $item['nome'];
        }
    }
}

echo json_encode([
    'success' => true,
    'apagados' => $apagados,
    'falhas' => $falhas
]);
