/**
 * YouPi — Main Application Controller & View Renderer
 */
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupNavigation();
    setupEventListeners();
    setupShortcuts();
    
    // Initial fetch
    await refreshAllData();
    YouPiState.addLog('YouPi Offline Mesh node initialized and ready.', 'SYSTEM');
    
    // Auto-polling every 3 seconds for real-time mesh simulation updates
    YouPiState.autoRefreshTimer = setInterval(refreshAllData, 3000);
    
    // Subscribe UI renderer to state changes
    YouPiState.subscribe(() => renderUI());
    
    renderUI();
}

/**
 * Navigation handler between pages (SPA routing)
 */
function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link, .stat-link, .card-action-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetPage = link.getAttribute('data-page');
            if (targetPage) {
                e.preventDefault();
                navigateTo(targetPage);
            }
        });
    });
}

function navigateTo(pageId) {
    YouPiState.setPage(pageId);
    
    // Update sidebar active link
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        if (link.getAttribute('data-page') === pageId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Update active page view
    document.querySelectorAll('.page-view').forEach(view => {
        if (view.id === `page-${pageId}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });

    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.navigateTo = navigateTo;

/**
 * Fetch and synchronize data from the Spring Boot backend
 */
async function refreshAllData() {
    try {
        const [mesh, accounts, transactions] = await Promise.all([
            YouPiAPI.getMeshState(),
            YouPiAPI.getAccounts(),
            YouPiAPI.getTransactions()
        ]);

        YouPiState.meshState = mesh;
        YouPiState.accounts = accounts;
        YouPiState.transactions = transactions;

        renderUI();
    } catch (err) {
        console.error('Error refreshing mesh state:', err);
    }
}

/**
 * Render all components and pages based on current state
 */
function renderUI() {
    renderHeaderStats();
    renderSidebarStatus();
    renderDashboard();
    renderSendPaymentPage();
    renderReceivePaymentPage();
    renderMeshDevicesPage();
    renderAccountBalancesPage();
    renderTransactionLedgerPage();
    renderLogDetailsPage();
    renderSettingsPage();
}

/* ==========================================================================
   RENDERERS FOR HEADER, SIDEBAR, DASHBOARD
   ========================================================================== */

function renderHeaderStats() {
    const devices = YouPiState.meshState.devices || [];
    const count = devices.length;
    const badgeText = `${count} devices nearby`;
    
    const badgeEl = document.getElementById('header-mesh-status');
    if (badgeEl) {
        badgeEl.innerHTML = `
            <span class="pulse-dot"></span>
            <span>Mesh Network Active</span>
            <span style="opacity: 0.7; font-weight: 500;">(${badgeText})</span>
        `;
    }
}

function renderSidebarStatus() {
    const devices = YouPiState.meshState.devices || [];
    const count = devices.length;
    const el = document.getElementById('sidebar-device-count');
    if (el) {
        el.textContent = `${count} devices nearby`;
    }
}

function renderDashboard() {
    const devices = YouPiState.meshState.devices || [];
    const accounts = YouPiState.accounts || [];
    const txs = YouPiState.transactions || [];
    
    // Top stat cards
    const statDevices = document.getElementById('stat-nearby-devices');
    if (statDevices) statDevices.textContent = devices.length;

    // Calculate total packets currently in the mesh
    let totalHeldPackets = 0;
    devices.forEach(d => { totalHeldPackets += (d.packetCount || 0); });
    
    const statHops = document.getElementById('stat-total-hops');
    if (statHops) statHops.textContent = totalHeldPackets > 0 ? totalHeldPackets : (txs.length > 0 ? txs[0].hopCount || 4 : 4);

    // Populate sender and receiver select options
    populateSelectOptions('senderVpa', accounts);
    populateSelectOptions('receiverVpa', accounts, 'bob@demo');

    // Populate Send Page options as well
    populateSelectOptions('sendPage-senderVpa', accounts);
    populateSelectOptions('sendPage-receiverVpa', accounts, 'bob@demo');

    // Render Mesh Devices Preview on Dashboard
    const previewDevices = document.getElementById('dashboard-devices-preview');
    if (previewDevices) {
        previewDevices.innerHTML = devices.map(d => `
            <div class="device-item ${d.hasInternet ? 'bridge' : ''}" onclick="openDeviceModal('${d.deviceId}')">
                <div class="device-left">
                    <span class="device-name">${d.deviceId}</span>
                    <span class="device-tag ${d.hasInternet ? 'online' : 'offline'}">
                        ${d.hasInternet ? '🌐 4G BRIDGE' : '🚫 OFFLINE'}
                    </span>
                </div>
                <div class="device-right">
                    <span class="packet-pill-count">holding ${d.packetCount} packet(s)</span>
                    <svg class="device-arrow" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </div>
            </div>
        `).join('');
    }

    // Render Account Balances Preview
    const previewAccounts = document.querySelector('#dashboard-accounts-table tbody');
    if (previewAccounts) {
        previewAccounts.innerHTML = accounts.map(a => `
            <tr>
                <td class="vpa-cell">${escapeHtml(a.vpa)}</td>
                <td>${escapeHtml(a.holderName)}</td>
                <td class="balance-cell">₹${parseFloat(a.balance).toFixed(2)}</td>
            </tr>
        `).join('');
    }

    const cacheInfo = document.getElementById('dashboard-cache-info');
    if (cacheInfo) {
        cacheInfo.textContent = `Idempotency cache size: ${YouPiState.meshState.idempotencyCacheSize || 0}`;
    }

    // Render Transaction Ledger Preview (Top 5)
    const previewTxs = document.querySelector('#dashboard-tx-table tbody');
    if (previewTxs) {
        if (txs.length === 0) {
            previewTxs.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">No transactions recorded yet. Inject a payment to begin!</td></tr>`;
        } else {
            previewTxs.innerHTML = txs.slice(0, 5).map(t => formatTransactionRow(t)).join('');
        }
    }

    // Render Activity Log Preview
    const terminalPreview = document.getElementById('dashboard-terminal-logs');
    if (terminalPreview) {
        terminalPreview.textContent = YouPiState.logs.map(l => l.raw).join('\n');
    }
}

function formatTransactionRow(t) {
    const timeStr = t.settledAt ? new Date(t.settledAt).toLocaleTimeString('en-US', { hour12: true }) : '-';
    return `
        <tr>
            <td style="font-family: var(--font-mono); font-weight: 600;">${t.id}</td>
            <td>${escapeHtml(t.senderVpa)}</td>
            <td>${escapeHtml(t.receiverVpa)}</td>
            <td class="balance-cell">₹${parseFloat(t.amount).toFixed(2)}</td>
            <td><span class="badge-status status-${t.status}">${t.status}</span></td>
            <td><span style="font-family: var(--font-mono); font-size: 12px;">${escapeHtml(t.bridgeNodeId || 'phone-bridge')}</span></td>
            <td style="font-family: var(--font-mono); font-weight: 600; text-align: center;">${t.hopCount}</td>
            <td style="font-size: 12px; color: var(--text-muted);">${timeStr}</td>
        </tr>
    `;
}

function populateSelectOptions(selectId, accounts, defaultVal) {
    const select = document.getElementById(selectId);
    if (!select || select.dataset.populated === 'true') return;
    
    select.innerHTML = accounts.map(a => `
        <option value="${a.vpa}" ${defaultVal && a.vpa === defaultVal ? 'selected' : ''}>
            ${a.vpa} (${a.holderName})
        </option>
    `).join('');
    select.dataset.populated = 'true';
}

/* ==========================================================================
   PAGE: SEND PAYMENT
   ========================================================================== */
function renderSendPaymentPage() {
    // Dynamic updates for the dedicated send payment page
}

/* ==========================================================================
   PAGE: RECEIVE PAYMENT
   ========================================================================== */
function renderReceivePaymentPage() {
    const select = document.getElementById('receive-account-select');
    if (select && select.dataset.populated !== 'true' && YouPiState.accounts.length > 0) {
        select.innerHTML = YouPiState.accounts.map(a => `
            <option value="${a.vpa}">${a.holderName} (${a.vpa}) - Balance: ₹${parseFloat(a.balance).toFixed(2)}</option>
        `).join('');
        select.dataset.populated = 'true';
        updateReceiveQR();
    }
}

function updateReceiveQR() {
    const vpa = document.getElementById('receive-account-select')?.value || 'alice@demo';
    const amount = document.getElementById('receive-amount-input')?.value || '500';
    const qrContainer = document.getElementById('receive-qr-code');
    const uriText = document.getElementById('receive-upi-uri');
    
    const upiUri = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=YouPi%20User&am=${amount}&cu=INR&mode=04`; // Mode 04 represents offline mesh
    
    if (uriText) uriText.textContent = upiUri;
    
    if (qrContainer) {
        // Render crisp visual QR Code placeholder representation
        qrContainer.innerHTML = `
            <div style="background: white; padding: 16px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                <svg width="180" height="180" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="100" fill="white"/>
                    <!-- QR Corner 1 -->
                    <rect x="5" y="5" width="26" height="26" rx="4" stroke="#0f172a" stroke-width="4"/>
                    <rect x="11" y="11" width="14" height="14" rx="2" fill="#2563eb"/>
                    <!-- QR Corner 2 -->
                    <rect x="69" y="5" width="26" height="26" rx="4" stroke="#0f172a" stroke-width="4"/>
                    <rect x="75" y="11" width="14" height="14" rx="2" fill="#2563eb"/>
                    <!-- QR Corner 3 -->
                    <rect x="5" y="69" width="26" height="26" rx="4" stroke="#0f172a" stroke-width="4"/>
                    <rect x="11" y="75" width="14" height="14" rx="2" fill="#2563eb"/>
                    <!-- Mesh Data Matrix elements -->
                    <rect x="36" y="10" width="6" height="6" fill="#0f172a"/>
                    <rect x="46" y="10" width="14" height="6" fill="#0f172a"/>
                    <rect x="36" y="20" width="14" height="6" fill="#2563eb"/>
                    <rect x="54" y="20" width="6" height="6" fill="#0f172a"/>
                    <rect x="10" y="36" width="6" height="14" fill="#0f172a"/>
                    <rect x="20" y="44" width="6" height="6" fill="#0f172a"/>
                    <rect x="36" y="36" width="28" height="28" rx="4" fill="#eff6ff" stroke="#bfdbfe"/>
                    <circle cx="50" cy="50" r="8" fill="#2563eb"/>
                    <path d="M47 50L49 52L53 48" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                    <rect x="68" y="36" width="12" height="6" fill="#0f172a"/>
                    <rect x="84" y="36" width="6" height="14" fill="#0f172a"/>
                    <rect x="68" y="48" width="8" height="6" fill="#2563eb"/>
                    <rect x="80" y="48" width="10" height="6" fill="#0f172a"/>
                    <rect x="36" y="68" width="6" height="12" fill="#0f172a"/>
                    <rect x="46" y="68" width="16" height="6" fill="#0f172a"/>
                    <rect x="46" y="78" width="8" height="12" fill="#2563eb"/>
                    <rect x="58" y="82" width="12" height="8" fill="#0f172a"/>
                    <rect x="74" y="68" width="21" height="6" fill="#0f172a"/>
                    <rect x="74" y="78" width="6" height="12" fill="#0f172a"/>
                    <rect x="84" y="84" width="11" height="6" fill="#2563eb"/>
                </svg>
            </div>
        `;
    }
}

window.updateReceiveQR = updateReceiveQR;

/* ==========================================================================
   PAGE: MESH DEVICES
   ========================================================================== */
function renderMeshDevicesPage() {
    const devices = YouPiState.meshState.devices || [];
    const container = document.getElementById('full-devices-grid');
    if (!container) return;

    container.innerHTML = devices.map(d => `
        <div class="device-card-rich ${d.hasInternet ? 'is-bridge' : ''}">
            <div class="device-card-header">
                <div>
                    <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">${d.deviceId}</h3>
                    <span style="font-size: 12px; color: var(--text-muted);">${d.hasInternet ? '4G Gateway / Bridge Node' : 'Offline Mesh Relay Node'}</span>
                </div>
                <span class="device-badge-large ${d.hasInternet ? 'online' : 'offline'}">
                    ${d.hasInternet ? '🌐 Online' : '🚫 Offline'}
                </span>
            </div>

            <div class="device-meta-row">
                <span class="device-meta-label">Network Interface:</span>
                <span class="device-meta-val">${d.hasInternet ? 'BLE 5.2 + LTE/4G' : 'BLE Mesh Only'}</span>
            </div>
            <div class="device-meta-row">
                <span class="device-meta-label">Held Packets:</span>
                <span class="device-meta-val" style="color: var(--accent);">${d.packetCount} in memory</span>
            </div>
            <div class="device-meta-row">
                <span class="device-meta-label">Mesh Role:</span>
                <span class="device-meta-val">${d.hasInternet ? 'Ingestion Gateway' : 'Gossip Relay'}</span>
            </div>

            <div class="held-packets-box">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
                    Packet Queue (${d.packetIds ? d.packetIds.length : 0})
                </div>
                <div>
                    ${d.packetIds && d.packetIds.length > 0
                        ? d.packetIds.map(id => `<span class="held-packet-id">${id}</span>`).join('')
                        : '<span style="font-size: 12px; color: var(--text-muted);">No packets buffered</span>'}
                </div>
            </div>
        </div>
    `).join('');
}

/* ==========================================================================
   PAGE: ACCOUNT BALANCES
   ========================================================================== */
function renderAccountBalancesPage() {
    const accounts = YouPiState.accounts || [];
    const tbody = document.querySelector('#full-accounts-table tbody');
    if (!tbody) return;

    let totalLiquidity = 0;
    accounts.forEach(a => { totalLiquidity += parseFloat(a.balance); });

    const totalEl = document.getElementById('accounts-total-liquidity');
    if (totalEl) totalEl.textContent = `₹${totalLiquidity.toFixed(2)}`;

    tbody.innerHTML = accounts.map(a => `
        <tr>
            <td class="vpa-cell" style="font-size: 14px;">${escapeHtml(a.vpa)}</td>
            <td style="font-weight: 600;">${escapeHtml(a.holderName)}</td>
            <td class="balance-cell" style="font-size: 15px;">₹${parseFloat(a.balance).toFixed(2)}</td>
            <td><span class="badge-status status-SETTLED">ACTIVE</span></td>
        </tr>
    `).join('');

    const cacheEl = document.getElementById('full-accounts-cache-size');
    if (cacheEl) {
        cacheEl.textContent = `${YouPiState.meshState.idempotencyCacheSize || 0} entries`;
    }
}

/* ==========================================================================
   PAGE: TRANSACTION LEDGER
   ========================================================================== */
function renderTransactionLedgerPage() {
    const txs = YouPiState.transactions || [];
    const tbody = document.querySelector('#full-tx-table tbody');
    if (!tbody) return;

    const filter = document.getElementById('tx-status-filter')?.value || 'ALL';
    const query = (document.getElementById('tx-search-input')?.value || '').toLowerCase();

    let filtered = txs.filter(t => {
        const matchesFilter = (filter === 'ALL' || t.status === filter);
        const matchesQuery = !query || 
            t.senderVpa.toLowerCase().includes(query) ||
            t.receiverVpa.toLowerCase().includes(query) ||
            (t.bridgeNodeId && t.bridgeNodeId.toLowerCase().includes(query)) ||
            String(t.id).includes(query);
        return matchesFilter && matchesQuery;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">No matching transactions found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(t => formatTransactionRow(t)).join('');
}

/* ==========================================================================
   PAGE: LOG DETAILS
   ========================================================================== */
function renderLogDetailsPage() {
    const fullTerminal = document.getElementById('full-terminal-logs');
    if (!fullTerminal) return;

    const filter = YouPiState.logFilter || 'All';
    const search = (document.getElementById('log-search-input')?.value || '').toLowerCase();

    let filteredLogs = YouPiState.logs.filter(l => {
        const matchesCategory = (filter === 'All' || l.category.toUpperCase() === filter.toUpperCase());
        const matchesSearch = !search || l.message.toLowerCase().includes(search);
        return matchesCategory && matchesSearch;
    });

    fullTerminal.textContent = filteredLogs.map(l => l.raw).join('\n');

    if (YouPiState.autoScrollLogs) {
        fullTerminal.scrollTop = 0;
    }
}

/* ==========================================================================
   PAGE: SETTINGS
   ========================================================================== */
async function renderSettingsPage() {
    const keyBox = document.getElementById('settings-server-key');
    if (keyBox && !YouPiState.serverKey) {
        try {
            const keyInfo = await YouPiAPI.getServerKey();
            YouPiState.serverKey = keyInfo;
            keyBox.textContent = JSON.stringify(keyInfo, null, 2);
        } catch (e) {
            keyBox.textContent = 'Server key not fetched: ' + e.message;
        }
    }
}

/* ==========================================================================
   EVENT LISTENERS & FORM HANDLERS
   ========================================================================== */
function setupEventListeners() {
    // Quick Amount Chips on Dashboard
    document.querySelectorAll('.quick-amount-chips .chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-val');
            const amtInput = document.getElementById('amount');
            if (amtInput) amtInput.value = val;
            
            document.querySelectorAll('.quick-amount-chips .chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Quick Amount Chips on Dedicated Send Page
    document.querySelectorAll('#sendPage-chips .chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-val');
            const amtInput = document.getElementById('sendPage-amount');
            if (amtInput) amtInput.value = val;
            
            document.querySelectorAll('#sendPage-chips .chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // PIN toggle visibility
    const pinToggle = document.getElementById('pin-toggle-btn');
    if (pinToggle) {
        pinToggle.addEventListener('click', () => {
            const pinInput = document.getElementById('pin');
            if (pinInput.type === 'password') {
                pinInput.type = 'text';
            } else {
                pinInput.type = 'password';
            }
        });
    }

    // Global Search input
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val.length > 0 && YouPiState.activePage === 'dashboard') {
                navigateTo('transaction-ledger');
                const txSearch = document.getElementById('tx-search-input');
                if (txSearch) {
                    txSearch.value = val;
                    renderTransactionLedgerPage();
                }
            }
        });
    }

    // Filter chips for logs
    document.querySelectorAll('.log-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.log-filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            YouPiState.logFilter = chip.getAttribute('data-filter');
            renderLogDetailsPage();
        });
    });
}

function setupShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            const s = document.getElementById('global-search');
            if (s) s.focus();
        }
    });
}

/* ==========================================================================
   ACTIONS: SEND, GOSSIP, FLUSH, RESET
   ========================================================================== */

// 1. Send Payment Action
async function handleSendPayment(isDedicatedPage = false) {
    const prefix = isDedicatedPage ? 'sendPage-' : '';
    const sender = document.getElementById(`${prefix}senderVpa`)?.value;
    const receiver = document.getElementById(`${prefix}receiverVpa`)?.value;
    const amountVal = parseFloat(document.getElementById(`${prefix}amount`)?.value || '0');
    const pinVal = document.getElementById(`${prefix}pin`)?.value;
    const ttlVal = parseInt(document.getElementById(`${prefix}ttl`)?.value || '5');

    if (!sender || !receiver) {
        alert('Please select both sender and receiver accounts.');
        return;
    }
    if (sender === receiver) {
        alert('Sender and Receiver cannot be the same account.');
        return;
    }
    if (isNaN(amountVal) || amountVal <= 0) {
        alert('Please enter a valid amount greater than 0.');
        return;
    }
    if (!pinVal || pinVal.length !== 4) {
        alert('Please enter a valid 4-digit UPI PIN.');
        return;
    }

    const injectBtn = document.getElementById(`${prefix}btn-inject`);
    if (injectBtn) {
        injectBtn.disabled = true;
        injectBtn.innerHTML = `<span>Encrypting & Injecting...</span>`;
    }

    try {
        const payload = {
            senderVpa: sender,
            receiverVpa: receiver,
            amount: amountVal,
            pin: pinVal,
            ttl: ttlVal,
            startDevice: 'phone-alice'
        };

        const res = await YouPiAPI.injectPayment(payload);
        
        YouPiState.addLog(`📤 Packet ${res.packetId.substring(0, 8)} encrypted & injected at ${res.injectedAt} (TTL ${res.ttl})`, 'PAYMENT');
        YouPiState.addLog(`🔐 Ciphertext (truncated): ${res.ciphertextPreview}`, 'PAYMENT');
        
        // Refresh state
        await refreshAllData();
        
        // Show success notification banner
        showNotification(`Payment packet ₹${amountVal} injected into mesh via ${res.injectedAt}!`);
    } catch (err) {
        YouPiState.addLog(`❌ Error injecting payment: ${err.message}`, 'ERRORS');
        alert(`Payment Failed: ${err.message}`);
    } finally {
        if (injectBtn) {
            injectBtn.disabled = false;
            injectBtn.innerHTML = `
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
                <span>Inject into Mesh</span>
            `;
        }
    }
}

window.handleSendPayment = handleSendPayment;

// 2. Gossip Action
async function handleGossip() {
    try {
        const res = await YouPiAPI.runGossip();
        YouPiState.addLog(`🔄 Gossip: ${res.transfers} transfer(s) → ${JSON.stringify(res.deviceCounts)}`, 'MESH');
        await refreshAllData();
    } catch (err) {
        YouPiState.addLog(`❌ Gossip round failed: ${err.message}`, 'ERRORS');
    }
}

window.handleGossip = handleGossip;

// 3. Flush Bridges Action
async function handleFlushBridges() {
    try {
        const res = await YouPiAPI.flushBridges();
        YouPiState.addLog(`🛰 ${res.uploadsAttempted} bridge upload(s):`, 'BRIDGE');
        if (res.results && res.results.length > 0) {
            res.results.forEach(r => {
                const reasonStr = r.reason ? ` (${r.reason})` : '';
                YouPiState.addLog(`   ${r.bridgeNode} packet ${r.packetId} → ${r.outcome}${reasonStr}`, 'BRIDGE');
            });
        }
        await refreshAllData();
    } catch (err) {
        YouPiState.addLog(`❌ Bridge flush failed: ${err.message}`, 'ERRORS');
    }
}

window.handleFlushBridges = handleFlushBridges;

// 4. Reset Mesh Action
async function handleResetMesh() {
    if (!confirm('Are you sure you want to reset mesh buffers and clear idempotency cache?')) return;
    try {
        await YouPiAPI.resetMesh();
        YouPiState.addLog('🗑 Mesh buffers + Idempotency cache cleared.', 'SYSTEM');
        await refreshAllData();
    } catch (err) {
        YouPiState.addLog(`❌ Reset failed: ${err.message}`, 'ERRORS');
    }
}

window.handleResetMesh = handleResetMesh;

// 5. Clear Logs Action
function handleClearLogs() {
    YouPiState.clearLogs();
    YouPiState.addLog('Console logs cleared.', 'SYSTEM');
}

window.handleClearLogs = handleClearLogs;

// 6. Export Logs Action
function handleExportLogs() {
    const logData = YouPiState.logs.map(l => l.raw).join('\n');
    const blob = new Blob([logData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youpi-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

window.handleExportLogs = handleExportLogs;

// 7. Device Modal
function openDeviceModal(deviceId) {
    const device = (YouPiState.meshState.devices || []).find(d => d.deviceId === deviceId);
    if (!device) return;

    const modal = document.getElementById('device-modal');
    const content = document.getElementById('device-modal-content');
    if (!modal || !content) return;

    content.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h4 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${device.deviceId}</h4>
            <span class="device-tag ${device.hasInternet ? 'online' : 'offline'}" style="font-size: 12px;">
                ${device.hasInternet ? '🌐 4G BRIDGE NODE' : '🚫 OFFLINE MESH RELAY'}
            </span>
        </div>
        <div class="device-meta-row">
            <span class="device-meta-label">Connectivity:</span>
            <span class="device-meta-val">${device.hasInternet ? 'Full Internet (LTE/4G)' : 'None (Bluetooth Mesh Only)'}</span>
        </div>
        <div class="device-meta-row">
            <span class="device-meta-label">Held Packets:</span>
            <span class="device-meta-val">${device.packetCount} packets</span>
        </div>
        <div class="device-meta-row">
            <span class="device-meta-label">Packet IDs in Buffer:</span>
            <span class="device-meta-val" style="font-family: var(--font-mono); font-size: 12px;">
                ${device.packetIds && device.packetIds.length > 0 ? device.packetIds.join(', ') : 'None'}
            </span>
        </div>
        <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
            <button class="btn-primary-inject" style="width: auto; padding: 0 20px; height: 40px;" onclick="closeDeviceModal()">Close</button>
        </div>
    `;
    modal.classList.add('active');
}

function closeDeviceModal() {
    const modal = document.getElementById('device-modal');
    if (modal) modal.classList.remove('active');
}

window.openDeviceModal = openDeviceModal;
window.closeDeviceModal = closeDeviceModal;

// Utility toast notification
function showNotification(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #0f172a;
        color: #ffffff;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 13.5px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid rgba(255,255,255,0.1);
        animation: fadeIn 0.3s ease-out;
    `;
    toast.innerHTML = `<span>⚡</span><span>${escapeHtml(msg)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
