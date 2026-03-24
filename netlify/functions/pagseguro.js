// ═══════════════════════════════════════
// PagSeguro — Netlify Function
// ═══════════════════════════════════════
const PG_BASE = 'https://ws.pagseguro.uol.com.br';

async function pgFetch(endpoint, body) {
  const token = process.env.PAGSEGURO_TOKEN;
  const email = process.env.PAGSEGURO_EMAIL;

  if (endpoint.includes('/checkout')) {
    const params = new URLSearchParams();
    params.append('email', email);
    params.append('token', token);
    Object.entries(body).forEach(([k, v]) => params.append(k, v));

    const res = await fetch(`${PG_BASE}${endpoint}?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Accept': 'application/json' }
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { code: text.match(/<code>([^<]+)<\/code>/)?.[1] || '', raw: text }; }
  }

  const separator = endpoint.includes('?') ? '&' : '?';
  const res = await fetch(`${PG_BASE}${endpoint}${separator}email=${encodeURIComponent(email)}&token=${token}`, {
    method: endpoint.includes('/cancelling') || endpoint.includes('/refunding') ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: endpoint.includes('/cancelling') || endpoint.includes('/refunding') ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { action, ...params } = JSON.parse(event.body);

    switch (action) {
      case 'create_pix': {
        const pgBody = {
          'reference': params.orderId,
          'senderName': params.customerName,
          'senderAreaCode': params.phone?.substring(0, 2) || '47',
          'senderPhone': params.phone?.substring(2) || '',
          'senderEmail': params.customerEmail || 'cliente@email.com',
          'shippingAddressRequired': 'false',
          'currency': 'BRL',
          'redirectURL': params.redirectURL || 'https://kazzi.com.br/',
          'notificationURL': params.notificationURL || 'https://kazzi.com.br/.netlify/functions/pagseguro?action=notification',
          'extraAmount': '0.00',
          'reference': params.orderId,
        };

        (params.items || []).forEach((item, i) => {
          const idx = i + 1;
          pgBody[`itemId${idx}`] = item.id || `item${idx}`;
          pgBody[`itemDescription${idx}`] = item.nome;
          pgBody[`itemAmount${idx}`] = Number(item.preco).toFixed(2);
          pgBody[`itemQuantity${idx}`] = item.qty;
          pgBody[`itemWeight${idx}`] = '200';
        });

        if (params.shippingCost > 0) {
          const idx = (params.items?.length || 0) + 1;
          pgBody[`itemId${idx}`] = 'frete';
          pgBody[`itemDescription${idx}`] = 'Frete';
          pgBody[`itemAmount${idx}`] = Number(params.shippingCost).toFixed(2);
          pgBody[`itemQuantity${idx}`] = '1';
          pgBody[`itemWeight${idx}`] = '0';
        }

        pgBody['paymentMethod'] = 'creditCard';
        pgBody['creditCardToken'] = params.creditCardToken;
        pgBody['installmentQuantity'] = params.installments || '1';
        pgBody['installmentValue'] = params.installmentValue || pgBody[`itemAmount1`];
        pgBody['holderName'] = params.holderName || params.customerName;
        pgBody['holderCPF'] = params.holderCPF || '';
        pgBody['holderBirthDate'] = params.holderBirthDate || '01/01/1990';
        pgBody['billingAddressStreet'] = params.street || 'R. Frederico Jensen';
        pgBody['billingAddressNumber'] = params.number || '1720';
        pgBody['billingAddressComplement'] = params.complement || '';
        pgBody['billingAddressDistrict'] = params.district || 'Itoupavazinha';
        pgBody['billingAddressPostalCode'] = params.zip || '89070300';
        pgBody['billingAddressCity'] = params.city || 'Blumenau';
        pgBody['billingAddressState'] = params.state || 'SC';
        pgBody['billingAddressCountry'] = 'BRA';

        const result = await pgFetch('/v2/transactions', pgBody);

        if (result.code) {
          return {
            statusCode: 200, headers,
            body: JSON.stringify({
              success: true,
              transactionId: result.code,
              status: result.status,
              paymentLink: result.paymentLink?.paymentLink || null,
              qrCode: result.qrCode?.content || null
            })
          };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: result.errors?.[0]?.message || 'Erro PagSeguro', raw: result }) };
      }

      case 'create_boleto': {
        const pgBody = {
          'reference': params.orderId,
          'senderName': params.customerName,
          'senderAreaCode': params.phone?.substring(0, 2) || '47',
          'senderPhone': params.phone?.substring(2) || '',
          'senderEmail': params.customerEmail || 'cliente@email.com',
          'senderCPF': params.customerCPF || '',
          'shippingAddressRequired': 'false',
          'currency': 'BRL',
          'redirectURL': params.redirectURL || 'https://kazzi.com.br/',
          'notificationURL': params.notificationURL || 'https://kazzi.com.br/.netlify/functions/pagseguro?action=notification',
          'paymentMethod': 'boleto',
        };

        (params.items || []).forEach((item, i) => {
          const idx = i + 1;
          pgBody[`itemId${idx}`] = item.id || `item${idx}`;
          pgBody[`itemDescription${idx}`] = item.nome;
          pgBody[`itemAmount${idx}`] = Number(item.preco).toFixed(2);
          pgBody[`itemQuantity${idx}`] = item.qty;
        });

        if (params.shippingCost > 0) {
          const idx = (params.items?.length || 0) + 1;
          pgBody[`itemId${idx}`] = 'frete';
          pgBody[`itemDescription${idx}`] = 'Frete';
          pgBody[`itemAmount${idx}`] = Number(params.shippingCost).toFixed(2);
          pgBody[`itemQuantity${idx}`] = '1';
        }

        const result = await pgFetch('/v2/transactions', pgBody);

        if (result.code) {
          return {
            statusCode: 200, headers,
            body: JSON.stringify({
              success: true,
              transactionId: result.code,
              status: result.status,
              paymentLink: result.paymentLink?.paymentLink || null
            })
          };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: result.errors?.[0]?.message || 'Erro PagSeguro' }) };
      }

      case 'get_status': {
        const result = await pgFetch(`/v3/transactions/${params.transactionId}`);
        return {
          statusCode: 200, headers,
          body: JSON.stringify({
            success: true,
            status: result.status,
            reference: result.reference,
            grossAmount: result.grossAmount,
            date: result.date
          })
        };
      }

      default:
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ação inválida' }) };
    }
  } catch (e) {
    console.error('[PAGSEGURO]', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
