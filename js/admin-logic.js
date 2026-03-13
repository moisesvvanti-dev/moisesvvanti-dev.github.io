import {
    onAuthStateChanged,
    loginAsAdmin,
    showToast,
    isAdmin,
    getProducts,
    CATEGORIES,
    formatPrice,
    updateProduct,
    addProduct,
    deleteProduct,
    signOut,
    formatInstallments,
    signInWithGoogle as getCurrentUser,
    getOrders,
    updateOrder,
    onNewOrder
} from "./firebase-lib.js";

let products = [];
let orders = [];
let filteredProducts = [];
let currentEditProduct = null;
let currentViewOrder = null;
let importList = [];
let currentSection = "products";
let deleteTargetKey = null;

const WHATSAPP_NUMBER = "5547989164910";
const WHATSAPP_BASE_URL = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}`;

// DOM Elements
let tableBody, categoryFilter, statusFilter, searchInput, statsDisplay;
let importModal, editModal, deleteModal, orderDetailsModal;
let sidebarToggle, sidebar;
let dropzone, fileInput, importListView, importCount, saveImportBtn;
let ordersTableBody, orderBell;

function init() {
    onAuthStateChanged(async (user) => {
        if (user) {
            console.log("Logged in as:", user.email);
            if (isAdmin(user)) {
                showAdminUI();
                await loadProducts();
                initOrders();
            } else {
                handleLoginError({
                    code: "auth/not-admin",
                    message: `Acesso negado para ${user.email}. Apenas administradores autorizados podem acessar este painel.`
                });
                await signOut();
            }
        } else {
            showLoginScreen();
        }
    });

    const loginBtn = document.getElementById("btn-google-login");
    if (loginBtn) loginBtn.addEventListener("click", handleLogin);
}

function initOrders() {
    orderBell = document.getElementById("order-bell");
    onNewOrder((newOrders) => {
        if (orders.length > 0 && newOrders.length > orders.length) {
            playBell();
            showToast("Novo pedido recebido! 🎉", "success", 7000, "🔔");
        }
        orders = newOrders;
        if (currentSection === "orders") renderOrders();
    });
}

function playBell() {
    if (orderBell) {
        orderBell.currentTime = 0;
        orderBell.play().catch(e => console.log("Audio play failed:", e));
    }
}

async function handleLogin() {
    const errorEl = document.getElementById("login-error");
    const loadingEl = document.getElementById("login-loading");
    const loginBtn = document.getElementById("btn-google-login");

    if (errorEl) errorEl.style.display = "none";
    if (loadingEl) loadingEl.style.display = "flex";
    if (loginBtn) loginBtn.disabled = true;

    try {
        await signInWithGoogle();
    } catch (error) {
        if (loadingEl) loadingEl.style.display = "none";
        if (loginBtn) loginBtn.disabled = false;
        
        if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") return;
        
        if (errorEl) {
            errorEl.textContent = error.message;
            errorEl.style.display = "block";
        }
        showToast(error.message, "error", 5000, error.icon || "🔐");
    }
}

function handleLoginError(error) {
    const errorEl = document.getElementById("login-error");
    const loadingEl = document.getElementById("login-loading");
    const loginBtn = document.getElementById("btn-google-login");

    if (loadingEl) loadingEl.style.display = "none";
    if (loginBtn) loginBtn.disabled = false;
    
    if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.style.display = "block";
    }
    showToast(error.message, "error", 5000, error.icon || "🔐");
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
    else renderOrders();
}

async function handleLogout() {
    try {
        await signOut();
        showLoginScreen();
    } catch (error) {
        showToast(error.message || "Erro ao tentar sair.", "error", 4000, "🚫");
    }
}

async function loadProducts() {
    try {
        products = await getProducts();
        renderProducts();
    } catch (error) {
        showToast("Não foi possível carregar os produtos.", "error", 5000, "📦");
        products = [];
        renderProducts();
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

async function renderOrders() {
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
    currentEditProduct = product;

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
        <div class="edit-images-item" style="position:relative; cursor:pointer;" onclick="removeEditImage(${idx})">
            <img src="${img}" style="width:60px; height:60px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1);" />
            ${idx === 0 ? '<span style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); font-size:8px; text-align:center;">CAPA</span>' : ''}
            <div class="remove-overlay" style="position:absolute; inset:0; background:rgba(220,38,38,0.4); display:none; align-items:center; justify-content:center; border-radius:4px;">✖</div>
        </div>
    `).join('');
}

window.removeEditImage = (idx) => {
    if (!currentEditProduct) return;
    currentEditProduct.images.splice(idx, 1);
    renderEditImages();
};

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
        showToast("Não foi possível salvar as alterações.", "error", 5000, "💾");
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
        showToast("Ocorreu um erro ao excluir o produto.", "error", 5000, "🗑️");
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
    if (l.includes("camisa") || l.includes("jersey") || l.includes("shirt")) return "camisas";
    if (l.includes("moletom") || l.includes("hoodie")) return "moletons";
    if (l.includes("calca") || l.includes("pants") || l.includes("short")) return "calcas-shorts";
    if (l.includes("bone") || l.includes("cap") || l.includes("meia")) return "acessorios";
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
                    <input type="text" value="${item.name}" onchange="importList[${idx}].name=this.value" class="form-input" style="margin-bottom:0.5rem;" />
                    <div style="display:flex; gap:0.5rem;">
                        <input type="number" value="${item.price}" onchange="importList[${idx}].price=parseFloat(this.value)" placeholder="Preço" class="form-input" style="width:80px;" />
                        <select onchange="importList[${idx}].category=this.value" class="form-select" style="flex:1;">
                            <option value="">Categoria...</option>
                            ${CATEGORIES.filter(c => c.id !== "all").map(c => `<option value="${c.id}" ${item.category === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <button onclick="importList.splice(${idx},1); renderImportList();" class="btn btn-sm btn-ghost">✖</button>
            </div>
            <div class="import-item-images" style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                ${(item.images || []).map((img, iIdx) => `
                    <div style="position:relative; cursor:pointer;" onclick="importList[${idx}].images.splice(${iIdx},1); renderImportList();">
                        <img src="${img}" style="width:30px; height:30px; object-fit:cover; border-radius:2px;" />
                    </div>
                `).join('')}
            </div>
        </div>
        `;
    }).join('');
    
    if (importCount) importCount.textContent = `${importList.length} itens`;
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
                images: item.images || [item.preview], // In real app, we'd upload file to Storage first
                active: true,
                createdAt: new Date().toISOString()
            });
        } catch (e) { console.error("Error saving", item.name, e); }
    }
    
    showToast("A importação foi concluída com sucesso! 🚀", "success", 6000, "📸");
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

    // New Multi-Image listeners
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
        } catch (e) { showToast("Erro ao atualizar.", "error"); }
    });

    document.getElementById("btn-mark-delivered").addEventListener("click", async () => {
        if (!currentViewOrder) return;
        try {
            await updateOrder(currentViewOrder._key, { status: "delivered" });
            showToast("Status alterado para Entregue! ✅", "success", 4000, "🏁");
            orderDetailsModal.classList.remove("active");
        } catch (e) { showToast("Erro ao atualizar.", "error"); }
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

    // Global helper for rendered list buttons (workaround for onclick in template strings)
    window.renderImportList = renderImportList;
    window.importList = importList;
}

document.addEventListener("DOMContentLoaded", init);
