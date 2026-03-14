import {
    showToast,
    getProducts,
    CATEGORIES,
    formatPrice,
    formatInstallments,
    handleError
} from "./kazzi-lib.js";

import { signInWithGoogle, onAuthStateChanged, signOut } from "./firebase-lib.js";

import { addToCart } from "./cart.js";

let allProducts = [];
let categoryFilter = "all";
let currentProduct = null;
let currentUser = null;

const productGrid = document.getElementById("product-grid");
const navList = document.getElementById("category-nav");
const modalOverlay = document.getElementById("product-modal-overlay");
const searchInput = document.getElementById("header-search-input");

async function init() {
    setupAuth(); // Initialize auth first so button works ASAP
    await loadProducts();
    renderCategories();
    renderProducts();
    setupModalHandlers();
    setupSearch();
    setupHeroParallax();
    updateCartBadge();
}

function setupAuth() {
    const loginBtn = document.getElementById("btn-user-login");
    if (!loginBtn) {
        console.error("CRITICAL: Login button #btn-user-login not found in DOM!");
        return;
    }
    console.log("Auth setup started for button:", loginBtn);

    // Immediate fallback handler
    loginBtn.onclick = async () => {
        console.log("Login button clicked (fallback)");
        try {
            const user = await signInWithGoogle();
            if (user) showToast(`Bem-vindo, ${user.displayName || 'Usuário'}!`, "success");
        } catch (error) {
            handleError(error, "auth");
        }
    };

    onAuthStateChanged((user) => {
        console.log("Auth state changed:", user ? user.email : "no user");
        currentUser = user;
        if (user) {
            loginBtn.innerHTML = `Sair (<span style="font-size: 0.8em; margin-left: 4px;">${user.displayName ? user.displayName.split(' ')[0] : 'Usuário'}</span>)`;
            loginBtn.onclick = async () => {
                await signOut();
                showToast("Você saiu da conta.", "info");
            };
        } else {
            loginBtn.textContent = "Entrar";
            loginBtn.onclick = async () => {
                try {
                    const loggedInUser = await signInWithGoogle();
                    showToast(`Bem-vindo, ${loggedInUser.displayName || 'Usuário'}!`, "success");
                } catch (error) {
                    handleError(error, "auth");
                }
            };
        }
    });
}


function updateCartBadge() {
    try {
        const cart = JSON.parse(localStorage.getItem("kazzi_cart") || "[]");
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        const badge = document.getElementById("cart-count-badge");
        if (badge) badge.textContent = count;
    } catch (e) { /* ignore */ }
}

async function loadProducts() {
    try {
        allProducts = (await getProducts()).filter(p => p.active);
    } catch (err) {
        handleError(err, "products");
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
    try {
        currentProduct = allProducts.find(p => p._key === key);
        const liveModalOverlay = document.getElementById("product-modal-overlay");
        
        if (!currentProduct || !liveModalOverlay) {
            throw new Error("Detalhes do produto indisponíveis.");
        }

        const p = currentProduct;
        const mainImg = document.getElementById("modal-main-img");
        const mainVideo = document.getElementById("modal-main-video");
        const thumbContainer = document.getElementById("modal-thumbs");

        if (mainImg) mainImg.style.display = "";
        if (mainVideo) {
            mainVideo.style.display = "none";
            mainVideo.pause();
        }
        if (mainImg) mainImg.src = (p.images && p.images[0]) || "https://placehold.co/400x400/F7F7F7/999?text=Sem+Imagem";

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
        if (thumbContainer) thumbContainer.innerHTML = thumbsHtml;

        thumbContainer?.querySelectorAll(".product-gallery-thumb").forEach(thumb => {
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

        const elTitle = document.getElementById("modal-title");
        if (elTitle) elTitle.textContent = p.name;
        
        const elPrice = document.getElementById("modal-price");
        if (elPrice) elPrice.textContent = p.priceLabel || formatPrice(p.price);
        
        const instEl = document.getElementById("modal-installment");
        if (instEl) {
            if (p.price > 0) {
                instEl.innerHTML = formatInstallments(p.price);
                instEl.style.display = "";
            } else {
                instEl.style.display = "none";
            }
        }

        const avail = document.getElementById("modal-availability");
        if (avail) {
            avail.textContent = p.stock > 0 ? "Disponibilidade: Imediata" : "Esgotado";
            avail.style.color = p.stock > 0 ? "var(--success)" : "var(--error)";
        }

        const sizeContainer = document.getElementById("modal-sizes");
        
        // Dynamic sizes based on category
        let sizes = p.sizes;
        if (!sizes || sizes.length === 0) {
            if (p.category === "calcados") {
                sizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44"];
            } else if (["camisetas", "calcas", "outfits"].includes(p.category)) {
                sizes = ["P", "M", "G", "GG", "XG"];
            } else {
                sizes = ["Tamanho Único"];
            }
        }

        if (sizeContainer) {
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
            if (buyBtn) {
                buyBtn.onclick = (e) => {
                    e.preventDefault();
                    if (!selectedSize && sizes.length > 0) {
                        showToast("Escolha seu tamanho antes de continuar.", "warning", 3000, "📏");
                        return;
                    }
                    addToCart(p, selectedSize);
                };
            }
        }

        const desc = document.getElementById("modal-description");
        if (desc) desc.textContent = p.description || "";
        
        const catName = CATEGORIES.find(c => c.id === p.category)?.name || p.category || "Produto";
        const breadcrumb = document.getElementById("modal-breadcrumb");
        if (breadcrumb) breadcrumb.textContent = `Home / ${catName} / ${p.name}`;
        
        liveModalOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
        
        // Ensure close handlers are attached
        const closeBtn = liveModalOverlay.querySelector(".product-modal-close");
        if (closeBtn && !closeBtn.dataset.bound) {
            closeBtn.addEventListener("click", closeModal);
            closeBtn.dataset.bound = "true";
        }
        if (!liveModalOverlay.dataset.bound) {
            liveModalOverlay.addEventListener("click", (e) => {
                if (e.target === liveModalOverlay) closeModal();
            });
            liveModalOverlay.dataset.bound = "true";
        }
    } catch (err) {
        handleError(err, "products");
    }
}

function closeModal() {
    const liveModalOverlay = document.getElementById("product-modal-overlay");
    if (liveModalOverlay) liveModalOverlay.classList.remove("active");
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
