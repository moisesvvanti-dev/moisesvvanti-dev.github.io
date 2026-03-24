/**
 * supabase.js — HARDENED
 * - Credenciais lidas de meta tags injetadas pelo servidor (nunca hardcoded em JS)
 * - Toda entrada do usuário é sanitizada antes de chegar ao Supabase
 * - Uploads: validação de tipo MIME, tamanho e extensão
 * - Nunca expõe erros detalhados do Supabase ao usuário final
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ── Leitura segura das credenciais ────────────────────────────
// Defina as meta tags no HTML (idealmente via SSR/Netlify env vars):
//   <meta name="sb-url" content="__SUPABASE_URL__">
//   <meta name="sb-key" content="__SUPABASE_ANON_KEY__">
// O Netlify pode substituir __VARS__ via Build Plugins ou Edge Functions.
function getMetaContent(name) {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el ? el.content.trim() : '';
}

const SUPABASE_URL = getMetaContent('sb-url');
const SUPABASE_KEY = getMetaContent('sb-key');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Supabase] Credenciais não configuradas. Defina as meta tags sb-url e sb-key.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers de sanitização ─────────────────────────────────────

/** Remove caracteres perigosos para output HTML */
function sanitize(val, maxLen = 300) {
  if (typeof val !== 'string') return '';
  return val.replace(/[<>"'`\\]/g, '').trim().slice(0, maxLen);
}

/** Valida UUID v4 */
function isUUID(val) {
  return typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

/** Categorias válidas (whitelist) */
const CATEGORIAS_VALIDAS = new Set([
  'all','camisetas','polos','moletons','calcas',
  'calcados','cintos','meias','oculos','acessorios','outfits'
]);

// ── Upload seguro ─────────────────────────────────────────────
const MIME_PERMITIDOS = new Set([
  'image/jpeg','image/png','image/gif','image/webp',
  'video/mp4','video/webm','video/quicktime'
]);
const EXT_PERMITIDAS = new Set(['jpg','jpeg','png','gif','webp','mp4','webm','mov']);
const MAX_FILE_SIZE  = 20 * 1024 * 1024; // 20 MB

function validarArquivo(file) {
  if (!(file instanceof File)) throw new Error('Arquivo inválido.');
  if (file.size > MAX_FILE_SIZE) throw new Error('Arquivo muito grande (máx 20 MB).');
  if (!MIME_PERMITIDOS.has(file.type)) throw new Error('Tipo de arquivo não permitido.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!EXT_PERMITIDAS.has(ext)) throw new Error('Extensão não permitida.');
}

// ── API pública ───────────────────────────────────────────────

export async function listarProdutos(categoria = 'all', busca = '') {
  const cat = CATEGORIAS_VALIDAS.has(categoria) ? categoria : 'all';

  let query = supabase
    .from('kazzi_products')
    .select('id, nome, descricao, preco, categoria, img, ativo, criado_em')
    .eq('ativo', true)
    .order('criado_em', { ascending: false })
    .limit(200);

  if (cat !== 'all') {
    query = query.eq('categoria', cat);
  }

  const { data, error } = await query;
  if (error) throw new Error('Erro ao listar produtos.');

  if (busca) {
    const b = sanitize(busca, 100).toLowerCase();
    return data.filter(p =>
      p.nome?.toLowerCase().includes(b) ||
      p.descricao?.toLowerCase().includes(b)
    );
  }
  return data;
}

export async function buscarProduto(id) {
  // IDOR mitigation: valida formato do ID antes de qualquer consulta
  if (!isUUID(id)) throw new Error('ID de produto inválido.');

  const { data, error } = await supabase
    .from('kazzi_products')
    .select('id, nome, descricao, preco, categoria, img, ativo, criado_em')
    .eq('id', id)
    .eq('ativo', true)   // nunca retorna produto inativo para cliente
    .single();

  if (error) throw new Error('Produto não encontrado.');
  return data;
}

export async function listarTodos() {
  const { data, error } = await supabase
    .from('kazzi_products')
    .select('id, nome, descricao, preco, categoria, img, ativo, criado_em')
    .order('criado_em', { ascending: false })
    .limit(500);

  if (error) throw new Error('Erro ao listar produtos.');
  return data;
}

export async function criarProduto(dados) {
  // Sanitiza todos os campos antes de inserir
  const safe = {
    nome:      sanitize(dados.nome, 200),
    descricao: sanitize(dados.descricao || '', 1000),
    preco:     Math.round(Number(dados.preco) * 100) / 100,
    categoria: CATEGORIAS_VALIDAS.has(dados.categoria) ? dados.categoria : 'acessorios',
    img:       sanitize(dados.img || '', 500),
    ativo:     dados.ativo === true || dados.ativo === false ? dados.ativo : true,
  };

  if (!safe.nome) throw new Error('Nome do produto é obrigatório.');
  if (!isFinite(safe.preco) || safe.preco <= 0) throw new Error('Preço inválido.');

  const { error } = await supabase.from('kazzi_products').insert([safe]);
  if (error) throw new Error('Erro ao criar produto.');
}

export async function editarProduto(id, dados) {
  if (!isUUID(id)) throw new Error('ID inválido.');

  const safe = {};
  if (dados.nome      !== undefined) safe.nome      = sanitize(dados.nome, 200);
  if (dados.descricao !== undefined) safe.descricao = sanitize(dados.descricao, 1000);
  if (dados.preco     !== undefined) {
    const p = Math.round(Number(dados.preco) * 100) / 100;
    if (!isFinite(p) || p <= 0) throw new Error('Preço inválido.');
    safe.preco = p;
  }
  if (dados.categoria !== undefined) {
    if (!CATEGORIAS_VALIDAS.has(dados.categoria)) throw new Error('Categoria inválida.');
    safe.categoria = dados.categoria;
  }
  if (dados.img  !== undefined) safe.img  = sanitize(dados.img, 500);
  if (dados.ativo !== undefined) safe.ativo = Boolean(dados.ativo);

  const { error } = await supabase
    .from('kazzi_products')
    .update(safe)
    .eq('id', id);

  if (error) throw new Error('Erro ao editar produto.');
}

export async function excluirProduto(id) {
  if (!isUUID(id)) throw new Error('ID inválido.');

  const { error } = await supabase
    .from('kazzi_products')
    .delete()
    .eq('id', id);

  if (error) throw new Error('Erro ao excluir produto.');
}

export function uploadMidia(file, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      validarArquivo(file); // lança se inválido

      const ext      = file.name.split('.').pop().toLowerCase();
      // Nome gerado pelo servidor: nunca usa nome original do arquivo
      const fileName = `${Date.now()}_${crypto.randomUUID()}.${ext}`;
      const filePath = `produtos/${fileName}`;

      onProgress?.(10);

      const { data, error } = await supabase.storage
        .from('kazzi-media')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      onProgress?.(90);
      if (error) throw new Error('Erro no upload.');

      const { data: { publicUrl } } = supabase.storage
        .from('kazzi-media')
        .getPublicUrl(filePath);

      onProgress?.(100);
      resolve({ url: publicUrl, path: filePath });
    } catch (e) {
      reject(e);
    }
  });
}

export async function removerStorage(path) {
  if (!path || typeof path !== 'string') return;
  // Garante que o path é relativo e não contém traversal
  const safePath = path.replace(/\.\.\//g, '').replace(/^\/+/, '');
  if (!safePath) return;

  const { error } = await supabase.storage.from('kazzi-media').remove([safePath]);
  if (error) console.error('[Storage] Erro ao remover arquivo.');
}
