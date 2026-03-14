const CART_STORAGE_KEY = 'kazzi_cart';
import { showToast } from "./kazzi-lib.js";

export function getCart() {
    try {
        const data = localStorage.getItem(CART_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

export function saveCart(cart) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartCount();
}

export function addToCart(product, size) {
    const cart = getCart();
    const existingIndex = cart.findIndex(item => item._key === product._key && item.size === size);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
    } else {
        cart.push({
            _key: product._key,
            name: product.name,
            price: product.price,
            image: product.images[0],
            size: size,
            quantity: 1
        });
    }

    saveCart(cart);
    window.location.href = 'cart.html';
}

export function removeFromCart(key, size) {
    let cart = getCart();
    cart = cart.filter(item => !(item._key === key && item.size === size));
    saveCart(cart);
    renderCart();
    showToast('O item foi removido do seu carrinho.', 'info', 3000, '🗑️');
}

export function updateQuantity(key, size, delta) {
    const cart = getCart();
    const item = cart.find(i => i._key === key && i.size === size);
    if (item) {
        item.quantity = Math.max(1, item.quantity + delta);
        if (delta > 0) showToast('Quantidade aumentada! ➕', 'info', 2000);
        else showToast('Quantidade reduzida! ➖', 'info', 2000);
        saveCart(cart);
        renderCart();
    }
}

export function getCartTotal() {
    return getCart().reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function updateCartCount() {
    const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
    const countTitle = document.getElementById('cart-count-title');
    if (countTitle) countTitle.textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
}

function renderCart() {
    const content = document.getElementById('cart-content');
    if (!content) return;

    const cart = getCart();
    
    if (cart.length === 0) {
        content.innerHTML = `
            <div class="empty-cart-msg" style="grid-column: 1 / -1;">
                <span class="empty-cart-icon">🛒</span>
                <h2>Seu carrinho está vazio.</h2>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">Que tal levar um drop da Kazzi hoje?</p>
                <a href="./" class="checkout-btn" style="max-width: 200px; margin: 0 auto; display: inline-block;">VER PRODUTOS</a>
            </div>
        `;
        return;
    }

    const total = getCartTotal();

    content.innerHTML = `
        <div class="cart-items">
            ${cart.map(item => `
                <div class="cart-item">
                    <img src="${item.image}" class="cart-item-img" alt="${item.name}" />
                    <div class="cart-item-info">
                        <h3 class="cart-item-name">${item.name}</h3>
                        <div class="cart-item-meta">Tamanho: ${item.size}</div>
                        <div class="cart-item-price">R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div class="cart-item-actions" style="margin-top: 1rem;">
                            <div class="quantity-selector">
                                <button class="qty-btn" onclick="document.dispatchEvent(new CustomEvent('update-qty', {detail: {key: '${item._key}', size: '${item.size}', delta: -1}}))">-</button>
                                <span class="qty-val">${item.quantity}</span>
                                <button class="qty-btn" onclick="document.dispatchEvent(new CustomEvent('update-qty', {detail: {key: '${item._key}', size: '${item.size}', delta: 1}}))">+</button>
                            </div>
                            <button class="remove-btn" onclick="document.dispatchEvent(new CustomEvent('remove-item', {detail: {key: '${item._key}', size: '${item.size}'}}))">Remover</button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="cart-summary">
            <h2 class="summary-title">Resumo do Pedido</h2>
            <div class="summary-row">
                <span>Subtotal</span>
                <span>R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="summary-row">
                <span>Frete</span>
                <span>Calculado no checkout</span>
            </div>
            <div class="summary-total">
                <span>Total</span>
                <span>R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <a href="checkout.html" class="checkout-btn">FINALIZAR COMPRA</a>
        </div>
    `;
}

// Initial render
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        renderCart();
        updateCartCount();
    });
} else {
    renderCart();
    updateCartCount();
}

// Global listeners for inline buttons (shorthand for demo)
document.addEventListener('update-qty', (e) => {
    updateQuantity(e.detail.key, e.detail.size, e.detail.delta);
});

document.addEventListener('remove-item', (e) => {
    removeFromCart(e.detail.key, e.detail.size);
});
