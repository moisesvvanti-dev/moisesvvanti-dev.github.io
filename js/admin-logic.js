import {
    showToast,
    getProducts,
    CATEGORIES,
    formatPrice,
    updateProduct,
    addProduct,
    deleteProduct,
    adminLogin,
    adminLogout,
    isAdminLoggedIn,
    getOrders,
    updateOrder,
    handleError,
    adminGoogleLogin
} from "./kazzi-lib.js";

import { signInWithGoogle, onAuthStateChanged } from "./firebase-lib.js";
import { uploadFile } from "./firebase-storage-lib.js";

let products = [];
let orders = [];
let filteredProducts = [];
let currentEditProduct = null;
let currentViewOrder = null;
let importList = [];
let currentSection = "products";
let deleteTargetKey = null;

// DOM Elements
let tableBody, categoryFilter, statusFilter, searchInput, statsDisplay;
let importModal, editModal, deleteModal, orderDetailsModal;
let sidebarToggle, sidebar;
let dropzone, fileInput, importListView, importCount, saveImportBtn;
let ordersTableBody;

function init() {
    // Wait for auth state to be confirmed before deciding which UI to show
    onAuthStateChanged((user) => {
        if (user && isAdminLoggedIn()) {
            showAdminUI();
            loadProducts();
            loadOrders();
        } else {
            showLoginScreen();
        }
    });

    const googleBtn = document.getElementById("btn-admin-google");
    if (googleBtn) googleBtn.addEventListener("click", handleGoogleLogin);
}

async function handleGoogleLogin() {
    const errorEl = document.getElementById("login-error");
    const googleBtn = document.getElementById("btn-admin-google");

    if (errorEl) errorEl.style.display = "none";
    if (googleBtn) { 
        googleBtn.disabled = true; 
        googleBtn.innerHTML = "Autenticando..."; 
    }

    try {
        const user = await signInWithGoogle();
        if (!user) throw new Error("A janela de login foi fechada.");

        // Exchange Google User for PHP Admin Session
        await adminGoogleLogin(user.email);
        
        showToast("Bem-vindo de volta! 🔥", "success", 3000, "🛠");
        
        // Reload page to ensure clean state and show admin UI via init()
        setTimeout(() => {
            window.location.reload();
        }, 500);
    } catch (error) {
        handleError(error, "auth");
    } finally {
        if (googleBtn) { 
            googleBtn.disabled = false; 
            googleBtn.innerHTML = `
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" height="20">
                Entrar com conta Google Admin
            `; 
        }
    }
}

function showLoginScreen() {
    document.getElementById("admin-login-screen").style.display = "flex";
    document.getElementById("admin-sidebar").style.display = "none";
    document.getElementById("admin-main").style.display = "none";
}

function showAdminUI() {
    document.getElementById("admin-login-screen").style.display = "none";
    document.getElementById("admin-sidebar").style.display = "";
    document.getElementById("admin-main").style.display = "";

    // Cache elements
    tableBody = document.getElementById("product-table-body");
    ordersTableBody = document.getElementById("orders-table-body");
    categoryFilter = document.getElementById("filter-category");
    statusFilter = document.getElementById("filter-status");
    searchInput = document.getElementById("filter-search");
    statsDisplay = document.getElementById("filter-stats");
    
    importModal = document.getElementById("product-form-overlay");
    editModal = document.getElementById("edit-form-overlay");
    deleteModal = document.getElementById("delete-confirm-overlay");
    orderDetailsModal = document.getElementById("order-details-overlay");
    
    sidebarToggle = document.getElementById("sidebar-toggle");
    sidebar = document.getElementById("admin-sidebar");
    
    dropzone = document.getElementById("import-dropzone");
    fileInput = document.getElementById("import-file-input");
    importListView = document.getElementById("import-products-list");
    importCount = document.getElementById("import-count");
    saveImportBtn = document.getElementById("btn-import-save");

    setupFilters();
    setupEventListeners();
}

function showSection(sectionId) {
    currentSection = sectionId;
    document.getElementById("section-products").style.display = sectionId === "products" ? "block" : "none";
    document.getElementById("section-orders").style.display = sectionId === "orders" ? "block" : "none";
    
    document.getElementById("page-title").textContent = sectionId === "products" ? "Produtos" : "Pedidos";
    document.getElementById("topbar-actions").style.display = sectionId === "products" ? "" : "none";
    
    document.querySelectorAll(".sidebar-link").forEach(l => {
        l.classList.toggle("active", l.dataset.section === sectionId);
    });
    
    if (sectionId === "products") renderProducts();
    else loadOrders();
}

async function handleLogout() {
    adminLogout();
    showLoginScreen();
    showToast("Você saiu do painel admin.", "info", 3000, "🚪");
}

async function loadProducts() {
    try {
        products = await getProducts();
        renderProducts();
    } catch (error) {
        handleError(error, "products");
        products = [];
        renderProducts();
    }
}

async function loadOrders() {
    try {
        orders = await getOrders();
        renderOrders();
    } catch (error) {
        handleError(error, "orders");
        orders = [];
        renderOrders();
    }
}

function setupFilters() {
    if (!categoryFilter) return;
    categoryFilter.innerHTML = '<option value="all">Todas</option>';
    CATEGORIES.filter(c => c.id !== "all").forEach(cat => {
        categoryFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });

    const editCategory = document.getElementById("edit-product-category");
    if (editCategory) {
        editCategory.innerHTML = '<option value="">Selecione...</option>';
        CATEGORIES.filter(c => c.id !== "all").forEach(cat => {
            editCategory.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
}

function renderProducts() {
    if (!tableBody || currentSection !== "products") return;

    const cat = categoryFilter.value;
    const stat = statusFilter.value;
    const search = (searchInput.value || "").toLowerCase().trim();

    filteredProducts = products.filter(p => {
        const matchesCat = (cat === "all" || p.category === cat);
        const matchesStat = (
            stat === "all" ||
            (stat === "active" && p.active) ||
            (stat === "inactive" && !p.active) ||
            (stat === "low-stock" && p.stock > 0 && p.stock <= 5) ||
            (stat === "out-of-stock" && p.stock === 0)
        );
        const matchesSearch = (!search || p.name.toLowerCase().includes(search));
        return matchesCat && matchesStat && matchesSearch;
    });

    if (statsDisplay) statsDisplay.textContent = `${filteredProducts.length} de ${products.length} produtos`;

    if (filteredProducts.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">Nenhum produto encontrado.</td></tr>';
        return;
    }

    tableBody.innerHTML = filteredProducts.map(p => {
        const thumb = (p.images && p.images[0]) || "https://placehold.co/44x44/1A1A1A/FFF?text=?";
        return `
            <tr>
                <td><img src="${thumb}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" /></td>
                <td><div style="font-weight:600;">${p.name}</div></td>
                <td>${CATEGORIES.find(c => c.id === p.category)?.name || p.category}</td>
                <td>R$ ${p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td>${p.stock}</td>
                <td>${p.active ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-error">Inativo</span>'}</td>
                <td>
                    <button class="btn btn-sm btn-outline edit-btn" data-key="${p._key}">✏️</button>
                    <button class="btn btn-sm btn-outline delete-btn" data-key="${p._key}">🗑️</button>
                </td>
            </tr>
        `;
    }).join("");

    tableBody.querySelectorAll(".edit-btn").forEach(btn => btn.addEventListener("click", () => openEditModal(btn.dataset.key)));
    tableBody.querySelectorAll(".delete-btn").forEach(btn => btn.addEventListener("click", () => confirmDelete(btn.dataset.key)));
}

function renderOrders() {
    if (!ordersTableBody || currentSection !== "orders") return;

    if (orders.length === 0) {
        ordersTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">Nenhum pedido encontrado.</td></tr>';
        return;
    }

    const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    ordersTableBody.innerHTML = sortedOrders.map(o => `
        <tr>
            <td><span style="font-size:0.8rem; color:var(--text-muted);">${new Date(o.createdAt).toLocaleString()}</span></td>
            <td>
                <div style="font-weight:600;">${o.name}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${o.email}</div>
            </td>
            <td><span style="font-weight:700;">R$ ${o.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></td>
            <td><span class="badge badge-info">${(o.paymentMethod || 'N/A').toUpperCase()}</span></td>
            <td>${getOrderStatusBadge(o.status || 'pending')}</td>
            <td>
                <button class="btn btn-sm btn-outline btn-view-order" data-key="${o._key}">Ver Detalhes</button>
            </td>
        </tr>
    `).join('');

    ordersTableBody.querySelectorAll(".btn-view-order").forEach(btn => {
        btn.addEventListener("click", () => openOrderDetails(btn.dataset.key));
    });
}

function getOrderStatusBadge(status) {
    switch (status) {
        case 'pending': return '<span class="badge badge-warning">Pendente</span>';
        case 'shipped': return '<span class="badge badge-info">Enviado</span>';
        case 'delivered': return '<span class="badge badge-success">Entregue</span>';
        case 'cancelled': return '<span class="badge badge-error">Cancelado</span>';
        default: return `<span class="badge">${status}</span>`;
    }
}

function openOrderDetails(key) {
    const order = orders.find(o => o._key === key);
    if (!order) return;
    currentViewOrder = order;

    document.getElementById("detail-order-id").textContent = `ORDEM ID: ${order._key}`;
    document.getElementById("detail-cust-name").textContent = order.name;
    document.getElementById("detail-cust-email").textContent = order.email;
    document.getElementById("detail-cust-address").textContent = `${order.address}, ${order.number} - ${order.neighborhood}, ${order.city}/${order.state} - CEP: ${order.cep}`;
    
    const itemsList = document.getElementById("detail-items-list");
    itemsList.innerHTML = (order.items || []).map(item => `
        <div class="order-item-mini">
            <img src="${item.image}" />
            <div style="flex:1;">
                <div style="font-weight:600;">${item.name}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">Qtd: ${item.quantity} | Tam: ${item.size}</div>
            </div>
            <div style="font-weight:700;">R$ ${(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
    `).join('');

    document.getElementById("order-tracking-input").value = order.trackingCode || "";
    orderDetailsModal.classList.add("active");
}

function openEditModal(key) {
    const product = products.find(p => p._key === key);
    if (!product) return;
    currentEditProduct = { ...product, images: [...(product.images || [])] };

    document.getElementById("edit-product-name").value = product.name;
    document.getElementById("edit-product-price").value = product.price;
    document.getElementById("edit-product-stock").value = product.stock;
    document.getElementById("edit-product-category").value = product.category || "";
    document.getElementById("edit-product-description").value = product.description || "";
    document.getElementById("edit-product-active").checked = product.active !== false;

    renderEditImages();
    editModal.classList.add("active");
}

function renderEditImages() {
    const list = document.getElementById("edit-images-list");
    if (!list || !currentEditProduct) return;

    const imgs = currentEditProduct.images || [];
    list.innerHTML = imgs.map((img, idx) => `
        <div class="edit-images-item" style="position:relative; cursor:pointer;" data-idx="${idx}">
            <img src="${img}" style="width:60px; height:60px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1);" />
            ${idx === 0 ? '<span style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); font-size:8px; text-align:center;">CAPA</span>' : ''}
            <div class="remove-overlay" style="position:absolute; inset:0; background:rgba(220,38,38,0.4); display:none; align-items:center; justify-content:center; border-radius:4px;">✖</div>
        </div>
    `).join('');

    list.querySelectorAll('.edit-images-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.idx);
            currentEditProduct.images.splice(idx, 1);
            renderEditImages();
        });
    });
}

async function handleSaveEdit() {
    if (!currentEditProduct) return;
    
    const updated = {
        name: document.getElementById("edit-product-name").value,
        price: parseFloat(document.getElementById("edit-product-price").value),
        stock: parseInt(document.getElementById("edit-product-stock").value),
        category: document.getElementById("edit-product-category").value,
        description: document.getElementById("edit-product-description").value,
        active: document.getElementById("edit-product-active").checked,
        images: currentEditProduct.images || []
    };

    try {
        await updateProduct(currentEditProduct._key, updated);
        showToast("Produto atualizado com sucesso!", "success", 4000, "💾");
        editModal.classList.remove("active");
        await loadProducts();
    } catch (e) {
        handleError(e, "products");
    }
}

function confirmDelete(key) {
    deleteTargetKey = key;
    deleteModal.classList.add("active");
}

async function handleDelete() {
    if (!deleteTargetKey) return;
    try {
        await deleteProduct(deleteTargetKey);
        showToast("O produto foi removido do catálogo.", "success", 4000, "🗑️");
        deleteModal.classList.remove("active");
        await loadProducts();
    } catch (e) {
        handleError(e, "products");
    }
}

// --- Import Logic ---
function handleFiles(files) {
    const newFiles = Array.from(files).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
    newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const name = formatProductName(file.name);
            importList.push({
                name,
                file,
                preview: e.target.result,
                price: 0,
                stock: 10,
                category: autoCategory(name),
                description: generateDescription(name)
            });
            renderImportList();
        };
        reader.readAsDataURL(file);
    });
}

function formatProductName(filename) {
    return filename.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function autoCategory(name) {
    const l = name.toLowerCase();
    if (l.includes("camis") || l.includes("jersey") || l.includes("shirt")) return "camisetas";
    if (l.includes("calca") || l.includes("pants") || l.includes("short")) return "calcas";
    if (l.includes("bone") || l.includes("cap") || l.includes("meia") || l.includes("tenis") || l.includes("sapato")) return "acessorios";
    return "";
}

function generateDescription(name) {
    return `Kazzi Company - ${name}. Qualidade premium, design exclusivo inspirado na cena urbana e no streetwear dos anos 90.`;
}

function renderImportList() {
    if (!importListView) return;
    importListView.innerHTML = importList.map((item, idx) => {
        const thumb = (item.images && item.images[0]) || item.preview || "https://placehold.co/60x60/1A1A1A/FFF?text=?";
        return `
        <div class="import-item" style="display:flex; flex-direction:column; gap:0.5rem; padding:1rem; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:0.5rem;">
            <div style="display:flex; gap:1rem; align-items:center;">
                <img src="${thumb}" style="width:60px; height:60px; object-fit:cover; border-radius:4px;" />
                <div style="flex:1;">
                    <input type="text" value="${item.name}" class="form-input import-name-input" data-idx="${idx}" style="margin-bottom:0.5rem;" />
                    <div style="display:flex; gap:0.5rem;">
                        <input type="number" value="${item.price}" class="form-input import-price-input" data-idx="${idx}" placeholder="Preço" style="width:80px;" />
                        <select class="form-select import-cat-select" data-idx="${idx}" style="flex:1;">
                            <option value="">Categoria...</option>
                            ${CATEGORIES.filter(c => c.id !== "all").map(c => `<option value="${c.id}" ${item.category === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <button class="btn btn-sm btn-ghost import-remove-btn" data-idx="${idx}">✖</button>
            </div>
        </div>
        `;
    }).join('');
    
    // Attach event listeners
    importListView.querySelectorAll('.import-name-input').forEach(input => {
        input.addEventListener('change', (e) => { importList[parseInt(e.target.dataset.idx)].name = e.target.value; });
    });
    importListView.querySelectorAll('.import-price-input').forEach(input => {
        input.addEventListener('change', (e) => { importList[parseInt(e.target.dataset.idx)].price = parseFloat(e.target.value); });
    });
    importListView.querySelectorAll('.import-cat-select').forEach(select => {
        select.addEventListener('change', (e) => { importList[parseInt(e.target.dataset.idx)].category = e.target.value; });
    });
    importListView.querySelectorAll('.import-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => { importList.splice(parseInt(btn.dataset.idx), 1); renderImportList(); });
    });

    if (saveImportBtn) saveImportBtn.disabled = importList.length === 0;
}

async function saveImportedProducts() {
    saveImportBtn.disabled = true;
    saveImportBtn.textContent = "Salvando...";
    
    for (const item of importList) {
        try {
            await addProduct({
                name: item.name,
                price: item.price,
                stock: item.stock,
                category: item.category,
                description: item.description,
                images: item.images || [item.preview],
                active: true
            });
        } catch (e) { handleError(e, "products"); }
    }
    
    showToast("A importação foi concluída com sucesso! 🚀", "success", 6000, "✨");
    importModal.classList.remove("active");
    importList = [];
    saveImportBtn.textContent = "Salvar Todos";
    await loadProducts();
}

function setupEventListeners() {
    sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
    
    document.querySelectorAll(".sidebar-link").forEach(link => {
        link.addEventListener("click", (e) => {
            if (link.dataset.section) {
                e.preventDefault();
                showSection(link.dataset.section);
            }
        });
    });

    document.getElementById("btn-logout").addEventListener("click", e => { e.preventDefault(); handleLogout(); });

    document.getElementById("btn-new-product").addEventListener("click", () => {
        importList = [];
        renderImportList();
        importModal.classList.add("active");
    });

    document.getElementById("btn-import-cancel").addEventListener("click", () => importModal.classList.remove("active"));
    document.getElementById("btn-import-save").addEventListener("click", saveImportedProducts);
    
    document.getElementById("btn-edit-cancel").addEventListener("click", () => editModal.classList.remove("active"));
    document.getElementById("btn-edit-save").addEventListener("click", handleSaveEdit);
    
    document.getElementById("btn-delete-cancel").addEventListener("click", () => deleteModal.classList.remove("active"));
    document.getElementById("btn-delete-confirm").addEventListener("click", handleDelete);

    // Image URL add for edit
    document.getElementById("btn-edit-image-add")?.addEventListener("click", () => {
        const input = document.getElementById("edit-image-url-input");
        const url = input.value.trim();
        if (url && currentEditProduct) {
            if (!currentEditProduct.images) currentEditProduct.images = [];
            currentEditProduct.images.push(url);
            input.value = "";
            renderEditImages();
        }
    });

    // File Upload for edit
    const editFileInput = document.getElementById("edit-image-file-input");
    const editUploadBtn = document.getElementById("btn-edit-image-upload");

    editUploadBtn?.addEventListener("click", () => editFileInput.click());

    editFileInput?.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file || !currentEditProduct) return;

        try {
            editUploadBtn.textContent = "⏳";
            editUploadBtn.disabled = true;
            
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const path = `products/${currentEditProduct._key || 'new'}/${fileName}`;
            
            const url = await uploadFile(file, path, (progress) => {
                console.log(`Upload progress: ${progress}%`);
            });

            if (!currentEditProduct.images) currentEditProduct.images = [];
            currentEditProduct.images.push(url);
            renderEditImages();
            showToast("Upload concluído!", "success", 3000, "📸");
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            editUploadBtn.textContent = "📁";
            editUploadBtn.disabled = false;
            editFileInput.value = ""; // Reset input
        }
    });

    // Image URL add for import
    document.getElementById("btn-import-url-add")?.addEventListener("click", () => {
        const input = document.getElementById("import-url-input");
        const url = input.value.trim();
        if (url) {
            const name = "Novo Produto via URL";
            importList.push({
                name,
                images: [url],
                preview: url,
                price: 0,
                stock: 10,
                category: "",
                description: generateDescription(name)
            });
            input.value = "";
            renderImportList();
        }
    });
    
    document.getElementById("btn-close-order-details").addEventListener("click", () => orderDetailsModal.classList.remove("active"));
    
    document.getElementById("btn-save-tracking").addEventListener("click", async () => {
        const code = document.getElementById("order-tracking-input").value.trim();
        if (!currentViewOrder) return;
        try {
            await updateOrder(currentViewOrder._key, { trackingCode: code, status: code ? "shipped" : "pending" });
            showToast("Código de rastreio atualizado!", "success", 4000, "📦");
            orderDetailsModal.classList.remove("active");
            await loadOrders();
        } catch (e) { 
            handleError(e, "orders"); 
        }
    });

    document.getElementById("btn-mark-delivered").addEventListener("click", async () => {
        if (!currentViewOrder) return;
        try {
            await updateOrder(currentViewOrder._key, { status: "delivered" });
            showToast("Status alterado para Entregue! ✅", "success", 4000, "🏁");
            orderDetailsModal.classList.remove("active");
            await loadOrders();
        } catch (e) { 
            handleError(e, "orders"); 
        }
    });

    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("dragging"); });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
    dropzone.addEventListener("drop", e => {
        e.preventDefault();
        dropzone.classList.remove("dragging");
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener("change", e => handleFiles(e.target.files));

    categoryFilter.addEventListener("change", renderProducts);
    statusFilter.addEventListener("change", renderProducts);
    searchInput.addEventListener("input", renderProducts);
}

document.addEventListener("DOMContentLoaded", init);
