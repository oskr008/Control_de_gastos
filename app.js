// State and Data Management
let state = {
    cards: [
        { id: 'card-1', name: 'Visa Signature', limit: 5000, color: '#6366f1' },
        { id: 'card-2', name: 'Mastercard Black', limit: 3500, color: '#8b5cf6' }
    ],
    transactions: [],
    selectedCardId: 'all',
    selectedMonth: 'all',
    transfers: []
};

let currentUser = null; // Supabase user ID

// Supabase Init
const supabaseUrl = 'https://tybfbjlejficwkydqtmk.supabase.co';
const supabaseKey = 'sb_publishable_P6OT_CJNLtg6ysRhRQjRnQ_iptyAyXi';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Colors for charts
const categoryColors = {
    'Supermercado': '#10b981',
    'Transporte': '#6366f1',
    'Entretenimiento': '#8b5cf6',
    'Servicios': '#f59e0b',
    'Suscripciones': '#ec4899',
    'Otros': '#ef4444'
};

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ph-info';
    if (type === 'error') icon = 'ph-x-circle';
    if (type === 'success') icon = 'ph-check-circle';
    
    toast.innerHTML = `<i class="ph ${icon}" style="font-size: 20px;"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

// Initialize App Data
async function initApp() {
    await loadData();
    populateCardSelectors();
    populateMonthSelector();
    updateDashboard();
    setupCharts();
}

// Load from Supabase DB
async function loadData() {
    if (!currentUser) return;
    const { data, error } = await supabase.from('user_data').select('app_state').eq('user_id', currentUser).single();
    
    if (data && data.app_state) {
        state = data.app_state;
    } else {
        // Fallback for new user or empty data
        const today = new Date().toISOString().split('T')[0];
        let d = new Date();
        d.setDate(d.getDate() - 2);
        
        state = {
            cards: [
                { id: 'card-1', name: 'Visa Signature', limit: 5000, color: '#6366f1' },
                { id: 'card-2', name: 'Mastercard Black', limit: 3500, color: '#8b5cf6' }
            ],
            transactions: [],
            selectedCardId: 'all',
            selectedMonth: 'all',
            transfers: []
        };
        await saveData();
    }
    if (!state.transfers) state.transfers = [];
}

async function saveData() {
    if (!currentUser) return;
    const { error } = await supabase.from('user_data').upsert({
        user_id: currentUser,
        app_state: state
    });
    if (error) {
        console.error("Error al guardar en Supabase:", error);
        showToast("Error al guardar datos", "error");
    }
}

// UI Population
function populateCardSelectors() {
    const filterSelect = document.getElementById('cardSelect');
    const formSelect = document.getElementById('txCard');
    
    // Clear existing dynamic options except the first 'all' for filter
    filterSelect.innerHTML = '<option value="all">Todas las Tarjetas</option>';
    formSelect.innerHTML = '';

    state.cards.forEach(card => {
        const optionHTML = `<option value="${card.id}">${card.name}</option>`;
        filterSelect.innerHTML += optionHTML;
        formSelect.innerHTML += optionHTML;
    });

    filterSelect.value = state.selectedCardId;
}

function populateMonthSelector() {
    const monthSelect = document.getElementById('monthSelect');
    monthSelect.innerHTML = '<option value="all">Todos los Meses</option>';
    
    // find unique months
    const months = new Set();
    state.transactions.forEach(t => {
        months.add(t.date.substring(0, 7));
    });
    
    const sortedMonths = Array.from(months).sort().reverse();
    sortedMonths.forEach(m => {
        const [year, month] = m.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
        const label = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        const capLabel = label.charAt(0).toUpperCase() + label.slice(1);
        monthSelect.innerHTML += `<option value="${m}">${capLabel}</option>`;
    });

    if(sortedMonths.includes(state.selectedMonth)) {
        monthSelect.value = state.selectedMonth;
    } else {
        state.selectedMonth = 'all';
        monthSelect.value = 'all';
    }
}

// Format numbers
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};
const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('es-ES', options);
};

// Core Logic: Get Filtered Transactions
function getTransactionsByCard() {
    if (state.selectedCardId === 'all') return state.transactions;
    return state.transactions.filter(t => t.cardId === state.selectedCardId);
}

function getFilteredTransactions() {
    const cardTxs = getTransactionsByCard();
    if (state.selectedMonth === 'all') return cardTxs;
    return cardTxs.filter(t => t.date.substring(0, 7) === state.selectedMonth);
}

// Update Dashboard View
function updateDashboard() {
    const txs = getFilteredTransactions();
    
    // Calculate Summary
    const totalSpent = txs.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    let totalLimit = 0;
    
    if (state.selectedCardId === 'all') {
        totalLimit = state.cards.reduce((sum, c) => sum + c.limit, 0);
    } else {
        const card = state.cards.find(c => c.id === state.selectedCardId);
        totalLimit = card ? card.limit : 0;
    }

    const available = Math.max(0, totalLimit - totalSpent);

    document.getElementById('totalSpent').textContent = formatCurrency(totalSpent);
    document.getElementById('availableCredit').textContent = formatCurrency(available);

    // Update Table
    const tbody = document.querySelector('#transactionsTable tbody');
    tbody.innerHTML = '';
    
    // Sort txs by date descending
    const sortedTxs = [...txs].sort((a,b) => new Date(b.date) - new Date(a.date));

    sortedTxs.forEach(tx => {
        const cardName = state.cards.find(c => c.id === tx.cardId)?.name || 'Unknown';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(tx.date)}</td>
            <td><strong>${tx.desc}</strong></td>
            <td><span class="tag" style="background-color: ${categoryColors[tx.category]}40; color: ${categoryColors[tx.category]}">${tx.category}</span></td>
            <td>${cardName}</td>
            <td>${tx.installments}</td>
            <td style="font-weight: 600;">${formatCurrency(tx.amount)}</td>
        `;
        tbody.appendChild(tr);
    });

    updateCharts(txs, getTransactionsByCard());
}

// Chart.js Instances
let categoryChartInstance = null;
let trendChartInstance = null;
let historyChartInstance = null;
let transfersChartInstance = null;

function setupCharts() {
    // Defaults for dark mode
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
    updateCharts(getFilteredTransactions(), getTransactionsByCard());
}

function updateCharts(txs, historyTxs) {
    updateCategoryChart(txs);
    updateTrendChart(txs);
    updateHistoryChart(historyTxs);
}

function updateCategoryChart(txs) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    // Aggregate by category
    const categoryTotals = {};
    txs.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + parseFloat(t.amount);
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const bgColors = labels.map(l => categoryColors[l] || '#888');

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            },
            cutout: '75%'
        }
    });
}

function updateTrendChart(txs) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    // Aggregate by date
    const dateTotals = {};
    const sortedTxs = [...txs].sort((a,b) => new Date(a.date) - new Date(b.date));
    
    sortedTxs.forEach(t => {
        dateTotals[t.date] = (dateTotals[t.date] || 0) + parseFloat(t.amount);
    });

    const labels = Object.keys(dateTotals).map(d => formatDate(d));
    const data = Object.values(dateTotals);

    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    trendChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gasto Diario',
                data: data,
                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function updateHistoryChart(txs) {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    // Group by month (YYYY-MM) and category
    const monthData = {};
    const categories = new Set();

    txs.forEach(t => {
        const month = t.date.substring(0, 7); // 'YYYY-MM'
        categories.add(t.category);
        if (!monthData[month]) monthData[month] = {};
        monthData[month][t.category] = (monthData[month][t.category] || 0) + parseFloat(t.amount);
    });

    // Format labels nicely
    const sortedMonths = Object.keys(monthData).sort();
    const formattedLabels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
        return dateObj.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    });
    
    const datasets = Array.from(categories).map(cat => {
        return {
            label: cat,
            data: sortedMonths.map(m => monthData[m][cat] || 0),
            borderColor: categoryColors[cat] || '#ffffff',
            backgroundColor: (categoryColors[cat] || '#ffffff') + '40',
            tension: 0.3,
            fill: true
        };
    });

    if (historyChartInstance) {
        historyChartInstance.destroy();
    }

    historyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: formattedLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Event Listeners
function setupEventListeners() {
    // Auth UI Switching
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    
    if (showRegisterBtn) showRegisterBtn.addEventListener('click', () => { console.log("Form Switch Executed");  loginForm.style.display = 'none'; registerForm.style.display = 'flex'; });
    if (showLoginBtn) showLoginBtn.addEventListener('click', () => { registerForm.style.display = 'none'; loginForm.style.display = 'flex'; });

    // Authentication Logic
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPassword').value;
        
        showToast("Iniciando sesión...", "info");
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        
        if (error) {
            showToast("Correo o contraseña incorrectos", "error");
        } else {
            showToast("Sesión iniciada", "success");
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('regEmail').value.trim();
        const pass = document.getElementById('regPassword').value;
        const pass2 = document.getElementById('regPasswordConfirm').value;
        
        if (pass !== pass2) return showToast("Las contraseñas no coinciden", "error");
        
        showToast("Creando cuenta...", "info");
        const { data, error } = await supabase.auth.signUp({ email, password: pass });
        
        if (error) {
            showToast("Error de registro: " + error.message, "error");
        } else {
            showToast("Cuenta creada con éxito. Si no entras automáticamente, inicia sesión.", "success");
            // Automatically switch back to login form
            registerForm.style.display = 'none';
            loginForm.style.display = 'flex';
            document.getElementById('loginEmail').value = email;
            document.getElementById('loginPassword').value = '';
            // Limpiar form de registro
            registerForm.reset();
        }
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
    });

    // Navigation
    const navDashboard = document.getElementById('navDashboard');
    const navTransferencias = document.getElementById('navTransferencias');
    const dashboardView = document.getElementById('dashboardView');
    const transfersView = document.getElementById('transfersView');

    function switchView(viewId) {
        dashboardView.style.display = viewId === 'dashboard' ? 'flex' : 'none';
        transfersView.style.display = viewId === 'transfers' ? 'flex' : 'none';
        navDashboard.classList.toggle('active', viewId === 'dashboard');
        navTransferencias.classList.toggle('active', viewId === 'transfers');
        if (viewId === 'transfers') updateTransfersView();
    }

    if(navDashboard && navTransferencias) {
        navDashboard.addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });
        navTransferencias.addEventListener('click', (e) => { e.preventDefault(); switchView('transfers'); });
    }

    const modal = document.getElementById('txModal');
    const openBtn = document.getElementById('addTxBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const form = document.getElementById('txForm');
    const cardSelect = document.getElementById('cardSelect');
    const monthSelect = document.getElementById('monthSelect');

    // Default Today's date
    document.getElementById('txDate').valueAsDate = new Date();

    openBtn.addEventListener('click', () => modal.classList.add('active'));
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if(e.target === modal) modal.classList.remove('active');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newTx = {
            id: Date.now().toString(),
            desc: document.getElementById('txDesc').value,
            amount: parseFloat(document.getElementById('txAmount').value),
            date: document.getElementById('txDate').value,
            category: document.getElementById('txCategory').value,
            cardId: document.getElementById('txCard').value,
            installments: parseInt(document.getElementById('txInstallments').value, 10)
        };

        state.transactions.push(newTx);
        await saveData();
        populateMonthSelector();
        updateDashboard();
        
        form.reset();
        document.getElementById('txDate').valueAsDate = new Date();
        modal.classList.remove('active');
    });

    cardSelect.addEventListener('change', async (e) => {
        state.selectedCardId = e.target.value;
        await saveData();
        updateDashboard();
    });

    monthSelect.addEventListener('change', async (e) => {
        state.selectedMonth = e.target.value;
        await saveData();
        updateDashboard();
    });

    // Transfer Modal
    const transferModal = document.getElementById('transferModal');
    const addTransferBtn = document.getElementById('addTransferBtn');
    const closeTransferModalBtn = document.getElementById('closeTransferModalBtn');
    const transferForm = document.getElementById('transferForm');
    
    if (transferModal && addTransferBtn) {
        document.getElementById('tfDate').valueAsDate = new Date();
        addTransferBtn.addEventListener('click', () => transferModal.classList.add('active'));
        closeTransferModalBtn.addEventListener('click', () => transferModal.classList.remove('active'));
        transferModal.addEventListener('click', (e) => { if(e.target === transferModal) transferModal.classList.remove('active'); });

        transferForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newTf = {
                id: Date.now().toString(),
                type: document.getElementById('tfType').value,
                date: document.getElementById('tfDate').value,
                person: document.getElementById('tfPerson').value,
                amount: parseFloat(document.getElementById('tfAmount').value)
            };
            if(!state.transfers) state.transfers = [];
            state.transfers.push(newTf);
            await saveData();
            updateTransfersView();
            transferForm.reset();
            document.getElementById('tfDate').valueAsDate = new Date();
            transferModal.classList.remove('active');
        });
    }
}

function updateTransfersView() {
    if(!state.transfers) state.transfers = [];
    const sent = state.transfers.filter(t => t.type === 'sent').reduce((s,t) => s + parseFloat(t.amount), 0);
    const received = state.transfers.filter(t => t.type === 'received').reduce((s,t) => s + parseFloat(t.amount), 0);
    
    document.getElementById('totalTransferSent').textContent = formatCurrency(sent);
    document.getElementById('totalTransferReceived').textContent = formatCurrency(received);

    // Update Chart
    const ctx = document.getElementById('transfersChart').getContext('2d');
    const monthlyData = {};
    state.transfers.forEach(t => {
        const month = t.date.substring(0, 7);
        if(!monthlyData[month]) monthlyData[month] = { sent: 0, received: 0 };
        monthlyData[month][t.type] += parseFloat(t.amount);
    });

    const months = Object.keys(monthlyData).sort();
    const formattedLabels = months.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, parseInt(month)-1, 1).toLocaleDateString('es-ES', {month:'short', year:'numeric'});
    });
    
    if(transfersChartInstance) transfersChartInstance.destroy();
    transfersChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: formattedLabels,
            datasets: [
                { label: 'Enviado', data: months.map(m => monthlyData[m].sent), backgroundColor: '#8b5cf6', borderRadius: 4 },
                { label: 'Recibido', data: months.map(m => monthlyData[m].received), backgroundColor: '#10b981', borderRadius: 4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });

    // Update grouped table
    const container = document.getElementById('transferGroupsContainer');
    container.innerHTML = '';
    
    const byPerson = {};
    state.transfers.forEach(t => {
        if(!byPerson[t.person]) byPerson[t.person] = [];
        byPerson[t.person].push(t);
    });

    for(const person in byPerson) {
        let groupHTML = `<div class="person-group" style="margin-bottom: 24px; padding: 16px; background: rgba(0,0,0,0.15); border-radius: 12px; border: 1px solid var(--glass-border);">`;
        groupHTML += `<h4 style="border-bottom: 1px solid var(--glass-border); padding-bottom: 8px; margin-bottom: 12px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;"><i class="ph ph-user" style="font-size: 1.2rem; color: var(--primary-color);"></i> ${person}</h4>`;
        groupHTML += `<table style="margin-bottom: 0;"><thead><tr><th style="padding: 8px;">Fecha</th><th style="padding: 8px;">Tipo</th><th style="padding: 8px;">Monto</th></tr></thead><tbody>`;
        
        const sorted = byPerson[person].sort((a,b) => new Date(b.date) - new Date(a.date));
        sorted.forEach(t => {
            const typeLabel = t.type === 'sent' ? '<span class="tag" style="background:#8b5cf640; color:#8b5cf6">Envío</span>' : '<span class="tag" style="background:#10b98140; color:#10b981">Recibido</span>';
            const amountColor = t.type === 'sent' ? '#e2e8f0' : '#10b981';
            groupHTML += `<tr><td style="padding: 12px 8px;">${formatDate(t.date)}</td><td style="padding: 12px 8px;">${typeLabel}</td><td style="padding: 12px 8px; color:${amountColor}; font-weight:600;">${formatCurrency(t.amount)}</td></tr>`;
        });
        groupHTML += `</tbody></table></div>`;
        container.innerHTML += groupHTML;
    }
}

// Boot
supabase.auth.onAuthStateChange(async (event, session) => {
    const authC = document.getElementById('authContainer');
    const appC = document.getElementById('appContainer');
    
    if (session) {
        currentUser = session.user.id;
        authC.style.display = 'none';
        appC.style.display = 'flex';
        document.getElementById('userAvatar').textContent = session.user.email.substring(0, 2).toUpperCase();
        await initApp();
    } else {
        currentUser = null;
        authC.style.display = 'flex';
        appC.style.display = 'none';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    // Intenta recuperar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
            document.getElementById('authContainer').style.display = 'flex';
            document.getElementById('appContainer').style.display = 'none';
        }
    });
});
