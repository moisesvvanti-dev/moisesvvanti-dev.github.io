// ═══════════════════════════════════════
// Uber Direct — Netlify Function
// ═══════════════════════════════════════
const UBER_BASE = 'https://api.uber.com/v1';

async function getUberToken() {
  const clientId = process.env.UBER_CLIENT_ID;
  const clientSecret = process.env.UBER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('API não configurada');
  }

  const res = await fetch('https://auth.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'delivery'
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Erro ao obter token Uber');
  return data.access_token;
}

async function uberFetch(endpoint, body, token) {
  const res = await fetch(`${UBER_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.errors?.[0]?.message || 'Erro Uber API');
  return data;
}

async function uberGet(endpoint, token) {
  const res = await fetch(`${UBER_BASE}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro Uber API');
  return data;
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

    // Tenta obter token Uber
    let token;
    try {
      token = await getUberToken();
    } catch(e) {
      // Se API não configurada, retorna erro para o frontend usar modo manual
      return { statusCode: 200, headers, body: JSON.stringify({
        success: false,
        needsManual: true,
        error: 'API Uber não configurada. Use o modo manual.'
      })};
    }

    switch (action) {
      case 'create_delivery': {
        const result = await uberFetch('/deliveries', {
          external_delivery_id: params.deliveryId,
          pickup: {
            address: params.pickup.address,
            location: { lat: params.pickup.lat, lng: params.pickup.lng },
            contact: { first_name: params.pickup.name || 'Kazzi Company', phone: params.pickup.phone || '' }
          },
          dropoff: {
            address: params.dropoff.address,
            location: { lat: params.dropoff.lat, lng: params.dropoff.lng },
            contact: { first_name: params.dropoff.name, phone: params.dropoff.phone }
          },
          manifest: {
            reference: params.orderId,
            items: (params.items || []).map(i => ({
              name: `${i.qty}x ${i.nome}`,
              quantity: i.qty,
              size: 'medium'
            }))
          },
          pickup_ready_dt: params.pickupTime || new Date(Date.now() + 20 * 60000).toISOString(),
          dropoff_ready_dt: params.dropoffTime || new Date(Date.now() + 60 * 60000).toISOString()
        }, token);

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, delivery: result }) };
      }

      case 'get_delivery': {
        const result = await uberGet(`/deliveries/${params.deliveryId}`, token);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, delivery: result }) };
      }

      case 'cancel_delivery': {
        const res = await fetch(`${UBER_BASE}/deliveries/${params.deliveryId}/cancel`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, delivery: data }) };
      }

      case 'get_quote': {
        const result = await uberFetch('/deliveries/quote', {
          pickup: { location: { lat: params.pickup.lat, lng: params.pickup.lng } },
          dropoff: { location: { lat: params.dropoff.lat, lng: params.dropoff.lng } }
        }, token);

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, quote: result }) };
      }

      default:
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ação inválida' }) };
    }
  } catch (e) {
    console.error('[UBER]', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
