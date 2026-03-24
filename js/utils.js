// utils.js — helpers compartilhados entre páginas

export const WHATSAPP = '5547989164910';
export const ADMIN_EMAILS = ['moisesvvanti@gmail.com', 'kazzicompany@gmail.com'];

export const STORE_ADDRESS = {
  street: 'R. Frederico Jensen, 1720',
  city: 'Blumenau',
  state: 'SC',
  zip: '89070-300',
  lat: -26.8597,
  lng: -49.1028
};

// ── Categorias e palavras-chave ────────────────────────────
export const KW = {
  calcados:   ['tenis','tênis','bota','sapato','chinelo','sandalia','sandália','sneaker','boot'],
  calcas:     ['calca','calça','jeans','shorts','bermuda','saia'],
  camisetas:  ['camis','blusa','regata','manga','tshirt'],
  polos:      ['polo','polos'],
  moletons:   ['moletom','moletons','hoodie','hoodies','jaqueta','moletinho'],
  cintos:     ['cinto','cintos','belt'],
  meias:      ['meia','meias','sock'],
  oculos:     ['oculo','óculos','sunglasses','oculos'],
  acessorios: ['bone','boné','mochila','bolsa','carteira','colar','pulseira','relogio','relógio','corrente'],
  outfits:    ['outfit','conjunto','look','kit'],
};

// Nomes de exibição das categorias
export const CAT_NAMES = {
  all: 'Todos', camisetas: 'Camisetas', polos: 'Polos', moletons: 'Moletons',
  calcas: 'Calças', calcados: 'Calçados', cintos: 'Cintos', meias: 'Meias',
  oculos: 'Óculos', acessorios: 'Acessórios', outfits: 'Outfits'
};

// ── Descrições automáticas com marca Kazzi Company ─────────
export const DESCS = {
  camisetas: [
    '{n} — camiseta oversized Kazzi Company. Tecido premium 100% algodão, estamparia exclusiva e caimento baggy autêntico. Feita no Brasil, feita pra rua.',
    '{n} — peça exclusiva da Kazzi Company. Corte diferenciado, tecido pesado de 240gsm. A camiseta que eleva qualquer look urbano.',
    '{n} — streetwear com identidade Kazzi Company. O DNA da marca em cada detalhe, da costura ao caimento oversized.',
    '{n} — oversized de qualidade real pela Kazzi Company. Modelagem ampla, gola reforçada e estamparia premium.',
  ],
  polos: [
    '{n} — polo premium Kazzi Company. Tecido piqué de alta qualidade com detalhes exclusivos. Elegância urbana autêntica.',
    '{n} — polo oversized pela Kazzi Company. Caimento perfeito, estilo baggy em peças clássicas revisitas.',
    '{n} — a polo que o streetwear precisava, pela Kazzi Company. Sofisticação com atitude de rua.',
    '{n} — polo Kazzi Company, onde o clássico encontra a cultura baggy. Qualidade e identidade em cada fio.',
  ],
  moletons: [
    '{n} — moletom oversized Kazzi Company. Fleece premium 320gsm, capuz reforçado e estamparia exclusiva. O moletom que a rua pediu.',
    '{n} — peça de frio exclusiva da Kazzi Company. Conforto máximo com estilo baggy autêntico para os dias mais gelados.',
    '{n} — moletom streetwear pela Kazzi Company. Forro macio, modelagem ampla e identidade visual que marca presença.',
    '{n} — o moletom Kazzi Company pra quando o baggy precisa de aquecimento. Felpa premium, design único.',
  ],
  calcas: [
    '{n} — calça baggy Kazzi Company. Modelagem ampla com tecido resistente, feita pra aguentar o dia a dia urbano.',
    '{n} — corte folgado pela Kazzi Company. Conforto total e estilo definido, de Blumenau pro Brasil.',
    '{n} — modelagem baggy exclusiva da Kazzi Company. Abraça o estilo, respeita o movimento da rua.',
    '{n} — calça Kazzi Company: ampla, confortável e cheia de atitude. O DNA baggy em cada costura.',
  ],
  calcados: [
    '{n} — solado robusto e design urbano, selecionado pela Kazzi Company. O calçado que combina com as ruas.',
    '{n} — acabamento premium e estilo streetwear autêntico, curadoria Kazzi Company.',
    '{n} — o tênis que o estilo baggy merecia, pela Kazzi Company. Pisada firme, presença marcante.',
    '{n} — calçado selecionado pela Kazzi Company. Conforto e estilo pra andar pela cidade com atitude.',
  ],
  cintos: [
    '{n} — cinto resistente Kazzi Company com fivela exclusiva. O detalhe que segura o look com identidade.',
    '{n} — couro premium e acabamento impecável pela Kazzi Company. Atitude nos mínimos detalhes.',
    '{n} — cinto streetwear autêntico da Kazzi Company. Completa qualquer outfit baggy com estilo.',
    '{n} — firme no estilo, firme na cintura. Acessório Kazzi Company pra finalizar o visual.',
  ],
  meias: [
    '{n} — meias premium Kazzi Company com estampa exclusiva. O conforto que o streetwear exige pros seus pés.',
    '{n} — algodão macio e design urbano pela Kazzi Company. Do pé ao estilo, detalhe que faz diferença.',
    '{n} — meias que fazem a diferença no outfit, pela Kazzi Company. Conforto e identidade em cada passo.',
    '{n} — meias Kazzi Company: qualidade premium pra quem valoriza os detalhes do streetwear.',
  ],
  oculos: [
    '{n} — óculos escuros Kazzi Company com design urbano e proteção UV. Atitude em cada olhar.',
    '{n} — armação resistente e estilo Kazzi Company. O acessório que define o look de rua.',
    '{n} — óculos streetwear autênticos pela Kazzi Company. Visão de rua, estilo de sobra.',
    '{n} — proteção e estilo pela Kazzi Company. Óculos feitos pra quem vive a cultura urbana.',
  ],
  acessorios: [
    '{n} — o detalhe que completa o outfit, pela Kazzi Company. Feito com capricho e identidade visual.',
    '{n} — acessório Kazzi Company: pequeno no tamanho, grande no impacto no seu look.',
    '{n} — acabamento premium e design exclusivo da Kazzi Company. Detalhe que eleva o streetwear.',
    '{n} — da Kazzi Company pros detalhes do seu estilo. Acessórios com DNA de rua.',
  ],
  outfits: [
    '{n} — conjunto completo Kazzi Company com identidade baggy. Vista o conjunto, viva a rua.',
    '{n} — o outfit que a cena pediu, pela Kazzi Company. Combinação perfeita de peças com DNA baggy.',
    '{n} — look completo pela Kazzi Company, zero esforço pra ficar estiloso.',
    '{n} — da cabeça aos pés com a Kazzi Company. O outfit que marca presença em qualquer role.',
  ],
  all: [
    '{n} — peça exclusiva da Kazzi Company. Qualidade e estilo únicos do streetwear brasileiro.',
    '{n} — feito com identidade e cuidado pela Kazzi Company. Streetwear autêntico.',
    '{n} — o compromisso da Kazzi Company com o streetwear de verdade. Peça com história.',
  ],
};

// ── Funções principais ─────────────────────────────────────
export function detectarCat(nome) {
  const n = nome.toLowerCase();
  for (const [cat, words] of Object.entries(KW)) {
    if (words.some(w => n.includes(w))) return cat;
  }
  return 'all';
}

export function formatarNome(filename) {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function descAuto(nome, cat) {
  const list = DESCS[cat] || DESCS.all;
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0xffffffff;
  return list[Math.abs(h) % list.length].replace(/{n}/g, nome);
}

export function fmtPreco(v) {
  if (!v || v === 0) return 'Chama no ADM';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

export function fmtInst(v) {
  if (!v || v === 0) return '';
  return `ou <b>12x</b> de <b>R$ ${(v / 12).toFixed(2).replace('.', ',')}</b> com juros`;
}

export function fmtBytes(b) {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

export function getSizes(p) {
  if (p.tamanhos?.length) return p.tamanhos;
  const cat = p.categoria || '', n = (p.nome || '').toLowerCase();
  if (cat === 'calcados' || /tenis|tênis|bota|sapato|chinelo|sandalia|sneaker|boot/.test(n))
    return ['36','37','38','39','40','41','42','43','44'];
  if (cat === 'calcas' || /calca|calça|jeans|shorts|bermuda|saia/.test(n))
    return ['36','38','40','42','44','46'];
  if (cat === 'moletons' || /moletom|moletons|hoodie/.test(n))
    return ['P','M','G','GG','XG'];
  if (cat === 'cintos' || /cinto|cintos|belt/.test(n))
    return ['P','M','G'];
  if (cat === 'meias' || /meia|meias|sock/.test(n))
    return ['Único'];
  if (cat === 'oculos' || /oculo|óculos|sunglasses/.test(n))
    return ['Único'];
  if (cat === 'acessorios' || /bone|boné|mochila|bolsa|carteira|colar|pulseira/.test(n))
    return ['Único'];
  return ['P','M','G','GG','XG'];
}

// ── Gerar link do Uber com dados pré-preenchidos ───────────
export function gerarUberLink(pickup, dropoff, items) {
  const dropoffStr = encodeURIComponent(dropoff.address);
  const pickupStr = encodeURIComponent(pickup.address);
  // Formato simplificado para o Uber
  return `https://www.uber.com/br/deliver/`;
}

// Formatar dados da entrega para copiar e colar no Uber
export function formatarDadosUber(pickup, dropoff, items) {
  const itensStr = items.map(i => `• ${i.qty}x ${i.nome}`).join('\n');
  return `═══ RETIRADA ═══
${pickup.name}
${pickup.address}
Tel: ${pickup.phone}

═══ ENTREGA ═══
${dropoff.name}
${dropoff.address}
Tel: ${dropoff.phone}

═══ ITENS ═══
${itensStr}`;
}

// ── Toast global ───────────────────────────────────────────
export function toast(msg, tipo = 'info', dur = 4000) {
  const icons = { ok: '✅', erro: '❌', info: '🔔' };
  const w = document.getElementById('toastWrap');
  if (!w) return;
  const t = document.createElement('div');
  t.className = 'toast ' + tipo;
  t.innerHTML = `<span>${icons[tipo]}</span><span>${msg}</span>`;
  w.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  const timer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, dur);
  t.onclick = () => { clearTimeout(timer); t.classList.remove('show'); setTimeout(() => t.remove(), 400); };
}

// ── Carrinho (localStorage) ────────────────────────────────
export const Cart = {
  get:   () => JSON.parse(localStorage.getItem('kzc') || '[]'),
  save:  c  => { localStorage.setItem('kzc', JSON.stringify(c)); Cart.badge(); },
  badge: () => {
    const el = document.getElementById('cartBadge');
    if (el) el.textContent = Cart.get().reduce((s, i) => s + i.qty, 0);
  },
  add(p, tam) {
    const c = Cart.get();
    const idx = c.findIndex(i => i.id === p.id && i.tam === tam);
    if (idx >= 0) c[idx].qty++;
    else c.push({ id: p.id, nome: p.nome, preco: p.preco, img: p.imagem || '', tam, qty: 1 });
    Cart.save(c);
    toast(p.nome + ' adicionado!', 'ok');
  },
  clear: () => { localStorage.removeItem('kzc'); Cart.badge(); },
};

// ── API Helper ─────────────────────────────────────────────
export async function apiCall(endpoint, body = {}) {
  const res = await fetch(`/.netlify/functions/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na API');
  return data;
}
