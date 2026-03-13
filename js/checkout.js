import { getCart, getCartTotal } from './cart.js';
import { h as saveOrder, zp as showToast } from "./firebase-lib.js";

const summaryItems = document.getElementById('checkout-summary-items');
const totalDisplay = document.getElementById('checkout-total');
const payBtn = document.getElementById('btn-pay');

function initCheckout() {
    const cart = getCart();
    if (cart.length === 0) {
        window.location.href = '/cart.html';
        return;
    }

    renderSummary();
    setupPaymentMethods();
    setupViaCEP();
}

function renderSummary() {
    const cart = getCart();
    const total = getCartTotal();

    summaryItems.innerHTML = cart.map(item => `
        <div class="summary-item">
            <img src="${item.image}" class="summary-item-img" alt="${item.name}" />
            <div class="summary-item-info">
                <div style="font-weight: 600;">${item.name}</div>
                <div style="color: var(--text-muted); font-size: 0.8rem;">Qtd: ${item.quantity} | Tam: ${item.size}</div>
            </div>
            <div style="font-weight: 700;">R$ ${(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
    `).join('');

    totalDisplay.textContent = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function setupViaCEP() {
    const cepInput = document.getElementById('cust-cep');
    const loading = document.getElementById('cep-loading');

    cepInput.addEventListener('blur', async () => {
        const cep = cepInput.value.replace(/\D/g, '');
        if (cep.length !== 8) return;

        loading.style.display = 'block';
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (!data.erro) {
                document.getElementById('cust-address').value = data.logradouro;
                document.getElementById('cust-neighborhood').value = data.bairro;
                document.getElementById('cust-city').value = data.localidade;
                document.getElementById('cust-state').value = data.uf;
                document.getElementById('cust-number').focus();
            }
        } catch (e) {
            console.error('ViaCEP error:', e);
            showToast('Não conseguimos localizar seu CEP automaticamente.', 'warning', 4000, '📮');
        } finally {
            loading.style.display = 'none';
        }
    });

    // Autoformat CEP
    cepInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) {
            val = val.substring(0, 5) + '-' + val.substring(5, 8);
        }
        e.target.value = val;
    });
}

function setupPaymentMethods() {
    const options = document.querySelectorAll('.payment-option');
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            options.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            opt.querySelector('input').checked = true;
        });
    });

    payBtn.addEventListener('click', handlePayment);
}

async function handlePayment() {
    const method = document.querySelector('input[name="payment-method"]:checked').value;
    const total = getCartTotal();
    
    // Validate form
    const customer = {
        name: document.getElementById('cust-name').value,
        email: document.getElementById('cust-email').value,
        cpf: document.getElementById('cust-cpf').value,
        cep: document.getElementById('cust-cep').value,
        address: document.getElementById('cust-address').value,
        number: document.getElementById('cust-number').value,
        neighborhood: document.getElementById('cust-neighborhood').value,
        city: document.getElementById('cust-city').value,
        state: document.getElementById('cust-state').value
    };

    if (!customer.name || !customer.email || !customer.address || !customer.number) {
        showToast('Por favor, preencha todos os campos obrigatórios da entrega.', 'warning', 4000, '📝');
        return;
    }

    payBtn.disabled = true;
    payBtn.textContent = 'Processando...';

    console.log(`Processing ${method} payment for R$ ${total}...`);
    
    try {
        const response = await fetch('/api/payments.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                method,
                total,
                customer,
                items: getCart()
            })
        });

        const result = await response.json();
        
        if (result.success) {
            // Save order to Firebase for Admin tracking
            try {
                await saveOrder({
                    ...customer,
                    paymentMethod: method,
                    total,
                    items: getCart(),
                    orderId: result.order_id
                });
            } catch (fbErr) {
                console.error("Error saving order to Firebase:", fbErr);
                // We don't block the user if Firebase fails but payment succeeded
            }

            showToast('Sua compra foi processada com sucesso! 🎉', 'success', 5000, '✅');
            localStorage.removeItem('kazzi_cart');
            setTimeout(() => {
                window.location.href = '/success.html';
            }, 1000);
        } else {
            showToast('Houve um problema com o pagamento: ' + (result.error || 'Tente novamente.'), 'error', 5000, '❌');
            payBtn.disabled = false;
            payBtn.textContent = 'PAGAR AGORA';
        }
    } catch (e) {
        showToast('Erro de conexão com o servidor de pagamentos.', 'error', 5000, '🌐');
        payBtn.disabled = false;
        payBtn.textContent = 'PAGAR AGORA';
    }
}

document.addEventListener('DOMContentLoaded', initCheckout);
