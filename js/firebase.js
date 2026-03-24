// ═══════════════════════════════════════
// firebase.js — Kazzi Company
// Imagens convertidas para WebP no browser
// antes do upload pro Firebase Storage
// ═══════════════════════════════════════
import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth }
  from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, updateDoc,
  deleteDoc, getDocs, getDoc, query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import {
  getStorage, ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js';

const CFG = {
  apiKey: "AIzaSyAw-qGcdpbqe90ciz0-K29EG8CB9pxjwx0",
  authDomain: "kazzi-bef6a.firebaseapp.com",
  projectId: "kazzi-bef6a",
  storageBucket: "kazzi-bef6a.firebasestorage.app",
  messagingSenderId: "97139799441",
  appId: "1:97139799441:web:8ee0cc2d642cd3ba3d1630",
  measurementId: "G-XRX1FC3GKN"
};

const app = initializeApp(CFG);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

const COLL   = 'kazzi_products';
const MAX_W  = 900;    // largura máxima — reduzido para cortar mais
const PASS1  = 0.75;   // 1ª passagem WebP
const PASS2  = 0.55;   // 2ª passagem WebP (sobre o resultado da 1ª)

// ─── Desenha imagem no canvas e retorna blob WebP ────────
function canvasToWebP(source, w, h, quality) {
  return new Promise((resolve, reject) => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(source, 0, 0, w, h);
    cv.toBlob(b => b ? resolve(b) : reject(new Error('toBlob falhou')), 'image/webp', quality);
  });
}

// ─── Converte imagem → WebP → WebP (dupla passagem) ──────
// Vídeos são enviados diretamente sem conversão
function toWebP(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('video/')) {
      resolve({ blob: file, filename: file.name, isVideo: true });
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        // Dimensões: reduz para MAX_W mantendo proporção
        let w = img.width, h = img.height;
        if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }

        onProgress && onProgress(0.25, 'Comprimindo... passagem 1');

        // 1ª passagem: imagem → WebP (qualidade PASS1)
        const blob1 = await canvasToWebP(img, w, h, PASS1);

        onProgress && onProgress(0.55, 'Comprimindo... passagem 2');

        // 2ª passagem: WebP → WebP (qualidade PASS2)
        // Carrega o blob1 num novo Image para redesenhar no canvas
        const img2 = new Image();
        const url2 = URL.createObjectURL(blob1);
        await new Promise((res, rej) => { img2.onload = res; img2.onerror = rej; img2.src = url2; });
        URL.revokeObjectURL(url2);

        const blob2 = await canvasToWebP(img2, w, h, PASS2);

        onProgress && onProgress(0.75, 'Imagem pronta');

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const before   = file.size;
        const after    = blob2.size;
        console.log(
          `[KAZZI] ${(before/1024).toFixed(0)}KB → pass1: ${(blob1.size/1024).toFixed(0)}KB → pass2: ${(after/1024).toFixed(0)}KB (${Math.round(after/before*100)}% do original)`
        );

        resolve({ blob: blob2, filename: baseName + '.webp', isVideo: false });
      } catch(e) { reject(e); }
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao carregar imagem')); };
    img.src = url;
  });
}

// ─── Upload para o GitHub Pages ──────────────────────────────
function uploadToStorage(blob, filename, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('ghToken');
    if (!token) {
      return reject(new Error('Token do GitHub não encontrado. Faça logout e login novamente no admin com o GitHub.'));
    }

    const reader = new FileReader();
    reader.onload = async () => {
      onProgress && onProgress(0.5, 'Gerando base64...');
      const base64Content = reader.result.split(',')[1];
      
      const path = `produtos/${Date.now()}_${filename}`;
      const apiUrl = `https://api.github.com/repos/moisesvvanti-dev/moisesvvanti-dev.github.io/contents/${path}`;
      
      onProgress && onProgress(0.7, 'Enviando para o repositório...');

      try {
        const res = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `🤖 Kazzi Admin: Novo produto ${filename}`,
            content: base64Content,
            branch: 'main'
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          if (res.status === 401 || res.status === 403 || res.status === 404) {
             throw new Error('Acesso negado no GitHub. Faça logout no Painel e login novamente.');
          }
          throw new Error(errData.message || 'Erro no GitHub API');
        }

        onProgress && onProgress(1.0, 'Upload finalizado');
        
        // Link direto do GitHub Pages
        const url = `https://moisesvvanti-dev.github.io/${path}`;
        resolve({ url, path });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Falha ao processar arquivo para o GitHub'));
    reader.readAsDataURL(blob);
  });
}

// ─── Pipeline completo: converter + upload ────────────────
async function processAndUpload(file, onProgress) {
  // 1. Converte para WebP (se imagem)
  onProgress && onProgress(0.05, 'Processando imagem...');
  const { blob, filename, isVideo } = await toWebP(file, onProgress);

  // 2. Faz upload
  onProgress && onProgress(0.2, 'Enviando para o servidor...');
  const contentType = isVideo ? file.type : 'image/webp';
  const { url, path } = await uploadToStorage(blob, filename, contentType, (pct) => {
    onProgress && onProgress(0.2 + pct * 0.75, `Enviando: ${Math.round(pct*100)}%`);
  });

  return { url, path };
}

function isFirestoreOffline(err) {
  return err?.code === 'not-found' || err?.message?.includes('does not exist');
}

// ─── Listar produtos (loja pública) ──────────────────────
export async function listarProdutos(cat = 'all', busca = '') {
  let snap;
  try {
    snap = await getDocs(
      query(collection(db, COLL), where('ativo', '==', true), orderBy('criado', 'desc'))
    );
  } catch (err) {
    if (isFirestoreOffline(err)) {
      console.warn('[FIRESTORE] Database not created yet — returning empty list');
      return [];
    }
    snap = await getDocs(query(collection(db, COLL), where('ativo', '==', true)));
  }
  let lista = [];
  snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
  if (cat !== 'all') lista = lista.filter(p => p.categoria === cat);
  if (busca) {
    const b = busca.toLowerCase();
    lista = lista.filter(p =>
      (p.nome||'').toLowerCase().includes(b) ||
      (p.descricao||'').toLowerCase().includes(b)
    );
  }
  return lista;
}

// ─── Listar todos (admin) ─────────────────────────────────
export async function listarTodos() {
  let snap;
  try {
    snap = await getDocs(query(collection(db, COLL), orderBy('criado', 'desc')));
  } catch {
    snap = await getDocs(collection(db, COLL));
  }
  const lista = [];
  snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
  return lista;
}

// ─── Buscar produto por ID ────────────────────────────────
export async function buscarProduto(id) {
  const d = await getDoc(doc(db, COLL, id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

// ─── Criar produto ────────────────────────────────────────
export async function criarProduto(
  { file, nome, categoria, preco, estoque, descricao },
  onProgress
) {
  // 1. Processa (converte WebP) + upload
  const { url, path } = await processAndUpload(file, (pct, label) => {
    onProgress && onProgress(pct * 0.88, label);
  });

  // 2. Salva no Firestore
  onProgress && onProgress(0.92, 'Salvando produto...');
  const ref = await addDoc(collection(db, COLL), {
    nome, categoria, preco, estoque, descricao,
    imagem: url,
    storagePath: path,
    ativo: true,
    criado: serverTimestamp(),
  });

  onProgress && onProgress(1, 'Concluído!');
  return { id: ref.id, nome, categoria, preco, estoque, descricao, imagem: url, ativo: true };
}

// ─── Criar produto a partir de arquivo local ──────────────
export async function criarProdutoLocal(
  { imagemLocal, nome, categoria, preco, estoque, descricao, ativo }
) {
  const docData = {
    nome, categoria, preco, estoque, descricao,
    imagem: imagemLocal,
    storagePath: null,
    ativo: ativo !== false,
    criado: serverTimestamp(),
  };

  const timeout = new Promise((resolve) =>
    setTimeout(() => {
      console.warn('Timeout: Firestore não respondeu em 15s. Retornando ID temporário...');
      resolve({ id: 'temp_' + Date.now() });
    }, 15000)
  );

  const ref = await Promise.race([
    addDoc(collection(db, COLL), docData).catch(err => {
      console.error('Erro no addDoc:', err);
      return { id: 'temp_' + Date.now() };
    }),
    timeout
  ]);

  return { id: ref.id, ...docData };
}

// ─── Editar produto ───────────────────────────────────────
export async function editarProduto(id, dados, file, onProgress) {
  const campos      = { ...dados, atualizado: serverTimestamp() };
  const storagePath = campos.storagePath;
  delete campos.storagePath;

  if (file) {
    const { url, path } = await processAndUpload(file, (pct, label) => {
      onProgress && onProgress(pct * 0.88, label);
    });
    // Apaga imagem antiga (ignorando as imagens hospedadas no github)
    if (storagePath && !storagePath.startsWith('produtos/')) {
      try { await deleteObject(sRef(storage, storagePath)); } catch(_) {}
    }
    campos.imagem      = url;
    campos.storagePath = path;
  }

  onProgress && onProgress(0.95, 'Salvando...');
  await updateDoc(doc(db, COLL, id), campos);
  onProgress && onProgress(1, 'Salvo!');
}

// ─── Excluir produto ──────────────────────────────────────
export async function excluirProduto(id, storagePath) {
  await deleteDoc(doc(db, COLL, id));
  if (storagePath && !storagePath.startsWith('produtos/')) {
      try { await deleteObject(sRef(storage, storagePath)); } catch(_) {}
  }
}

// ─── Listar pedidos (admin) ───────────────────────────────
export async function listarPedidos() {
  let snap;
  try {
    snap = await getDocs(query(collection(db, 'kazzi_orders'), orderBy('criado', 'desc')));
  } catch {
    snap = await getDocs(collection(db, 'kazzi_orders'));
  }
  const lista = [];
  snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
  return lista;
}

// ─── Listar entregas (admin) ───────────────────────────────
export async function listarEntregas() {
  let snap;
  try {
    snap = await getDocs(query(collection(db, 'kazzi_deliveries'), orderBy('criado', 'desc')));
  } catch {
    snap = await getDocs(collection(db, 'kazzi_deliveries'));
  }
  const lista = [];
  snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
  return lista;
}

// ─── Buscar pedido por ID ──────────────────────────────────
export async function buscarPedido(id) {
  const d = await getDoc(doc(db, 'kazzi_orders', id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

// ─── Atualizar status do pedido ────────────────────────────
export async function atualizarStatusPedido(id, status) {
  await updateDoc(doc(db, 'kazzi_orders', id), {
    status,
    atualizado: serverTimestamp()
  });
}

// ─── Atualizar entrega ─────────────────────────────────────
export async function atualizarEntrega(id, dados) {
  await updateDoc(doc(db, 'kazzi_deliveries', id), {
    ...dados,
    atualizado: serverTimestamp()
  });
}
