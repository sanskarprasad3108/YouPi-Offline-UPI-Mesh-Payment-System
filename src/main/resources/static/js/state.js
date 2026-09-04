/**
 * YouPi Central State Management & Event Bus
 */
const YouPiState = {
    activePage: 'dashboard',
    meshState: {
        devices: [],
        idempotencyCacheSize: 0
    },
    accounts: [],
    transactions: [],
    serverKey: null,
    logs: [],
    maxLogs: 200,
    searchQuery: '',
    logFilter: 'All',
    autoScrollLogs: true,
    autoRefreshTimer: null,
    listeners: [],

    subscribe(fn) {
        this.listeners.push(fn);
    },

    notify() {
        this.listeners.forEach(fn => {
            try { fn(this); } catch (e) { console.error('State subscriber error', e); }
        });
    },

    addLog(message, category = 'SYSTEM') {
        const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
        const logEntry = {
            id: Date.now() + Math.random(),
            time: timeStr,
            message: message,
            category: category,
            raw: `[${timeStr}] ${message}`
        };
        this.logs.unshift(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
        this.notify();
    },

    clearLogs() {
        this.logs = [];
        this.notify();
    },

    setPage(page) {
        this.activePage = page;
        this.notify();
    }
};

window.YouPiState = YouPiState;
