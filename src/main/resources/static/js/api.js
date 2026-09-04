/**
 * YouPi API Service Layer
 * Interfaces directly with existing Spring Boot backend endpoints.
 */
const YouPiAPI = {
    // 1. Fetch Mesh State (devices, packet counts, idempotency size)
    async getMeshState() {
        const res = await fetch('/api/mesh/state');
        if (!res.ok) throw new Error(`Failed to fetch mesh state: ${res.statusText}`);
        return await res.json();
    },

    // 2. Fetch Accounts
    async getAccounts() {
        const res = await fetch('/api/accounts');
        if (!res.ok) throw new Error(`Failed to fetch accounts: ${res.statusText}`);
        return await res.json();
    },

    // 3. Fetch Transactions
    async getTransactions() {
        const res = await fetch('/api/transactions');
        if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.statusText}`);
        return await res.json();
    },

    // 4. Fetch Server Public Key
    async getServerKey() {
        const res = await fetch('/api/server-key');
        if (!res.ok) throw new Error(`Failed to fetch server key: ${res.statusText}`);
        return await res.json();
    },

    // 5. Send Payment / Inject into Mesh
    async injectPayment(payload) {
        const res = await fetch('/api/demo/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Payment injection failed: ${res.statusText}`);
        }
        return await res.json();
    },

    // 6. Run Gossip Round
    async runGossip() {
        const res = await fetch('/api/mesh/gossip', { method: 'POST' });
        if (!res.ok) throw new Error(`Gossip round failed: ${res.statusText}`);
        return await res.json();
    },

    // 7. Flush Bridges (Simulate 4G upload)
    async flushBridges() {
        const res = await fetch('/api/mesh/flush', { method: 'POST' });
        if (!res.ok) throw new Error(`Bridge flush failed: ${res.statusText}`);
        return await res.json();
    },

    // 8. Reset Mesh & Cache
    async resetMesh() {
        const res = await fetch('/api/mesh/reset', { method: 'POST' });
        if (!res.ok) throw new Error(`Mesh reset failed: ${res.statusText}`);
        return await res.json();
    }
};

window.YouPiAPI = YouPiAPI;
