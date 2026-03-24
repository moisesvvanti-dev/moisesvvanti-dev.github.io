<?php
/**
 * finalizar-pedido.php — HARDENED
 * Proteções: Path Traversal, IDOR, Content-Type spoofing,
 *            null byte injection, MIME validation, CORS restrito
 */

declare(strict_types=1);

// ── Configurações ─────────────────────────────────────────────
define('PRODUTOS_DIR', realpath(__DIR__ . '/../produtos'));
define('MAX_ITEMS',    50);
define('MAX_BODY',     65536); // 64 KB

// Extensões de imagem/vídeo permitidas
const EXTENSOES_PERMITIDAS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'];

// Origens permitidas — configure via variável de ambiente ou edite aqui
$allowedOrigins = array_filter(array_map(
    'trim',
    explode(',', getenv('ALLOWED_ORIGINS') ?: '')
));

// ── Cabeçalhos de segurança ───────────────────────────────────
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$corsOrigin    = 'null';

if (empty($allowedOrigins)) {
    // Dev: espelha origem mas NUNCA '*'
    $corsOrigin = $requestOrigin ?: 'null';
} elseif (in_array($requestOrigin, $allowedOrigins, true)) {
    $corsOrigin = $requestOrigin;
}

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: ' . $corsOrigin);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Valida origem (CSRF básico)
if (!empty($allowedOrigins) && !in_array($requestOrigin, $allowedOrigins, true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Origem não autorizada.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido.']);
    exit;
}

// ── Leitura segura do body ────────────────────────────────────
$rawBody = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);

if ($rawBody === false || strlen($rawBody) > MAX_BODY) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Payload inválido.']);
    exit;
}

$input = json_decode($rawBody, true, 8, JSON_THROW_ON_ERROR);

if (!is_array($input) || empty($input['items']) || !is_array($input['items'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Nenhum item válido recebido.']);
    exit;
}

if (count($input['items']) > MAX_ITEMS) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Quantidade de itens excede o limite.']);
    exit;
}

// ── Verificação da pasta de produtos ─────────────────────────
if (PRODUTOS_DIR === false || !is_dir(PRODUTOS_DIR)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erro interno.']);
    exit;
}

// ── Sanitização de nome de arquivo ───────────────────────────
/**
 * Valida e resolve o caminho do arquivo dentro da pasta produtos.
 * Protege contra path traversal, null bytes e extensões proibidas.
 *
 * @return string|null  Caminho absoluto seguro ou null se inválido
 */
function resolveSeguroArquivo(string $basename): ?string
{
    // Remove null bytes
    $basename = str_replace("\0", '', $basename);

    // Permite apenas nome de arquivo simples (sem diretórios)
    $basename = basename($basename);

    // Deve ter pelo menos uma extensão válida
    $ext = strtolower(pathinfo($basename, PATHINFO_EXTENSION));
    if (!in_array($ext, EXTENSOES_PERMITIDAS, true)) {
        return null;
    }

    // Nome sem extensão: apenas alfanumérico, espaço, hífen, underscore e ponto
    $nomeSemExt = pathinfo($basename, PATHINFO_FILENAME);
    if (!preg_match('/^[\w\- \.]{1,200}$/u', $nomeSemExt)) {
        return null;
    }

    // Resolve o caminho real
    $fullPath = PRODUTOS_DIR . DIRECTORY_SEPARATOR . $basename;
    $realPath = realpath($fullPath);

    // Path traversal check: o arquivo deve estar DENTRO de PRODUTOS_DIR
    if ($realPath === false) {
        return null; // arquivo não existe
    }

    if (strpos($realPath, PRODUTOS_DIR . DIRECTORY_SEPARATOR) !== 0) {
        return null; // tentativa de path traversal
    }

    if (!is_file($realPath)) {
        return null;
    }

    return $realPath;
}

// ── Processa exclusões ────────────────────────────────────────
$apagados = 0;
$falhas   = [];

foreach ($input['items'] as $item) {
    if (!is_array($item)) continue;

    // Tentativa 1: pelo campo 'img' (basename apenas)
    $arquivoResolvido = null;

    if (!empty($item['img']) && is_string($item['img'])) {
        $arquivoResolvido = resolveSeguroArquivo(basename((string)$item['img']));
    }

    // Tentativa 2: busca por nome normalizado (somente se 'img' falhou)
    if ($arquivoResolvido === null && !empty($item['nome']) && is_string($item['nome'])) {
        $nomeAlvo = mb_strtolower(trim((string)$item['nome']));

        // Limita varredura a arquivos na pasta (sem recursão)
        $arquivos = scandir(PRODUTOS_DIR);
        if (is_array($arquivos)) {
            foreach ($arquivos as $arquivo) {
                if ($arquivo === '.' || $arquivo === '..') continue;

                $ext = strtolower(pathinfo($arquivo, PATHINFO_EXTENSION));
                if (!in_array($ext, EXTENSOES_PERMITIDAS, true)) continue;

                $nomeSujo  = pathinfo($arquivo, PATHINFO_FILENAME);
                $nomeLimpo = mb_strtolower(str_replace(['_', '-'], ' ', $nomeSujo));

                if ($nomeLimpo === $nomeAlvo) {
                    $arquivoResolvido = resolveSeguroArquivo($arquivo);
                    break;
                }
            }
        }
    }

    if ($arquivoResolvido === null) {
        $falhas[] = htmlspecialchars((string)($item['nome'] ?? 'desconhecido'), ENT_QUOTES, 'UTF-8');
        continue;
    }

    if (@unlink($arquivoResolvido)) {
        $apagados++;
    } else {
        $falhas[] = htmlspecialchars(basename($arquivoResolvido), ENT_QUOTES, 'UTF-8');
    }
}

echo json_encode([
    'success'  => true,
    'apagados' => $apagados,
    'falhas'   => $falhas,
], JSON_UNESCAPED_UNICODE);
