import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://huqbfmyjnqlrkvwqabec.supabase.co";
const SUPABASE_KEY = "sb_publishable_tCyJodFTRyEM-qXR-0BqVA_4WT1dLQq";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function listarProdutos(categoria = 'all', busca = '') {
  let query = supabase.from('kazzi_products').select('*').eq('ativo', true).order('criado_em', { ascending: false });
  
  if (categoria !== 'all') {
    query = query.eq('categoria', categoria);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  if (busca) {
    const b = busca.toLowerCase();
    return data.filter(p => p.nome.toLowerCase().includes(b) || (p.descricao && p.descricao.toLowerCase().includes(b)));
  }
  return data;
}

export async function buscarProduto(id) {
  const { data, error } = await supabase.from('kazzi_products').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listarTodos() {
  const { data, error } = await supabase.from('kazzi_products').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data;
}

export async function criarProduto(dados) {
  const { error } = await supabase.from('kazzi_products').insert([dados]);
  if (error) throw error;
}

export async function editarProduto(id, dados) {
  const { error } = await supabase.from('kazzi_products').update(dados).eq('id', id);
  if (error) throw error;
}

export async function excluirProduto(id) {
  const { error } = await supabase.from('kazzi_products').delete().eq('id', id);
  if (error) throw error;
}

export function uploadMidia(file, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
      const filePath = `produtos/${fileName}`;

      onProgress(10);
      
      const { data, error } = await supabase.storage.from('kazzi-media').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
      
      onProgress(90);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('kazzi-media').getPublicUrl(filePath);
      
      onProgress(100);
      // O admin espera { url, path } -> para storage nativo, enviaremos string tb
      resolve({ url: publicUrl, path: filePath });
    } catch (e) {
      reject(e);
    }
  });
}

export async function removerStorage(path) {
  if (!path) return;
  const { error } = await supabase.storage.from('kazzi-media').remove([path]);
  if (error) console.error("Erro ao remover storage no Supabase:", error);
}
