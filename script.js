// STATE MANAGEMENT & DATA DEFAULT
let currentUser = null;
let appData = {
    users: [], // {username, password}
    transactions: [], // {id, user, type, category, amount, date}
    bills: [], // {id, user, name, amount, date}
    debts: [] // {id, user, type, person, amount, date}
};

// LOAD DARI LOCALSTORAGE
if(localStorage.getItem('bijakuang_data')) {
    appData = JSON.parse(localStorage.getItem('bijakuang_data'));
}

// INSTANCE GRAFIK GLOBAL (Agar bisa dihancurkan/update pas manipulasi tab)
let trenChartInstance = null;
let pieChartInstance = null;
let barChartInstance = null;

// INISIALISASI UNTUK FITUR AUTH & BOOTSTRAPPER APP
document.addEventListener("DOMContentLoaded", () => {
    initAuth();
    // Default Tanggal Input Hari ini untuk user-experience mumpuni
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('tx-date')) document.getElementById('tx-date').value = today;
    if(document.getElementById('bill-date')) document.getElementById('bill-date').value = today;
    if(document.getElementById('debt-date')) document.getElementById('debt-date').value = today;
});

function saveState() {
    localStorage.setItem('bijakuang_data', JSON.stringify(appData));
}

// 1. DASHBOARD LOGIN & REGISTRASI MANAGEMENT
let isLoginMode = true;
function initAuth() {
    const authForm = document.getElementById('auth-form');
    const toggleAuth = document.getElementById('toggle-auth-mode');
    
    toggleAuth.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        document.getElementById('auth-title').innerText = isLoginMode ? "Masuk ke Bijak Uang" : "Daftar Akun Baru";
        document.getElementById('btn-auth-submit').innerText = isLoginMode ? "Masuk" : "Daftar";
        toggleAuth.innerText = isLoginMode ? "Daftar sekarang" : "Sudah punya akun? Masuk";
    });

    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userIn = document.getElementById('username').value.trim();
        const passIn = document.getElementById('password').value;

        if(isLoginMode) {
            // Login Logic
            const found = appData.users.find(u => u.username === userIn && u.password === passIn);
            if(found) {
                loginSuccess(userIn);
            } else {
                alert("Username atau Password salah!");
            }
        } else {
            // Registrasi Logic
            if(appData.users.some(u => u.username === userIn)) {
                alert("Username sudah terdaftar!");
                return;
            }
            appData.users.push({username: userIn, password: passIn});
            saveState();
            alert("Registrasi Berhasil! Silakan Masuk.");
            toggleAuth.click();
        }
    });
}

function loginSuccess(username) {
    currentUser = username;
    document.getElementById('user-display').innerText = username;
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    // Tarik data aplikasi
    switchTab('dashboard');
}

function logout() {
    currentUser = null;
    document.getElementById('auth-form').reset();
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
}

// HANDLING TAB SWITCHER
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // Set Active Button UI
    const indexMapping = { 'dashboard': 0, 'laporan': 1, 'tagihan': 2, 'hutang': 3 };
    document.querySelectorAll('.nav-item')[indexMapping[tabId]].classList.add('active');

    // Trigger Re-Render Modul yang Dituju
    if(tabId === 'dashboard') renderDashboard();
    if(tabId === 'laporan') renderLaporan();
    if(tabId === 'tagihan') renderTagihan();
    if(tabId === 'hutang') renderHutang();
}

// INDONESIAN IDR CURRENCY FORMATTER
function formatIDR(num) {
    return 'Rp ' + parseFloat(num).toLocaleString('id-ID');
}

// 2. MODUL DASHBOARD UTAMA & TRANSAKSI
document.getElementById('form-transaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('tx-type').value;
    const category = document.getElementById('tx-category').value.trim();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const date = document.getElementById('tx-date').value;

    appData.transactions.push({
        id: Date.now().toString(),
        user: currentUser,
        type, category, amount, date
    });
    
    saveState();
    document.getElementById('form-transaction').reset();
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
    renderDashboard();
    alert('Transaksi berhasil ditambahkan!');
});

function renderDashboard() {
    const myTx = appData.transactions.filter(t => t.user === currentUser);
    
    let totalIncome = 0;
    let totalExpense = 0;
    
    // Perhitungan kalkulasi bulan berjalan (Current Month Context)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    myTx.forEach(t => {
        const tDate = new Date(t.date);
        if(tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
            if(t.type === 'pemasukan') totalIncome += t.amount;
            if(t.type === 'pengeluaran') totalExpense += t.amount;
        }
    });

    // Hitung seluruh total saldo mutlak
    let grandSaldo = 0;
    myTx.forEach(t => {
        if(t.type === 'pemasukan') grandSaldo += t.amount;
        if(t.type === 'pengeluaran') grandSaldo -= t.amount;
    });

    document.getElementById('txt-total-saldo').innerText = formatIDR(grandSaldo);
    document.getElementById('txt-total-income').innerText = formatIDR(totalIncome);
    document.getElementById('txt-total-expense').innerText = formatIDR(totalExpense);

    buildTrenChart(myTx);
}

// CHART INTEGRATION: LINE CHART TREND
function buildTrenChart(txData) {
    const ctx = document.getElementById('chart-tren').getContext('2d');
    if(trenChartInstance) trenChartInstance.destroy();

    const labelBulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    let dataIncome = Array(12).fill(0);
    let dataExpense = Array(12).fill(0);

    txData.forEach(t => {
        const m = new Date(t.date).getMonth();
        if(t.type === 'pemasukan') dataIncome[m] += t.amount;
        if(t.type === 'pengeluaran') dataExpense[m] += t.amount;
    });

    trenChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labelBulan,
            datasets: [
                { label: 'Pemasukan', data: dataIncome, borderColor: '#3fa548', tension: 0.3, fill: false }, // Hijau Logo
                { label: 'Pengeluaran', data: dataExpense, borderColor: '#f87171', tension: 0.3, fill: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// 3. MODUL LAPORAN, ANALISIS & EKSPOR PDF
function renderLaporan() {
    const filter = document.getElementById('report-filter-select').value;
    let txs = appData.transactions.filter(t => t.user === currentUser);

    const now = new Date();
    
    // Filter Algoritma Temporal
    txs = txs.filter(t => {
        const d = new Date(t.date);
        if (filter === 'harian') return d.toDateString() === now.toDateString();
        if (filter === 'mingguan') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return d >= oneWeekAgo;
        }
        if (filter === 'bulanan') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (filter === 'tahunan') return d.getFullYear() === now.getFullYear();
        return true; // Semua Catatan
    });

    // Render Table Body
    const tbody = document.getElementById('table-tx-body');
    tbody.innerHTML = '';
    
    if(txs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Belum ada data pada periode ini</td></tr>`;
    }

    let catMap = {}; // Untuk Pie Chart Pengeluaran
    let totalIn = 0, totalOut = 0; // Untuk Bar Chart Cashflow

    txs.forEach(t => {
        if(t.type === 'pengeluaran') {
            catMap[t.category] = (catMap[t.category] || 0) + t.amount;
            totalOut += t.amount;
        } else {
            totalIn += t.amount;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.date}</td>
            <td><span class="badge">${t.type.toUpperCase()}</span></td>
            <td>${t.category}</td>
            <td class="tx-${t.type}">${formatIDR(t.amount)}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteTx('${t.id}')"><i class="fa-solid fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });

    buildLaporanCharts(catMap, totalIn, totalOut);
}

function deleteTx(id) {
    if(confirm('Apakah Anda yakin mau menghapus transaksi ini?')) {
        appData.transactions = appData.transactions.filter(t => t.id !== id);
        saveState();
        renderLaporan();
    }
}

function buildLaporanCharts(catMap, totalIn, totalOut) {
    // Pie Chart
    const ctxPie = document.getElementById('chart-pie-kategori').getContext('2d');
    if(pieChartInstance) pieChartInstance.destroy();
    
    const labels = Object.keys(catMap);
    const data = Object.values(catMap);

    pieChartInstance = new Chart(ctxPie, {
        type: 'pie',
        data: {
            labels: labels.length ? labels : ['Tidak Ada Pengeluaran'],
            datasets: [{
                data: data.length ? data : [0],
                backgroundColor: ['#f87171', '#1e70b8', '#f2bd1d', '#a78bfa', '#fb7185', '#e2e8f0']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Bar Chart Arus Kas
    const ctxBar = document.getElementById('chart-bar-cashflow').getContext('2d');
    if(barChartInstance) barChartInstance.destroy();

    barChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: ['Pemasukan', 'Pengeluaran'],
            datasets: [{
                label: 'Arus Kas',
                data: [totalIn, totalOut],
                backgroundColor: ['#3fa548', '#f87171']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function exportToPDF() {
    const element = document.getElementById('report-pdf-area');
    const opt = {
        margin:       10,
        filename:     `Laporan_Bijak_Uang_${currentUser}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, backgroundColor: '#0b0f19' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

// 4. MODUL PENGINGAT TAGIHAN & JATUH TEMPO
document.getElementById('form-bill').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('bill-name').value.trim();
    const amount = parseFloat(document.getElementById('bill-amount').value);
    const date = document.getElementById('bill-date').value;

    appData.bills.push({
        id: Date.now().toString(),
        user: currentUser,
        name, amount, date
    });
    saveState();
    document.getElementById('form-bill').reset();
    renderTagihan();
});

function renderTagihan() {
    const listContainer = document.getElementById('bill-list');
    listContainer.innerHTML = '';
    const myBills = appData.bills.filter(b => b.user === currentUser);

    if(myBills.length === 0) {
        listContainer.innerHTML = `<p style="color:var(--text-muted)">Tidak ada agenda tagihan.</p>`;
        return;
    }

    myBills.forEach(b => {
        const tglJatuhTempo = new Date(b.date);
        const hariIni = new Date();
        const selisihWaktu = tglJatuhTempo - hariIni;
        const selisihHari = Math.ceil(selisihWaktu / (1000 * 60 * 60 * 24));
        
        let borderClass = '';
        let infoHari = `Jatuh tempo dalam ${selisihHari} hari lagi`;
        if (selisihHari < 0) {
            borderClass = 'danger-border';
            infoHari = `Terlambat ${Math.abs(selisihHari)} hari!`;
        } else if (selisihHari <= 3) {
            borderClass = 'warning-border';
            infoHari = `Mendekati batas! (${selisihHari} hari lagi)`;
        }

        const div = document.createElement('div');
        div.className = `reminder-item ${borderClass}`;
        div.innerHTML = `
            <div class="reminder-info">
                <h4>${b.name} - <strong>${formatIDR(b.amount)}</strong></h4>
                <p><i class="fa-regular fa-calendar"></i> Tanggal: ${b.date} (${infoHari})</p>
            </div>
            <button class="btn btn-success btn-sm" onclick="payBill('${b.id}')"><i class="fa-solid fa-check"></i> Lunas</button>
        `;
        listContainer.appendChild(div);
    });
}

function payBill(id) {
    const target = appData.bills.find(b => b.id === id);
    if(target) {
        // Otomatis kurangi saldo konversi ke transaksi pengeluaran
        appData.transactions.push({
            id: Date.now().toString(),
            user: currentUser,
            type: 'pengeluaran',
            category: `Tagihan: ${target.name}`,
            amount: target.amount,
            date: new Date().toISOString().split('T')[0]
        });
        appData.bills = appData.bills.filter(b => b.id !== id);
        saveState();
        renderTagihan();
        alert('Tagihan berhasil dilunasi & dicatat pada pengeluaran!');
    }
}

// 5. MODUL MANAGEMENT HUTANG & PIUTANG
document.getElementById('form-debt').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('debt-type').value;
    const person = document.getElementById('debt-person').value.trim();
    const amount = parseFloat(document.getElementById('debt-amount').value);
    const date = document.getElementById('debt-date').value;

    appData.debts.push({
        id: Date.now().toString(),
        user: currentUser,
        type, person, amount, date
    });
    saveState();
    document.getElementById('form-debt').reset();
    renderHutang();
});

function renderHutang() {
    const listContainer = document.getElementById('debt-list');
    listContainer.innerHTML = '';
    const myDebts = appData.debts.filter(d => d.user === currentUser);

    if(myDebts.length === 0) {
        listContainer.innerHTML = `<p style="color:var(--text-muted)">Tidak ada catatan hutang atau piutang aktif.</p>`;
        return;
    }

    myDebts.forEach(d => {
        const isHutang = d.type === 'hutang';
        const colorBorder = isHutang ? 'danger-border' : 'warning-border';
        const tipeLabel = isHutang ? 'Hutang ke' : 'Piutang di';

        const div = document.createElement('div');
        div.className = `reminder-item ${colorBorder}`;
        div.innerHTML = `
            <div class="reminder-info">
                <h4>[${d.type.toUpperCase()}] ${tipeLabel} ${d.person}</h4>
                <p>Jumlah: <strong>${formatIDR(d.amount)}</strong></p>
                <p><i class="fa-regular fa-clock"></i> Batas Tenggat: ${d.date}</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="clearDebt('${d.id}')"><i class="fa-solid fa-handshake"></i> Selesai</button>
        `;
        listContainer.appendChild(div);
    });
}

function clearDebt(id) {
    if(confirm('Apakah urusan hutang/piutang ini sudah selesai terbayar?')) {
        appData.debts = appData.debts.filter(d => d.id !== id);
        saveState();
        renderHutang();
    }
}