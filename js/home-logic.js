import {
    Yp as onAuthStateChanged,
    jp as signInWithGoogle,
    zp as showToast,
    Kp as signOut,
    Qp as getProducts,
    Vp as CATEGORIES,
    $p as formatPrice,
    Gp as formatInstallments,
    Hp as isAdmin
} from "./firebase-lib.js";

import { addToCart } from "./cart.js";

let allProducts = [];
let categoryFilter = "all";
let currentProduct = null;

const productGrid = document.getElementById("product-grid");
const navList = document.getElementById("category-nav");
const modalOverlay = document.getElementById("product-modal-overlay");
const searchInput = document.getElementById("header-search-input");

async function init() {
    onAuthStateChanged((user) => {
        updateUserUI(user);
    });

    setupAuthHandlers();
    await loadProducts();
    renderCategories();
    renderProducts();
    setupModalHandlers();
    setupSearch();
    setupHeroParallax();
}

function updateUserUI(user) {
    const loginBtn = document.getElementById("btn-header-login");
    const userContainer = document.getElementById("header-user");
    const adminLink = document.getElementById("admin-link");
    const waLink = document.getElementById("header-wa-link");

    if (user) {
        if (loginBtn) loginBtn.style.display = "none";
        if (waLink) waLink.style.display = "none";
        if (userContainer) {
            userContainer.style.display = "flex";
            const avatar = document.getElementById("header-user-avatar");
            const name = document.getElementById("header-user-name");
            if (avatar) {
                avatar.src = user.photoURL || "";
                avatar.alt = user.displayName || "Usuário";
                avatar.style.display = user.photoURL ? "" : "none";
            }
            if (name) {
                const firstName = (user.displayName || "Usuário").split(" ")[0];
                name.textContent = firstName;
            }
        }
        if (adminLink) {
            adminLink.style.display = isAdmin(user) ? "" : "none";
        }
    } else {
        if (loginBtn) loginBtn.style.display = "";
        if (waLink) waLink.style.display = "";
        if (userContainer) userContainer.style.display = "none";
        if (adminLink) adminLink.style.display = "none";
    }
}

function setupAuthHandlers() {
    const loginBtn = document.getElementById("btn-header-login");
    loginBtn?.addEventListener("click", async () => {
        try {
            await signInWithGoogle();
            showToast("Seja bem-vindo de volta! 🔥", "success", 3000, "👤");
        } catch (error) {
            if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") return;
            showToast(error.message || "Não foi possível entrar na sua conta.", "error", 5000, "🔐");
        }
    });

    const logoutBtn = document.getElementById("btn-header-logout");
    logoutBtn?.addEventListener("click", async () => {
        try {
            await signOut();
            showToast("Até mais! Você saiu da sua conta.", "info", 3000, "🚪");
        } catch (error) {
            showToast(error.message || "Erro ao sair.", "error");
        }
    });

    const toggle = document.getElementById("header-user-toggle");
    const dropdown = document.getElementById("header-user-dropdown");
    toggle?.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown?.classList.toggle("open");
    });
    document.addEventListener("click", () => {
        dropdown?.classList.remove("open");
    });
}

async function loadProducts() {
    try {
        allProducts = (await getProducts()).filter(p => p.active);
    } catch (err) {
        showToast("Ocorreu um problema ao buscar o catálogo.", "error", 5000, "📦");
        allProducts = [];
    }
}

function renderCategories() {
    if (!navList) return;
    navList.innerHTML = CATEGORIES.map(cat => `
        <li>
            <a href="#" data-category="${cat.id}" class="${cat.id === categoryFilter ? "active" : ""}">${cat.name}</a>
        </li>
    `).join("");

    navList.addEventListener("click", (e) => {
        e.preventDefault();
        const link = e.target.closest("[data-category]");
        if (link) {
            categoryFilter = link.dataset.category;
            navList.querySelectorAll("a").forEach(a => a.classList.remove("active"));
            link.classList.add("active");
            renderProducts();
        }
    });
}

function renderProducts(filtered = null) {
    if (!productGrid) return;

    const useProducts = filtered || (categoryFilter === "all" ? allProducts : allProducts.filter(p => p.category === categoryFilter));

    if (useProducts.length === 0) {
        productGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 0;">
                <p style="color: var(--text-muted); font-size: 1.1rem;">Nenhum produto encontrado.</p>
            </div>
        `;
        return;
    }

    productGrid.innerHTML = useProducts.map(p => {
        const thumb = (p.images && p.images[0]) || "https://placehold.co/400x400/F7F7F7/999?text=Sem+Imagem";
        return `
            <article class="product-card" data-key="${p._key}" role="button" tabindex="0">
                <div class="product-card-img">
                    ${p.stock > 0 && p.stock <= 3 ? '<span class="product-card-badge badge badge-warning">Últimas unidades</span>' : ""}
                    ${p.stock === 0 ? '<span class="product-card-badge badge badge-error">Esgotado</span>' : ""}
                    ${p.video ? '<span class="product-card-badge badge" style="background: #1A1A1A; color: #fff;">🎬 Vídeo</span>' : ""}
                    <img src="${thumb}" alt="${p.name}" loading="lazy" onerror="this.src='https://placehold.co/400x400/F7F7F7/999?text=Erro'">
                </div>
                <div class="product-card-info">
                    <h3 class="product-card-name">${p.name}</h3>
                    <p class="product-card-price">${p.priceLabel || formatPrice(p.price)}</p>
                    ${p.price > 0 ? `<p class="product-card-installment">${formatInstallments(p.price)}</p>` : ""}
                </div>
            </article>
        `;
    }).join("");

    productGrid.querySelectorAll(".product-card").forEach(card => {
        card.addEventListener("click", () => openModal(card.dataset.key));
    });
}

function setupModalHandlers() {
    const closeBtn = modalOverlay?.querySelector(".product-modal-close");
    closeBtn?.addEventListener("click", closeModal);
    modalOverlay?.addEventListener("click", (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modalOverlay?.classList.contains("active")) closeModal();
    });
}

function openModal(key) {
    currentProduct = allProducts.find(p => p._key === key);
    if (!currentProduct || !modalOverlay) return;

    const p = currentProduct;
    const mainImg = document.getElementById("modal-main-img");
    const mainVideo = document.getElementById("modal-main-video");
    const thumbContainer = document.getElementById("modal-thumbs");

    mainImg.style.display = "";
    mainVideo.style.display = "none";
    mainVideo.pause();
    mainImg.src = (p.images && p.images[0]) || "https://placehold.co/400x400/F7F7F7/999?text=Sem+Imagem";

    let thumbsHtml = "";
    if (p.images && p.images.length > 0) {
        thumbsHtml += p.images.map((img, idx) => `
            <div class="product-gallery-thumb ${idx === 0 ? "active" : ""}" data-type="image" data-index="${idx}">
                <img src="${img}" alt="${p.name} - ${idx + 1}" onerror="this.src='https://placehold.co/80x80/F7F7F7/999?text=?'">
            </div>
        `).join("");
    }
    if (p.video) {
        thumbsHtml += `
            <div class="product-gallery-thumb" data-type="video">
                <div style="width: 100%; height: 100%; background: #1A1A1A; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">🎬</div>
            </div>
        `;
    }
    thumbContainer.innerHTML = thumbsHtml;

    thumbContainer.querySelectorAll(".product-gallery-thumb").forEach(thumb => {
        thumb.addEventListener("click", () => {
            thumbContainer.querySelectorAll(".product-gallery-thumb").forEach(t => t.classList.remove("active"));
            thumb.classList.add("active");
            if (thumb.dataset.type === "video") {
                mainImg.style.display = "none";
                mainVideo.src = p.video;
                mainVideo.style.display = "block";
                mainVideo.play();
            } else {
                mainVideo.style.display = "none";
                mainVideo.pause();
                mainImg.style.display = "";
                mainImg.src = p.images[parseInt(thumb.dataset.index)];
            }
        });
    });

    document.getElementById("modal-title").textContent = p.name;
    document.getElementById("modal-price").textContent = p.priceLabel || formatPrice(p.price);
    
    const instEl = document.getElementById("modal-installment");
    if (p.price > 0) {
        instEl.innerHTML = formatInstallments(p.price);
        instEl.style.display = "";
    } else {
        instEl.style.display = "none";
    }

    const avail = document.getElementById("modal-availability");
    avail.textContent = p.stock > 0 ? "Disponibilidade: Imediata" : "Esgotado";
    avail.style.color = p.stock > 0 ? "var(--success)" : "var(--error)";

    const sizeContainer = document.getElementById("modal-sizes");
    const sizes = p.sizes || ["P", "M", "G", "GG", "XG"];
    sizeContainer.innerHTML = sizes.map(s => `<button class="size-btn" data-size="${s}">${s}</button>`).join("");
    
    let selectedSize = null;
    sizeContainer.querySelectorAll(".size-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            sizeContainer.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedSize = btn.dataset.size;
        });
    });

    const buyBtn = document.getElementById("modal-buy-btn");
    buyBtn.onclick = (e) => {
        e.preventDefault();
        if (!selectedSize && sizes.length > 0) {
            showToast("Escolha seu tamanho antes de continuar.", "warning", 3000, "📏");
            return;
        }
        addToCart(p, selectedSize);
    };

    document.getElementById("modal-description").textContent = p.description || "";
    
    const catName = CATEGORIES.find(c => c.id === p.category)?.name || p.category;
    document.getElementById("modal-breadcrumb").textContent = `Home / ${catName} / ${p.name}`;
    
    modalOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    modalOverlay?.classList.remove("active");
    document.body.style.overflow = "";
    currentProduct = null;
    const video = document.getElementById("modal-main-video");
    if (video) {
        video.pause();
        video.style.display = "none";
    }
}

function setupSearch() {
    let timeout;
    searchInput?.addEventListener("input", () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            const val = searchInput.value.toLowerCase().trim();
            if (!val) {
                renderProducts();
                return;
            }
            const filtered = allProducts.filter(p => 
                p.name.toLowerCase().includes(val) || 
                p.description?.toLowerCase().includes(val)
            );
            renderProducts(filtered);
        }, 300);
    });
}

function setupHeroParallax() {
    const bg = document.querySelector(".hero-bg");
    if (bg) {
        window.addEventListener("scroll", () => {
            bg.style.transform = `translateY(${window.scrollY * 0.4}px)`;
        }, { passive: true });
    }
}

document.addEventListener("DOMContentLoaded", init);
