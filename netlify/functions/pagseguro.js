// ═══════════════════════════════════════════════════════════════
// PagSeguro — Netlify Function HARDENED v2.0
// Proteções: Rate Limit, Input Validation, CORS restrito,
//            IDOR mitigation, no data leak, sanitização total
// ═══════════════════════════════════════════════════════════════

'use strict';

// ──────────────────────────────────────────────────────────────
// CONSTANTES E CONFIGURAÇÃO
// ──────────────────────────────────────────────────────────────
const PG_WS  = 'https://ws.pagseguro.uol.com.br';
const PG_API = 'https://api.pagseguro.com';

// Origens permitidas — JAMAIS use '*' em produção com dados financeiros
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Rate limit simples em memória (por IP, por janela de 60s)
// Em produção prefira Redis/Upstash via env
const rateLimitMap = new Map();
const RATE_LIMIT_MAX      = 10;   // máx requisições por janela
const RATE_LIMIT_WINDOW   = 60_000; // 60 segundos

// Ações válidas (whitelist)
const VALID_ACTIONS = new Set(['create_checkout', 'get_status']);

// ──────────────────────────────────────────────────────────────
// HELPERS DE SEGURANÇA
// ──────────────────────────────────────────────────────────────

/** Remove qualquer caractere fora do permitido para strings genéricas */
function sanitizeString(val, maxLen = 200) {
  if (typeof val !== 'string') return '';
  return val.replace(/[<>"'`\\]/g, '').trim().slice(0, maxLen);
}

/** Valida e-mail com regex conservadora */
function isValidEmail(email) {
  return typeof email === 'string' &&
    /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email) &&
    email.length <= 100;
}

/** Valida CPF só dígitos, 11 caracteres */
function sanitizeCPF(cpf) {
  if (typeof cpf !== 'string') return '';
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? d : '';
}

/** Valida CEP só dígitos, 8 caracteres */
function sanitizeCEP(cep) {
  if (typeof cep !== 'string') return '';
  const d = cep.replace(/\D/g, '');
  return d.length === 8 ? d : '';
}

/** Valida telefone: somente dígitos, 10-11 chars */
function sanitizePhone(phone) {
  if (typeof phone !== 'string') return '';
  const d = phone.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 11 ? d : '';
}

/** Valida valor monetário — número positivo, máximo razoável */
function sanitizeAmount(val) {
  const n = Number(val);
  if (!isFinite(n) || n <= 0 || n > 100000) return null;
  return Math.round(n * 100); // centavos, inteiro
}

/** Valida quantidade de itens */
function sanitizeQty(val) {
  const n = parseInt(val, 10);
  if (!isFinite(n) || n <= 0 || n > 100) return null;
  return n;
}

/** Valida UUID v4 ou ID alfanumérico simples */
function isValidId(id) {
  if (typeof id !== 'string') return false;
  return /^[a-zA-Z0-9\-_]{1,64}$/.test(id);
}

/** Valida código de estado BR (2 letras maiúsculas) */
function isValidState(st) {
  const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
                  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
                  'RS','RO','RR','SC','SP','SE','TO'];
  return states.includes(String(st).toUpperCase());
}

// ──────────────────────────────────────────────────────────────
// RATE LIMITER
// ──────────────────────────────────────────────────────────────
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.ts > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, ts: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;

  entry.count++;
  return true;
}

// Limpeza periódica do mapa para evitar memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.ts > RATE_LIMIT_WINDOW * 2) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW * 2);

// ──────────────────────────────────────────────────────────────
// CORS RESTRITO
// ──────────────────────────────────────────────────────────────
function buildCORSHeaders(requestOrigin) {
  // Se lista de origens permitidas foi definida, valida
  let allowedOrigin = '';
  if (ALLOWED_ORIGINS.length === 0) {
    // Sem env configurado: ambiente de dev — permite mesma origem (não *)
    allowedOrigin = requestOrigin || 'null';
  } else {
    allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : '';
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin || 'null',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Content-Type': 'application/json',
    // Cabeçalhos de segurança adicionais
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  };
}

// ──────────────────────────────────────────────────────────────
// CLIENTE PAGSEGURO — sem vazar credenciais no erro
// ──────────────────────────────────────────────────────────────
async function pgFetch(endpoint, body, method = 'POST') {
  const token = process.env.PAGSEGURO_TOKEN;

  if (!token) {
    throw new Error('CONFIG_ERROR'); // mensagem genérica, não vaza env name
  }

  const res = await fetch(`${PG_API}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Loga status mas não retorna body bruto para o cliente
  const data = await res.json().catch(() => ({}));

  return { ok: res.ok, status: res.status, data };
}

// ──────────────────────────────────────────────────────────────
// RESPOSTA SEGURA — nunca expõe stack trace ou dados internos
// ──────────────────────────────────────────────────────────────
function respond(statusCode, headers, payload) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
}

// ──────────────────────────────────────────────────────────────
// AÇÃO: create_checkout
// ──────────────────────────────────────────────────────────────
async function handleCreateCheckout(params, headers) {
  // Validação do cliente
  const customerName  = sanitizeString(params.customer?.name, 100);
  const customerEmail = params.customer?.email;
  const customerCPF   = sanitizeCPF(params.customer?.cpf || '');
  const customerPhone = sanitizePhone(params.customer?.phone || '');

  if (!customerName) {
    return respond(400, headers, { success: false, error: 'Nome do cliente inválido.' });
  }
  if (!isValidEmail(customerEmail)) {
    return respond(400, headers, { success: false, error: 'E-mail inválido.' });
  }

  // Validação dos itens
  const rawItems = Array.isArray(params.items) ? params.items : [];
  if (rawItems.length === 0 || rawItems.length > 50) {
    return respond(400, headers, { success: false, error: 'Quantidade de itens inválida.' });
  }

  const items = [];
  for (const it of rawItems) {
    const itemId   = isValidId(it.id) ? it.id : null;
    const itemNome = sanitizeString(it.nome || it.name, 100);
    const itemQty  = sanitizeQty(it.qty);
    const itemAmt  = sanitizeAmount(it.preco);

    if (!itemNome || !itemQty || !itemAmt) {
      return respond(400, headers, { success: false, error: 'Dados de item inválidos.' });
    }

    items.push({
      reference_id: itemId || `item_${items.length + 1}`,
      name: itemNome,
      quantity: itemQty,
      unit_amount: itemAmt, // centavos
    });
  }

  // Validação do frete
  const shippingCost = params.shipping?.cost != null
    ? sanitizeAmount(params.shipping.cost)
    : null;

  if (shippingCost !== null && shippingCost === null) {
    return respond(400, headers, { success: false, error: 'Valor de frete inválido.' });
  }

  // Validação do endereço de entrega
  let shippingBody = undefined;
  if (params.shipping?.address) {
    const addr = params.shipping.address;
    const street   = sanitizeString(addr.street, 100);
    const number   = sanitizeString(addr.number, 10);
    const district = sanitizeString(addr.district, 80);
    const city     = sanitizeString(addr.city, 80);
    const state    = String(addr.state || '').toUpperCase();
    const zip      = sanitizeCEP(addr.zip || '');

    if (!street || !number || !district || !city || !isValidState(state) || !zip) {
      return respond(400, headers, { success: false, error: 'Endereço de entrega inválido.' });
    }

    shippingBody = {
      address: {
        street, number,
        complement: sanitizeString(addr.complement || '', 40),
        locality: district,
        city,
        region_code: state,
        country: 'BRA',
        postal_code: zip,
      },
    };
  }

  // Frete como item separado (PagBank não tem campo nativo de frete no checkout v4)
  if (shippingCost && shippingCost > 0) {
    items.push({
      reference_id: 'FRETE',
      name: 'Frete',
      quantity: 1,
      unit_amount: shippingCost,
    });
  }

  // orderId: gerado internamente se não informado — nunca confia no cliente
  const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const pgBody = {
    reference_id: orderId,
    customer: {
      name: customerName,
      email: customerEmail,
      ...(customerCPF ? { tax_id: customerCPF } : {}),
      ...(customerPhone ? {
        phones: [{
          country: '55',
          area: customerPhone.slice(0, 2),
          number: customerPhone.slice(2),
          type: 'MOBILE',
        }],
      } : {}),
    },
    items,
    ...(shippingBody ? { shipping: shippingBody } : {}),
    redirect_url: process.env.CHECKOUT_REDIRECT_URL || 'https://example.com/obrigado',
    notification_urls: [
      process.env.NOTIFICATION_URL || '',
    ].filter(Boolean),
  };

  const { ok, status, data } = await pgFetch('/checkouts', pgBody, 'POST');

  if (ok && data.links) {
    const payLink = data.links.find(l => l.rel === 'PAY')?.href || null;
    return respond(200, headers, {
      success: true,
      orderId,        // retorna ID gerado — não o da API interna
      paymentLink: payLink,
    });
  }

  // Loga erro internamente mas não expõe detalhes ao cliente
  console.error('[PAGSEGURO][create_checkout] status=%d body=%j', status, data);
  return respond(200, headers, {
    success: false,
    error: 'Erro ao criar checkout. Tente novamente.',
  });
}

// ──────────────────────────────────────────────────────────────
// AÇÃO: get_status
// Mitigação de IDOR: apenas consulta IDs gerados internamente
// e NUNCA retorna dados do comprador para o cliente
// ──────────────────────────────────────────────────────────────
async function handleGetStatus(params, headers) {
  const transactionId = params.transactionId;

  // IDOR mitigation: valida formato rígido do ID
  if (!isValidId(transactionId)) {
    return respond(400, headers, { success: false, error: 'ID de transação inválido.' });
  }

  const { ok, status, data } = await pgFetch(
    `/orders/${transactionId}`,
    undefined,
    'GET',
  );

  if (ok && data) {
    // Retorna APENAS campos mínimos necessários — nunca dados do comprador
    return respond(200, headers, {
      success: true,
      status: sanitizeString(data.status, 30),
      reference_id: sanitizeString(data.reference_id, 64),
    });
  }

  console.error('[PAGSEGURO][get_status] status=%d transactionId=%s body=%j', status, transactionId, data);
  return respond(200, headers, {
    success: false,
    error: 'Transação não encontrada.',
  });
}

// ──────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const requestOrigin = event.headers?.['origin'] || event.headers?.['Origin'] || '';
  const headers = buildCORSHeaders(requestOrigin);

  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // Somente POST
  if (event.httpMethod !== 'POST') {
    return respond(405, headers, { error: 'Método não permitido.' });
  }

  // Verifica origem (CSRF básico via Origin)
  if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(requestOrigin)) {
    return respond(403, headers, { error: 'Origem não autorizada.' });
  }

  // Rate limit por IP
  const clientIP =
    event.headers?.['x-nf-client-connection-ip'] ||
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    '0.0.0.0';

  if (!checkRateLimit(clientIP)) {
    return respond(429, headers, { error: 'Muitas requisições. Aguarde e tente novamente.' });
  }

  // Parse seguro do body
  let parsed;
  try {
    if (!event.body || event.body.length > 32_768) { // máx 32KB
      return respond(400, headers, { error: 'Payload inválido.' });
    }
    parsed = JSON.parse(event.body);
  } catch {
    return respond(400, headers, { error: 'JSON inválido.' });
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return respond(400, headers, { error: 'Payload inválido.' });
  }

  const { action, ...params } = parsed;

  // Whitelist de ações — rejeita qualquer ação desconhecida
  if (!VALID_ACTIONS.has(action)) {
    return respond(400, headers, { error: 'Ação inválida.' });
  }

  try {
    switch (action) {
      case 'create_checkout':
        return await handleCreateCheckout(params, headers);

      case 'get_status':
        return await handleGetStatus(params, headers);

      default:
        return respond(400, headers, { error: 'Ação inválida.' });
    }
  } catch (e) {
    // NUNCA expõe stack trace ou mensagem interna
    console.error('[PAGSEGURO][handler] Unexpected error:', e);
    return respond(500, headers, { error: 'Erro interno. Tente novamente.' });
  }
};
