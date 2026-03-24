# 🔐 Relatório de Segurança — Kazzi Company

## Vulnerabilidades Encontradas e Corrigidas

---

### 1. `netlify/functions/pagseguro.js`

| # | Vulnerabilidade | Risco | Correção |
|---|----------------|-------|----------|
| 1 | `Access-Control-Allow-Origin: '*'` em endpoint financeiro | **CRÍTICO** — permite qualquer site chamar a API com cookies do usuário | Restrito a lista de origens via `ALLOWED_ORIGINS` env var |
| 2 | Nenhuma validação de input (nome, email, preço, qty) | **ALTO** — payload malicioso pode causar erros internos, crashes ou cobranças erradas | Validação estrita: sanitizeString, isValidEmail, sanitizeAmount, sanitizeCPF, etc. |
| 3 | `action` recebida do cliente sem whitelist | **ALTO** — cliente podia inventar ações e acionar lógica inesperada | Whitelist explícita: `VALID_ACTIONS = new Set(['create_checkout','get_status'])` |
| 4 | Stack trace e `e.message` retornados ao cliente no catch | **MÉDIO** — vaza estrutura interna, paths, variáveis de ambiente | Retorna apenas `'Erro interno. Tente novamente.'` |
| 5 | `token` do PagSeguro aceito do cliente (`params.token`) | **CRÍTICO** — cliente podia injetar seu próprio token e direcionar cobranças | Token lido exclusivamente de `process.env.PAGSEGURO_TOKEN` |
| 6 | `raw: result` exposto na resposta de sucesso e erro | **MÉDIO** — vaza campos internos da API PagSeguro ao cliente | Removido; retorna apenas campos mínimos necessários |
| 7 | Nenhum rate limiting | **ALTO** — brute force, abuso de API, custos de chamadas PagSeguro | Rate limit por IP: 10 req/60s em memória (recomenda-se Upstash em prod) |
| 8 | `create_pix` duplicado no switch (bug lógico) | **MÉDIO** — segundo case nunca executado | Removido; código limpo e ação única |
| 9 | Sem validação de tamanho do body | **MÉDIO** — payload gigante pode causar OOM | Limite de 32 KB antes do `JSON.parse` |
| 10 | IDOR em `get_status`: aceita qualquer `transactionId` do cliente | **ALTO** — cliente pode consultar transações de outros usuários | Validação de formato rígida; ID gerado internamente |
| 11 | `orderId` vindo do cliente sem validação | **MÉDIO** — cliente pode forçar colisão de IDs | `orderId` gerado internamente (`order_${timestamp}_${random}`) |

---

### 2. `api/finalizar-pedido.php`

| # | Vulnerabilidade | Risco | Correção |
|---|----------------|-------|----------|
| 1 | Path Traversal via `$item['img']` | **CRÍTICO** — `../../etc/passwd` apagaria arquivos arbitrários do servidor | `realpath()` + verificação de que o path está dentro de `PRODUTOS_DIR` |
| 2 | Null byte injection (`file.php\0.jpg`) | **ALTO** — bypass de validação de extensão em PHP < 8 | `str_replace("\0", '', ...)` antes de qualquer operação |
| 3 | `Access-Control-Allow-Origin: '*'` | **ALTO** | Restrito a lista de origens configurável |
| 4 | Nenhuma validação de tipo de arquivo na exclusão | **MÉDIO** — podia apagar `.php`, `.env`, etc. | Whitelist de extensões `EXTENSOES_PERMITIDAS` verificada antes de `unlink` |
| 5 | Sem limite de itens por requisição | **MÉDIO** — DoS por varredura massiva do filesystem | `MAX_ITEMS = 50` |
| 6 | Sem limite de tamanho do body | **MÉDIO** | `MAX_BODY = 64KB` via `file_get_contents(..., 0, MAX_BODY+1)` |
| 7 | Nome do arquivo exposto sem escape no JSON de falha | **BAIXO** — XSS reflexivo se consumido sem cuidado | `htmlspecialchars(..., ENT_QUOTES, 'UTF-8')` |

---

### 3. `api/listar-produtos-pasta.php`

| # | Vulnerabilidade | Risco | Correção |
|---|----------------|-------|----------|
| 1 | Expõe `caminho` com path absoluto do servidor | **MÉDIO** — revela estrutura de diretórios | Retorna apenas URL pública relativa (`/produtos/arquivo.webp`) |
| 2 | Nome de arquivo não escapado no JSON | **BAIXO** — XSS potencial se renderizado como HTML | `htmlspecialchars` em todos os outputs de string |
| 3 | Path traversal em `scandir` (sem restrição de nível) | **MÉDIO** | `realpath()` + check de prefixo `PRODUTOS_DIR` |
| 4 | Sem limite de arquivos listados | **BAIXO** — performance/DoS | `MAX_ARQUIVOS = 500` |
| 5 | `Access-Control-Allow-Origin: '*'` | **MÉDIO** | Restrito por origem |

---

### 4. `js/supabase.js`

| # | Vulnerabilidade | Risco | Correção |
|---|----------------|-------|----------|
| 1 | **Credenciais hardcoded no JS** (`SUPABASE_URL`, `SUPABASE_KEY`) | **CRÍTICO** — qualquer pessoa inspecionando o JS tem acesso direto ao banco | Lidas de `<meta>` tags que podem ser injetadas pelo servidor/Netlify env vars |
| 2 | `buscarProduto(id)` sem validação do ID (IDOR) | **ALTO** — cliente podia iterar UUIDs e acessar produtos inativos/privados | Valida UUID v4 + filtra `ativo=true` |
| 3 | Upload aceita qualquer arquivo sem validar MIME, extensão ou tamanho | **ALTO** — upload de `.php`, scripts, executáveis | Whitelist de MIME + extensão + limite de 20 MB + nome gerado internamente |
| 4 | `removerStorage` aceita path com `../` | **ALTO** — path traversal no Storage do Supabase | Sanitização: remove `../` e `/` iniciais |
| 5 | Dados do Supabase inseridos sem sanitização (XSS stored) | **ALTO** — script injetado em `nome`/`descricao` exibido para todos usuários | `sanitize()` aplicado em todos os campos antes de `insert`/`update` |
| 6 | Categoria não validada | **MÉDIO** — injection de valores arbitrários no banco | Whitelist `CATEGORIAS_VALIDAS` |
| 7 | Sem limite de registros no `listarTodos` | **BAIXO** — pode retornar milhares de registros | `.limit(500)` adicionado |

---

### 5. `netlify.toml`

| # | Problema | Correção |
|---|---------|---------|
| 1 | Sem `Content-Security-Policy` | CSP completo adicionado (bloqueia XSS, inline scripts, framing) |
| 2 | Sem `Strict-Transport-Security` | HSTS com preload adicionado |
| 3 | Sem `Permissions-Policy` | Bloqueia acesso a câmera, microfone, geolocalização e payment APIs |
| 4 | `supabase_setup.sql` e `netlify.toml` acessíveis publicamente | Redirects 404 adicionados para arquivos sensíveis |

---

## Configuração Necessária em Produção

### Variáveis de Ambiente (Netlify Dashboard → Site Settings → Environment)

```env
# PagSeguro
PAGSEGURO_TOKEN=seu_token_pagseguro_aqui

# Origens permitidas (separadas por vírgula, sem espaço)
ALLOWED_ORIGINS=https://seudominio.com,https://www.seudominio.com

# URLs de redirect e notificação do PagSeguro
CHECKOUT_REDIRECT_URL=https://seudominio.com/obrigado
NOTIFICATION_URL=https://seudominio.netlify.app/.netlify/functions/pagseguro
```

### Meta Tags no HTML (para credenciais do Supabase)

Adicione no `<head>` de cada página que usa Supabase.
**Substitua os valores via Netlify Build Plugins ou Edge Functions:**

```html
<meta name="sb-url" content="https://xxxxxxxxxxxx.supabase.co">
<meta name="sb-key" content="sua_anon_key_aqui">
```

> **Nota:** A `anon key` do Supabase é uma chave pública projetada para ser usada no frontend. Garanta que suas **RLS (Row Level Security) policies** no Supabase estejam ativas para proteger os dados.

---

## Checklist de Segurança para Deploy

- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] `ALLOWED_ORIGINS` apontando para o domínio de produção
- [ ] RLS ativada em todas as tabelas do Supabase
- [ ] `supabase_setup.sql` **deletado** do repositório (ou movido para fora do `htdocs`)
- [ ] HTTPS obrigatório (Netlify força por padrão)
- [ ] Testar CSP em https://csp-evaluator.withgoogle.com/
- [ ] Testar headers em https://securityheaders.com/
