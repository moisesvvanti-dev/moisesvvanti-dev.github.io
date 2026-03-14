/* ═══════════════════════════════════════════════════════════
   Kazzi Company — Biblioteca JS (Firebase Integrado)
   Migrado de PHP para Firebase Serverless
   ═══════════════════════════════════════════════════════════ */
import * as firebase from "./firebase-lib.js";

// ─── Categorias ───
export const CATEGORIES = [
    { id: "all", name: "Todos" },
    { id: "camisetas", name: "Camisetas" },
    { id: "calcas", name: "Calças" },
    { id: "calcados", name: "Calçados" },
    { id: "acessorios", name: "Acessórios" },
    { id: "outfits", name: "Outfits" }
];

// ─── Formatação ───
export function formatPrice(value) {
    if (!value || value === 0) return "Chama na ADM";
    return `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export function formatInstallments(value) {
    if (!value || value === 0) return "";
    return `ou <strong>12x</strong> de <strong>R$ ${(value / 12).toFixed(2).replace(".", ",")}</strong> com juros`;
}

// ─── Toast ───
const TOAST_ICONS = {
    success: "✅",
    error: "❌",
    info: "🔔",
    warning: "⚠️",
    auth: "🔐",
    network: "🌐",
    cart: "🛒",
    product: "📦",
    payment: "💳",
    selection: "📏"
};

export function showToast(msg, type = "info", duration = 4000, icon = null) {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        container.id = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const finalIcon = icon || TOAST_ICONS[type] || TOAST_ICONS.info;
    toast.innerHTML = `<div class="toast-icon">${finalIcon}</div><div class="toast-msg">${msg}</div>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add("visible"), 10);

    const timer = setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 600);
    }, duration);

    toast.onclick = () => {
        clearTimeout(timer);
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 600);
    };
}

/**
 * Tratamento universal de falhas para o frontend.
 * Converte erros técnicos ou do servidor em mensagens amigáveis em Português.
 */
export function handleError(error, context = "general") {
    console.error(`[Failure Audit] Erro em ${context}:`, error);

    const errorMsg = (error?.message || String(error)).toLowerCase();
    
    // Mapeamento de contextos para ícones e prefixos
    const contexts = {
        auth: { icon: "🔐", default: "Não foi possível realizar a autenticação." },
        products: { icon: "📦", default: "Ocorreu um problema ao carregar os produtos." },
        orders: { icon: "🛒", default: "Ocorreu um erro ao processar o pedido." },
        payment: { icon: "💳", default: "Houve um problema com o pagamento." },
        general: { icon: "❌", default: "Ocorreu um erro inesperado." }
    };

    const ctx = contexts[context] || contexts.general;

    // Tratamento de erros comuns (Rede, Cotas, Permissão)
    if (errorMsg.includes("network") || errorMsg.includes("fetch") || errorMsg.includes("failed to fetch")) {
        showToast("Problema de conexão com o servidor. Verifique sua internet.", "error", 5000, "🌐");
        return;
    }

    if (errorMsg.includes("denied") || errorMsg.includes("forbidden") || errorMsg.includes("not-admin") || errorMsg.includes("unauthorized")) {
        showToast("Acesso negado. Você não tem permissão para isso.", "error", 4000, "🚫");
        return;
    }

    if (errorMsg.includes("quota") || errorMsg.includes("too many requests")) {
        showToast("O sistema está um pouco sobrecarregado. Tente novamente em alguns minutos.", "warning", 5000, "⏳");
        return;
    }

    // Se o erro já vier formatado do Firebase (objeto com icon e message)
    if (error?.icon && error?.message) {
        showToast(error.message, "error", 5000, error.icon);
        return;
    }

    // Fallback amigável
    showToast(error.message || ctx.default, "error", 5000, ctx.icon);
}

// ─── Helper: safe JSON parse from response ───
async function safeJson(res) {
    // Mantido para compatibilidade, mas não será muito usado após migração total
    return res;
}

// ─── Admin Auth (sessionStorage) ───
const ADMIN_TOKEN_KEY = "kazzi_admin_token";

export async function adminLogin(email, password) {
    // Nota: O sistema agora prioriza Google Login. 
    // Se precisar de e-mail/senha via Firebase, usaria firebase.signInWithEmailAndPassword
    throw new Error("O login via senha foi desativado. Use o Login com Google.");
}

export async function adminGoogleLogin(email) {
    try {
        // Verifica o usuário já logado via popup no admin-logic.js
        const user = firebase.auth.currentUser;
        if (user && firebase.isAdmin(user) && user.email === email) {
            sessionStorage.setItem(ADMIN_TOKEN_KEY, "firebase_session_" + Date.now());
            return true;
        }
        throw new Error("Acesso negado. Administrador não autorizado ou sessão não encontrada.");
    } catch (err) {
        throw err;
    }
}

export function adminLogout() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function isAdminLoggedIn() {
    return !!sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getAdminToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

// ─── Produtos ───
export async function getProducts() {
    return await firebase.getProducts();
}

export async function addProduct(product) {
    return await firebase.addProduct(product);
}

export async function updateProduct(key, updates) {
    return await firebase.updateProduct(key, updates);
}

export async function deleteProduct(key) {
    return await firebase.deleteProduct(key);
}

// ─── Pedidos ───
export async function saveOrder(orderData) {
    return await firebase.saveOrder(orderData);
}

export async function getOrders() {
    return await firebase.getOrders();
}

export async function updateOrder(key, updates) {
    return await firebase.updateOrder(key, updates);
}
