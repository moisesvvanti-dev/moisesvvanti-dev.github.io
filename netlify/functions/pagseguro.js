// ═══════════════════════════════════════
// PagSeguro — Netlify Function (MODERN API v4/v5)
// ═══════════════════════════════════════
const PG_WS = 'https://ws.pagseguro.uol.com.br';
const PG_API = 'https://api.pagseguro.com';

async function pgFetch(endpoint, body, method = 'POST', isModern = true, customToken = null) {
  const token = customToken || process.env.PAGSEGURO_TOKEN;
  const email = process.env.PAGSEGURO_EMAIL;

  if (!isModern) {
    const params = new URLSearchParams();
    params.append('email', email);
    params.append('token', token);
    if (body) Object.entries(body).forEach(([k, v]) => params.append(k, v));

    const res = await fetch(`${PG_WS}${endpoint}?${params.toString()}`, {
      method: method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Accept': 'application/json' }
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { code: text.match(/<code>([^<]+)<\/code>/)?.[1] || '', raw: text }; }
  } else {
    // Modern API v4/v5
    const res = await fetch(`${PG_API}${endpoint}`, {
      method: method,
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return await res.json();
  }
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
          'redirectURL': params.redirectURL || 'https://moisesvvanti-dev.github.io/',
          'notificationURL': params.notificationURL || 'https://moisesvvanti-dev.github.io/.netlify/functions/pagseguro?action=notification',
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

      case 'create_checkout': {
        // params: items: [], orderId, customer: {name, email, phone}, shipping: {cost, address}
        const pgBody = {
          reference_id: params.orderId,
          customer: {
            name: params.customer?.name || 'Cliente Kazzi',
            email: params.customer?.email || 'cliente@email.com',
            tax_id: params.customer?.cpf?.replace(/\D/g, '') || '00000000000',
            phones: [{
              country: '55',
              area: params.customer?.phone?.replace(/\D/g, '').substring(0, 2) || '47',
              number: params.customer?.phone?.replace(/\D/g, '').substring(2) || '999999999',
              type: 'MOBILE'
            }]
          },
          items: (params.items || []).map(it => ({
            reference_id: it.id || 'prod',
            name: it.nome,
            quantity: it.qty,
            unit_amount: Math.round(Number(it.preco) * 100)
          })),
          redirect_url: 'https://moisesvvanti-dev.github.io/carrinho.html?step=confirm',
          notification_urls: ['https://moisesvvanti-dev.github.io/.netlify/functions/pagseguro?action=notification']
        };

        if (params.shipping?.cost > 0) {
          pgBody.shipping = {
             address: {
               street: params.shipping.address?.street || '',
               number: params.shipping.address?.number || '',
               complement: params.shipping.address?.complement || '',
               locality: params.shipping.address?.district || '',
               city: params.shipping.address?.city || '',
               region_code: params.shipping.address?.state || '',
               country: 'BRA',
               postal_code: params.shipping.address?.zip?.replace(/\D/g, '') || ''
             }
          };
          // Shipping cost is added as an item or fee in some APIs, 
          // but in PagBank Checkouts it might be better as a separate field if available, 
          // or just an item.
          pgBody.items.push({
            reference_id: 'FRETE',
            name: 'Frete (Especial)',
            quantity: 1,
            unit_amount: Math.round(Number(params.shipping.cost) * 100)
          });
        }

        const result = await pgFetch('/checkouts', pgBody, 'POST', true, params.token);
        
        if (result.links) {
          const payLink = result.links.find(l => l.rel === 'PAY')?.href;
          return {
            statusCode: 200, headers,
            body: JSON.stringify({ success: true, paymentLink: payLink, raw: result })
          };
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: result.error_messages?.[0]?.description || 'Erro na API PagBank' }) };
      }

      case 'create_pix': {
        // Manteve compatibilidade básica com v2 se necessário, ou migramos tudo. 
        // Para simplificar, vou deixar como estava mas usando isModern=false se o usuário ainda usa Token v2 legacy.
        const result = await pgFetch('/v2/transactions', params, 'POST', false);
        return { statusCode: 200, headers, body: JSON.stringify(result) };
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
