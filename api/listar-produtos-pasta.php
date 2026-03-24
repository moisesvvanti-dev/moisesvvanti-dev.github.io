<?php
/**
 * listar-produtos-pasta.php — HARDENED
 * Proteções: Path traversal, CORS restrito, output escaping,
 *            evita vazar estrutura interna de diretórios
 */

declare(strict_types=1);

define('PRODUTOS_DIR', realpath(__DIR__ . '/../produtos'));
define('URL_BASE',     '/produtos/'); // URL pública relativa

const EXTENSOES_IMAGEM = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const EXTENSOES_VIDEO  = ['mp4', 'webm', 'mov'];
const EXTENSOES_TODAS  = [...EXTENSOES_IMAGEM, ...EXTENSOES_VIDEO];
const MAX_ARQUIVOS     = 500;

// ── Origens permitidas ────────────────────────────────────────
$allowedOrigins = array_filter(array_map(
    'trim',
    explode(',', getenv('ALLOWED_ORIGINS') ?: '')
));

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$corsOrigin    = 'null';

if (empty($allowedOrigins)) {
    $corsOrigin = $requestOrigin ?: 'null';
} elseif (in_array($requestOrigin, $allowedOrigins, true)) {
    $corsOrigin = $requestOrigin;
}

// ── Cabeçalhos de segurança ───────────────────────────────────
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: ' . $corsOrigin);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido.', 'items' => []]);
    exit;
}

// Valida origem
if (!empty($allowedOrigins) && !in_array($requestOrigin, $allowedOrigins, true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Origem não autorizada.', 'items' => []]);
    exit;
}

// ── Verificação da pasta ──────────────────────────────────────
if (PRODUTOS_DIR === false || !is_dir(PRODUTOS_DIR)) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno.', 'items' => []]);
    exit;
}

// ── Lista arquivos com segurança ──────────────────────────────
$arquivos = scandir(PRODUTOS_DIR);
if ($arquivos === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno.', 'items' => []]);
    exit;
}

$itens   = [];
$count   = 0;

foreach ($arquivos as $arquivo) {
    if ($arquivo === '.' || $arquivo === '..') continue;
    if ($count >= MAX_ARQUIVOS) break;

    // Rejeita qualquer arquivo com null byte
    if (str_contains($arquivo, "\0")) continue;

    $caminhoCompleto = PRODUTOS_DIR . DIRECTORY_SEPARATOR . $arquivo;

    // Path traversal: garante que está dentro da pasta
    $realPath = realpath($caminhoCompleto);
    if ($realPath === false) continue;
    if (strpos($realPath, PRODUTOS_DIR . DIRECTORY_SEPARATOR) !== 0) continue;
    if (!is_file($realPath)) continue;

    $ext = strtolower(pathinfo($arquivo, PATHINFO_EXTENSION));
    if (!in_array($ext, EXTENSOES_TODAS, true)) continue;

    // Nome humano: apenas transforma _ e - em espaço, escapa output
    $nomeSujo  = pathinfo($arquivo, PATHINFO_FILENAME);
    $nomeLimpo = ucwords(str_replace(['_', '-'], ' ', $nomeSujo));

    $tipo = in_array($ext, EXTENSOES_VIDEO, true) ? 'video' : 'imagem';

    $itens[] = [
        // Nunca expõe o caminho absoluto do servidor
        'arquivo'  => htmlspecialchars($arquivo, ENT_QUOTES, 'UTF-8'),
        'nome'     => htmlspecialchars($nomeLimpo, ENT_QUOTES, 'UTF-8'),
        'caminho'  => URL_BASE . rawurlencode($arquivo),
        'tipo'     => $tipo,
        'extensao' => $ext,
        'tamanho'  => filesize($realPath),
    ];

    $count++;
}

echo json_encode(
    ['items' => $itens, 'total' => count($itens)],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);
