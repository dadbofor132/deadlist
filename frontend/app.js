/**
 * DEADLIST - The Unfarmable Bounty Board
 * EVE Frontier x Sui Hackathon 2026
 *
 * Frontend Application with Sui Wallet Integration
 */

// =========================================
// Configuration
// =========================================

const CONFIG = {
    // Contract configuration - NEW IN-GAME INTEGRATED CONTRACT!
    PACKAGE_ID: '0x5b930f51f93a5dab4dfbe900b93bff29f627c67a1c26ff45bcf993c4ef97f47b',
    EXTENSION_CONFIG_ID: '0xc7ee1294fb6e5c3e81e3eca7fac9c5c0293c4b2dda1ccf34a663ea2e07e8526a',
    CLOCK_ID: '0x6', // Sui system Clock object ID

    // EVE Frontier World Package (Stillness)
    WORLD_PACKAGE_ID: '0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c',
    OBJECT_REGISTRY_ID: '0x454a9aa3d37e1d08d3c9181239c1b683781e4087fbbbd48c935d54b6736fd05c',

    // DEADLIST Bounty Terminal (your SSU)
    BOUNTY_TERMINAL_SSU_ID: '0xc23eac7c04cf3dd07f4f1b6012b752eb2226b9228d91ddd1fee88dd32371a427',
    BOUNTY_TERMINAL_OWNERCAP_ID: '0xfe102ffac465935f6eb7e2a98ddb4fdb9a347567ca53c6a2ea47b66a7427ccd0',

    // Your Character (owns the SSU OwnerCap)
    CHARACTER_ID: '0x97a7859499b8be93c85e77c7847e8117a2127d0e74a690a910a58a68b34859ad',

    // Network configuration
    NETWORK: 'testnet', // 'mainnet', 'testnet', or 'devnet'
    RPC_URL: {
        mainnet: 'https://fullnode.mainnet.sui.io:443',
        testnet: 'https://fullnode.testnet.sui.io:443',
        devnet: 'https://fullnode.devnet.sui.io:443',
    },
    GRAPHQL_URL: {
        mainnet: 'https://graphql.mainnet.sui.io/graphql',
        testnet: 'https://graphql.testnet.sui.io/graphql',
        devnet: 'https://graphql.devnet.sui.io/graphql',
    },

    // Module name
    MODULE_NAME: 'deadlist',
};

// =========================================
// Sui Wallet Integration
// =========================================

/**
 * SuiWalletManager - Handles all wallet interactions using the Sui Wallet Standard
 */
class SuiWalletManager {
    constructor() {
        this.wallet = null;
        this.account = null;
        this.wallets = [];
        this.suiClient = null;
        this.onConnectionChange = null;
        this._standardWallets = [];
    }

    /**
     * Initialize the wallet manager and detect available wallets
     */
    async init() {
        // Setup Wallet Standard listener FIRST
        this._setupWalletStandardListener();

        // Wait for wallet extensions to load
        await this.waitForWallets();

        // Get available wallets
        this.wallets = this.getAvailableWallets();

        console.log('[SuiWallet] Available wallets:', this.wallets.map(w => w.name));

        // Listen for wallet changes
        this.setupWalletListeners();

        return this.wallets;
    }

    /**
     * Setup listener for Wallet Standard registrations
     */
    _setupWalletStandardListener() {
        // The Wallet Standard uses a custom event system
        const callback = ({ register, get }) => {
            console.log('[SuiWallet] Wallet Standard API detected');

            // Get already registered wallets
            const existing = get();
            for (const wallet of existing) {
                if (this.isSuiWallet(wallet) && !this._standardWallets.find(w => w.name === wallet.name)) {
                    console.log('[SuiWallet] Found registered wallet:', wallet.name);
                    this._standardWallets.push(wallet);
                }
            }

            // Listen for new wallet registrations
            register((wallet) => {
                if (this.isSuiWallet(wallet) && !this._standardWallets.find(w => w.name === wallet.name)) {
                    console.log('[SuiWallet] New wallet registered:', wallet.name);
                    this._standardWallets.push(wallet);
                    this.wallets = this.getAvailableWallets();
                }
            });
        };

        // Check if standard is already available
        if (window.navigator?.wallet?.standard) {
            callback(window.navigator.wallet.standard);
        }

        // Listen for the standard to become available
        window.addEventListener('wallet-standard:register', (event) => {
            console.log('[SuiWallet] wallet-standard:register event');
            if (event.detail) {
                callback(event.detail);
            }
        });

        // Also try the newer API pattern
        try {
            if (typeof window !== 'undefined') {
                const { get, on } = this._getWalletStandardAPI();
                if (get) {
                    const wallets = get();
                    console.log('[SuiWallet] Standard API wallets:', wallets.map(w => w.name));
                    this._standardWallets = wallets.filter(w => this.isSuiWallet(w));
                }
            }
        } catch (e) {
            console.log('[SuiWallet] Standard API not available:', e.message);
        }
    }

    /**
     * Try to get the Wallet Standard API
     */
    _getWalletStandardAPI() {
        // Method 1: Check global
        if (window.walletStandard) {
            return window.walletStandard;
        }

        // Method 2: Check navigator
        if (window.navigator?.wallets) {
            return {
                get: () => {
                    if (typeof window.navigator.wallets.get === 'function') {
                        return window.navigator.wallets.get();
                    }
                    if (Array.isArray(window.navigator.wallets)) {
                        return window.navigator.wallets;
                    }
                    return [];
                }
            };
        }

        // Method 3: Look for injected standard
        const standardKey = Object.keys(window).find(k => k.includes('wallet') && k.includes('standard'));
        if (standardKey && window[standardKey]?.get) {
            return window[standardKey];
        }

        return { get: () => [] };
    }

    /**
     * Wait for wallet extensions to inject their APIs
     */
    async waitForWallets() {
        return new Promise((resolve) => {
            // Check if wallet standard is already ready
            if (window.__walletStandardReady && window.__walletStandard?.wallets?.length > 0) {
                console.log('[SuiWallet] Wallet standard already ready');
                resolve();
                return;
            }

            // Give wallets time to load
            const timeout = setTimeout(() => {
                console.log('[SuiWallet] Timeout reached, checking wallets...');
                resolve();
            }, 3000);

            // Listen for wallet standard ready event
            window.addEventListener('wallet-standard-ready', () => {
                console.log('[SuiWallet] Wallet standard ready event received');
                clearTimeout(timeout);
                // Small delay to let all wallets register
                setTimeout(resolve, 800);
            }, { once: true });

            // Also listen for updates
            window.addEventListener('wallet-standard-updated', () => {
                console.log('[SuiWallet] Wallet standard updated');
            });
        });
    }

    /**
     * Get all available Sui wallets using the Wallet Standard
     */
    getAvailableWallets() {
        const wallets = [];

        // PRIMARY METHOD: Use the official Wallet Standard we loaded
        if (window.__walletStandard?.wallets) {
            console.log('[SuiWallet] Using __walletStandard, found:', window.__walletStandard.wallets.map(w => w.name));
            for (const wallet of window.__walletStandard.wallets) {
                if (this.isSuiWallet(wallet) && !wallets.find(w => w.name === wallet.name)) {
                    wallets.push(wallet);
                }
            }
        }

        // Also try getting fresh list
        if (window.__walletStandard?.get) {
            try {
                const freshWallets = window.__walletStandard.get();
                for (const wallet of freshWallets) {
                    if (this.isSuiWallet(wallet) && !wallets.find(w => w.name === wallet.name)) {
                        wallets.push(wallet);
                    }
                }
            } catch (e) {
                console.log('[SuiWallet] Error getting fresh wallets:', e);
            }
        }

        // Fallback: Check for any wallets from our listener
        for (const wallet of this._standardWallets || []) {
            if (!wallets.find(w => w.name === wallet.name)) {
                wallets.push(wallet);
            }
        }

        // Fallback: Direct wallet injections (old method)

        // SLUSH WALLET (formerly Sui Wallet) - check multiple possible names
        if (window.slush && typeof window.slush.connect === 'function') {
            if (!wallets.find(w => w.name === 'Slush')) {
                wallets.unshift(this.createWalletWrapper('Slush', window.slush));
            }
        }

        if (window.slushWallet && typeof window.slushWallet.connect === 'function') {
            if (!wallets.find(w => w.name === 'Slush')) {
                wallets.unshift(this.createWalletWrapper('Slush', window.slushWallet));
            }
        }

        if (window.suiWallet && typeof window.suiWallet.connect === 'function') {
            if (!wallets.find(w => w.name === 'Sui Wallet') && !wallets.find(w => w.name === 'Slush')) {
                wallets.unshift(this.createWalletWrapper('Sui Wallet', window.suiWallet));
            }
        }

        if (window.sui && typeof window.sui.connect === 'function') {
            if (!wallets.find(w => w.name?.includes('Sui')) && !wallets.find(w => w.name === 'Slush')) {
                wallets.push(this.createWalletWrapper('Sui Wallet (Legacy)', window.sui));
            }
        }

        if (window.martian?.sui) {
            if (!wallets.find(w => w.name === 'Martian Wallet')) {
                wallets.push(this.createWalletWrapper('Martian Wallet', window.martian.sui));
            }
        }

        if (window.suiet) {
            if (!wallets.find(w => w.name === 'Suiet Wallet')) {
                wallets.push(this.createWalletWrapper('Suiet Wallet', window.suiet));
            }
        }

        if (window.okxwallet?.sui) {
            if (!wallets.find(w => w.name === 'OKX Wallet')) {
                wallets.push(this.createWalletWrapper('OKX Wallet', window.okxwallet.sui));
            }
        }

        if (window.ethos) {
            if (!wallets.find(w => w.name === 'Ethos Wallet')) {
                wallets.push(this.createWalletWrapper('Ethos Wallet', window.ethos));
            }
        }

        // Debug: Log all window properties that might be wallets
        console.log('[SuiWallet] Debug - checking window objects:');
        console.log('  window.suiWallet:', !!window.suiWallet);
        console.log('  window.sui:', !!window.sui);
        console.log('  window.martian:', !!window.martian);
        console.log('  window.wallets:', !!window.wallets);
        console.log('  window.$walletStandard:', !!window.$walletStandard);
        console.log('  window.navigator.wallets:', !!window.navigator?.wallets);

        // Remove duplicates by name, keeping first occurrence
        const seen = new Set();
        const unique = wallets.filter(w => {
            const name = w.name || 'Unknown';
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
        });

        // Sort to prioritize Slush/Sui Wallet (official) at the top
        unique.sort((a, b) => {
            if (a.name === 'Slush') return -1;
            if (b.name === 'Slush') return 1;
            if (a.name === 'Sui Wallet') return -1;
            if (b.name === 'Sui Wallet') return 1;
            if (a.name?.includes('Slush') || a.name?.includes('Sui')) return -1;
            if (b.name?.includes('Slush') || b.name?.includes('Sui')) return 1;
            return 0;
        });

        console.log('[SuiWallet] Detected wallets:', unique.map(w => w.name));
        return unique;
    }

    /**
     * Check if a wallet supports Sui (includes Slush, formerly Sui Wallet)
     */
    isSuiWallet(wallet) {
        if (!wallet) return false;

        // Check by name (Slush is the new Sui Wallet)
        const name = wallet.name?.toLowerCase() || '';
        if (name.includes('slush') || name.includes('sui')) {
            return true;
        }

        // Check by chains
        if (wallet.chains) {
            return wallet.chains.some(chain =>
                chain.includes('sui:') || chain === 'sui'
            );
        }

        return false;
    }

    /**
     * Create a standardized wallet wrapper for direct injections
     */
    createWalletWrapper(name, walletApi) {
        return {
            name,
            icon: walletApi.icon || null,
            accounts: walletApi.accounts || [],
            chains: ['sui:mainnet', 'sui:testnet', 'sui:devnet'],
            features: {
                'standard:connect': {
                    connect: async () => {
                        if (walletApi.connect) {
                            await walletApi.connect();
                        }
                        return { accounts: walletApi.accounts || [] };
                    }
                },
                'standard:disconnect': {
                    disconnect: async () => {
                        if (walletApi.disconnect) {
                            await walletApi.disconnect();
                        }
                    }
                },
                'standard:events': {
                    on: (event, callback) => {
                        if (walletApi.on) {
                            return walletApi.on(event, callback);
                        }
                        return () => {};
                    }
                },
                'sui:signTransaction': {
                    signTransaction: async (params) => {
                        if (walletApi.signTransaction) {
                            return walletApi.signTransaction(params);
                        }
                        throw new Error('signTransaction not supported');
                    }
                },
                'sui:signAndExecuteTransaction': {
                    signAndExecuteTransaction: async (params) => {
                        if (walletApi.signAndExecuteTransaction) {
                            return walletApi.signAndExecuteTransaction(params);
                        }
                        if (walletApi.signAndExecuteTransactionBlock) {
                            return walletApi.signAndExecuteTransactionBlock(params);
                        }
                        throw new Error('signAndExecuteTransaction not supported');
                    }
                }
            },
            _api: walletApi,
        };
    }

    /**
     * Setup listeners for wallet events
     */
    setupWalletListeners() {
        if (this.wallet && this.wallet.features['standard:events']) {
            this.wallet.features['standard:events'].on('change', (event) => {
                console.log('[SuiWallet] Wallet change event:', event);

                if (event.accounts) {
                    this.account = event.accounts[0] || null;
                    if (this.onConnectionChange) {
                        this.onConnectionChange(this.account);
                    }
                }
            });
        }
    }

    /**
     * Connect to a wallet
     */
    async connect(walletName = null) {
        try {
            // If no wallets available, throw error
            if (this.wallets.length === 0) {
                throw new Error('No Sui wallets detected. Please install a Sui wallet extension.');
            }

            // Select wallet
            if (walletName) {
                this.wallet = this.wallets.find(w => w.name === walletName);
                if (!this.wallet) {
                    throw new Error(`Wallet "${walletName}" not found`);
                }
            } else {
                // Use first available wallet
                this.wallet = this.wallets[0];
            }

            console.log('[SuiWallet] Connecting to:', this.wallet.name);

            // Check if already connected
            if (this.wallet.accounts && this.wallet.accounts.length > 0) {
                this.account = this.wallet.accounts[0];
                console.log('[SuiWallet] Already connected:', this.account.address);
                return this.account;
            }

            // Connect to wallet
            const connectFeature = this.wallet.features['standard:connect'];
            if (!connectFeature) {
                throw new Error('Wallet does not support connect feature');
            }

            const result = await connectFeature.connect();
            this.account = result.accounts[0] || (this.wallet.accounts && this.wallet.accounts[0]);

            if (!this.account) {
                throw new Error('No account returned from wallet connection');
            }

            console.log('[SuiWallet] Connected:', this.account.address);

            // Setup event listeners
            this.setupWalletListeners();

            return this.account;
        } catch (error) {
            console.error('[SuiWallet] Connection error:', error);
            throw error;
        }
    }

    /**
     * Disconnect from wallet
     */
    async disconnect() {
        try {
            if (this.wallet && this.wallet.features['standard:disconnect']) {
                await this.wallet.features['standard:disconnect'].disconnect();
            }
            this.wallet = null;
            this.account = null;
            console.log('[SuiWallet] Disconnected');
        } catch (error) {
            console.error('[SuiWallet] Disconnect error:', error);
        }
    }

    /**
     * Get current wallet address
     */
    getAddress() {
        return this.account?.address || null;
    }

    /**
     * Check if wallet is connected
     */
    isConnected() {
        return !!this.account;
    }

    /**
     * Sign and execute a transaction
     */
    async signAndExecuteTransaction(transactionBlock) {
        if (!this.wallet || !this.account) {
            throw new Error('Wallet not connected');
        }

        // Check available features
        const features = this.wallet.features;
        console.log('[SuiWallet] Available features:', Object.keys(features));

        try {
            // Method 1: Try sui:signAndExecuteTransaction (newest API)
            if (features['sui:signAndExecuteTransaction']) {
                console.log('[SuiWallet] Using sui:signAndExecuteTransaction');
                const result = await features['sui:signAndExecuteTransaction'].signAndExecuteTransaction({
                    transaction: transactionBlock,
                    account: this.account,
                    chain: `sui:${CONFIG.NETWORK}`,
                });
                console.log('[SuiWallet] Transaction result:', result);
                return result;
            }

            // Method 2: Try sui:signAndExecuteTransactionBlock (older API)
            if (features['sui:signAndExecuteTransactionBlock']) {
                console.log('[SuiWallet] Using sui:signAndExecuteTransactionBlock');
                const result = await features['sui:signAndExecuteTransactionBlock'].signAndExecuteTransactionBlock({
                    transactionBlock: transactionBlock,
                    account: this.account,
                    chain: `sui:${CONFIG.NETWORK}`,
                });
                console.log('[SuiWallet] Transaction result:', result);
                return result;
            }

            // Method 3: Try standard:signAndExecuteTransaction
            if (features['standard:signAndExecuteTransaction']) {
                console.log('[SuiWallet] Using standard:signAndExecuteTransaction');
                const result = await features['standard:signAndExecuteTransaction'].signAndExecuteTransaction({
                    transaction: transactionBlock,
                    account: this.account,
                    chain: `sui:${CONFIG.NETWORK}`,
                });
                console.log('[SuiWallet] Transaction result:', result);
                return result;
            }

            throw new Error('Wallet does not support any known transaction signing method');
        } catch (error) {
            console.error('[SuiWallet] Transaction error:', error);
            throw error;
        }
    }

    /**
     * Sign a transaction without executing
     */
    async signTransaction(transactionBlock) {
        if (!this.wallet || !this.account) {
            throw new Error('Wallet not connected');
        }

        const feature = this.wallet.features['sui:signTransaction'];
        if (!feature) {
            throw new Error('Wallet does not support transaction signing');
        }

        try {
            const result = await feature.signTransaction({
                transaction: transactionBlock,
                account: this.account,
                chain: `sui:${CONFIG.NETWORK}`,
            });

            console.log('[SuiWallet] Signed transaction:', result);
            return result;
        } catch (error) {
            console.error('[SuiWallet] Sign error:', error);
            throw error;
        }
    }
}

// =========================================
// Sui Client for RPC calls
// =========================================

/**
 * SuiRPCClient - Minimal RPC client for reading blockchain data
 */
class SuiRPCClient {
    constructor(rpcUrl) {
        this.rpcUrl = rpcUrl;
    }

    async call(method, params) {
        const response = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method,
                params,
            }),
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message || 'RPC error');
        }
        return data.result;
    }

    /**
     * Get an object by ID
     */
    async getObject(objectId, options = {}) {
        return this.call('sui_getObject', [
            objectId,
            {
                showType: true,
                showOwner: true,
                showContent: true,
                showDisplay: true,
                ...options,
            },
        ]);
    }

    /**
     * Get multiple objects
     */
    async getObjects(objectIds, options = {}) {
        return this.call('sui_multiGetObjects', [
            objectIds,
            {
                showType: true,
                showOwner: true,
                showContent: true,
                showDisplay: true,
                ...options,
            },
        ]);
    }

    /**
     * Get objects owned by an address
     */
    async getOwnedObjects(address, options = {}) {
        return this.call('suix_getOwnedObjects', [
            address,
            {
                filter: options.filter || null,
                options: {
                    showType: true,
                    showOwner: true,
                    showContent: true,
                },
            },
            options.cursor || null,
            options.limit || 50,
        ]);
    }

    /**
     * Get coins owned by an address
     */
    async getCoins(address, coinType = '0x2::sui::SUI') {
        return this.call('suix_getCoins', [
            address,
            coinType,
            null,
            null,
        ]);
    }

    /**
     * Get balance
     */
    async getBalance(address, coinType = '0x2::sui::SUI') {
        return this.call('suix_getBalance', [
            address,
            coinType,
        ]);
    }

    /**
     * Execute a dev inspect call (read-only)
     */
    async devInspectTransactionBlock(senderAddress, txBytes) {
        return this.call('sui_devInspectTransactionBlock', [
            senderAddress,
            txBytes,
        ]);
    }

    /**
     * Execute a transaction
     */
    async executeTransactionBlock(txBytes, signatures, options = {}) {
        return this.call('sui_executeTransactionBlock', [
            txBytes,
            signatures,
            {
                showInput: true,
                showEffects: true,
                showEvents: true,
                showObjectChanges: true,
                showBalanceChanges: true,
                ...options,
            },
        ]);
    }

    /**
     * Query events
     */
    async queryEvents(query, cursor = null, limit = 50, descending = true) {
        return this.call('suix_queryEvents', [
            query,
            cursor,
            limit,
            descending,
        ]);
    }

    /**
     * Get transaction block
     */
    async getTransactionBlock(digest, options = {}) {
        return this.call('sui_getTransactionBlock', [
            digest,
            {
                showInput: true,
                showEffects: true,
                showEvents: true,
                showObjectChanges: true,
                showBalanceChanges: true,
                ...options,
            },
        ]);
    }
}

// =========================================
// Transaction Builder
// =========================================

/**
 * Simple Transaction Builder for Sui
 * Note: In production, use @mysten/sui/transactions for full features
 */
class TransactionBuilder {
    constructor() {
        this.commands = [];
        this.inputs = [];
        this.gasPayment = null;
        this.gasBudget = 50000000; // 50M MIST = 0.05 SUI
        this.sender = null;
    }

    /**
     * Set the gas budget
     */
    setGasBudget(budget) {
        this.gasBudget = budget;
        return this;
    }

    /**
     * Set the sender address
     */
    setSender(address) {
        this.sender = address;
        return this;
    }

    /**
     * Add a pure input (primitives like numbers, strings, etc.)
     */
    pure(type, value) {
        const index = this.inputs.length;
        this.inputs.push({
            type: 'pure',
            valueType: type,
            value,
        });
        return { kind: 'Input', index };
    }

    /**
     * Add an object input
     */
    object(objectId) {
        const index = this.inputs.length;
        this.inputs.push({
            type: 'object',
            objectId,
        });
        return { kind: 'Input', index };
    }

    /**
     * Add a shared object input
     */
    sharedObject(objectId, initialSharedVersion, mutable = true) {
        const index = this.inputs.length;
        this.inputs.push({
            type: 'sharedObject',
            objectId,
            initialSharedVersion,
            mutable,
        });
        return { kind: 'Input', index };
    }

    /**
     * Reference the gas coin
     */
    gas() {
        return { kind: 'GasCoin' };
    }

    /**
     * Split coins
     */
    splitCoins(coin, amounts) {
        const commandIndex = this.commands.length;
        this.commands.push({
            kind: 'SplitCoins',
            coin,
            amounts,
        });
        return amounts.map((_, i) => ({
            kind: 'Result',
            index: commandIndex,
            resultIndex: i,
        }));
    }

    /**
     * Transfer objects
     */
    transferObjects(objects, recipient) {
        this.commands.push({
            kind: 'TransferObjects',
            objects,
            recipient,
        });
        return this;
    }

    /**
     * Move call
     */
    moveCall(params) {
        const { target, arguments: args = [], typeArguments = [] } = params;
        const commandIndex = this.commands.length;

        this.commands.push({
            kind: 'MoveCall',
            target,
            arguments: args,
            typeArguments,
        });

        return { kind: 'Result', index: commandIndex };
    }

    /**
     * Build the transaction for wallet signing
     * Note: This is a simplified version. In production, use @mysten/sui SDK
     */
    build() {
        return {
            version: 1,
            sender: this.sender,
            gasConfig: {
                budget: this.gasBudget.toString(),
            },
            inputs: this.inputs,
            commands: this.commands,
        };
    }
}

// =========================================
// Bounty Contract Interface
// =========================================

/**
 * BountyContract - Interface to interact with the DEADLIST smart contract
 */
class BountyContract {
    constructor(walletManager, rpcClient) {
        this.wallet = walletManager;
        this.rpc = rpcClient;
        this.packageId = CONFIG.PACKAGE_ID;
        this.boardId = CONFIG.BOUNTY_BOARD_ID;
        this.moduleName = CONFIG.MODULE_NAME;
    }

    /**
     * Post a new bounty
     *
     * @param {string} targetCharacterId - EVE Frontier character ID (u64)
     * @param {string} targetName - Target player name
     * @param {number} rewardAmount - Amount in MIST (1 SUI = 1e9 MIST)
     * @param {number} requiredCorpseTypeId - Required corpse type (0 = any)
     * @param {number} minCorpseQuantity - Minimum corpse quantity required
     */
    async postBounty(targetCharacterId, targetName, rewardAmount, requiredCorpseTypeId = 0, minCorpseQuantity = 1) {
        if (!this.wallet.isConnected()) {
            throw new Error('Wallet not connected');
        }

        // Wait for Sui SDK to load
        if (!window.SuiTransaction) {
            throw new Error('Sui SDK not loaded yet. Please refresh and try again.');
        }

        const senderAddress = this.wallet.getAddress();

        // Use the official Sui Transaction class
        const tx = new window.SuiTransaction();

        // Split coins for the reward
        const [rewardCoin] = tx.splitCoins(tx.gas, [rewardAmount]);

        // Encode target name as bytes
        const targetNameBytes = new TextEncoder().encode(targetName);

        // Call post_bounty function on new in-game contract
        tx.moveCall({
            target: `${this.packageId}::${this.moduleName}::post_bounty`,
            arguments: [
                tx.object(CONFIG.EXTENSION_CONFIG_ID), // config: &mut ExtensionConfig
                tx.pure.u64(targetCharacterId),        // target_character_id: u64
                tx.pure.vector('u8', Array.from(targetNameBytes)), // target_name: vector<u8>
                tx.pure.u64(requiredCorpseTypeId),     // required_corpse_type_id: u64
                tx.pure.u32(minCorpseQuantity),        // min_corpse_quantity: u32
                rewardCoin,                             // reward: Coin<SUI>
                tx.object(CONFIG.CLOCK_ID),            // clock: &Clock
            ],
        });

        console.log('[BountyContract] Posting bounty:', {
            targetCharacterId,
            targetName,
            reward: rewardAmount,
            requiredCorpseTypeId,
            minCorpseQuantity,
        });

        // Execute via wallet
        const result = await this.wallet.signAndExecuteTransaction(tx);

        return result;
    }

    /**
     * Claim a bounty by providing corpse proof
     *
     * @param {string} storageUnitId - StorageUnit object ID containing the corpse
     * @param {string} characterId - Hunter's Character object ID
     * @param {string} ownerCapId - Hunter's OwnerCap object ID
     * @param {string} targetCharacterId - Target's character ID (u64)
     * @param {string} bountyId - Bounty ID (u64)
     * @param {string} corpseTypeId - Corpse item type ID
     * @param {number} corpseQuantity - Number of corpses
     */
    async claimBounty(storageUnitId, characterId, ownerCapId, targetCharacterId, bountyId, corpseTypeId, corpseQuantity) {
        if (!this.wallet.isConnected()) {
            throw new Error('Wallet not connected');
        }

        if (!window.SuiTransaction) {
            throw new Error('Sui SDK not loaded yet. Please refresh and try again.');
        }

        const tx = new window.SuiTransaction();

        tx.moveCall({
            target: `${this.packageId}::${this.moduleName}::claim_bounty`,
            typeArguments: [`${CONFIG.WORLD_PACKAGE_ID}::character::Character`],
            arguments: [
                tx.object(this.boardId),                    // config: &mut ExtensionConfig
                tx.object(storageUnitId),                   // storage_unit: &mut StorageUnit
                tx.object(characterId),                     // character: &Character
                tx.object(ownerCapId),                      // hunter_owner_cap: &OwnerCap<Character>
                tx.pure.u64(targetCharacterId),             // target_character_id: u64
                tx.pure.u64(bountyId),                      // bounty_id: u64
                tx.pure.u64(corpseTypeId),                  // corpse_type_id: u64
                tx.pure.u32(corpseQuantity),                // corpse_quantity: u32
                tx.object(CONFIG.CLOCK_ID),                 // clock: &Clock
            ],
        });

        console.log('[BountyContract] Claiming bounty:', { bountyId, targetCharacterId, storageUnitId });
        const result = await this.wallet.signAndExecuteTransaction(tx);
        return result;
    }

    /**
     * Cancel a bounty and get refund
     *
     * @param {string} targetCharacterId - Target's character ID (u64)
     * @param {string} bountyId - Bounty ID (u64)
     */
    async cancelBounty(targetCharacterId, bountyId) {
        if (!this.wallet.isConnected()) {
            throw new Error('Wallet not connected');
        }

        if (!window.SuiTransaction) {
            throw new Error('Sui SDK not loaded yet. Please refresh and try again.');
        }

        const tx = new window.SuiTransaction();

        tx.moveCall({
            target: `${this.packageId}::${this.moduleName}::cancel_bounty`,
            arguments: [
                tx.object(CONFIG.EXTENSION_CONFIG_ID), // config: &mut ExtensionConfig
                tx.pure.u64(targetCharacterId),         // target_character_id: u64
                tx.pure.u64(bountyId),                  // bounty_id: u64
            ],
        });

        console.log('[BountyContract] Cancelling bounty:', { targetCharacterId, bountyId });
        const result = await this.wallet.signAndExecuteTransaction(tx);
        return result;
    }

    /**
     * Authorize the DEADLIST extension on a StorageUnit
     * Must be called by the SSU owner before claiming works
     *
     * @param {string} storageUnitId - The SSU object ID
     * @param {string} ownerCapId - The OwnerCap<StorageUnit> object ID
     */
    async authorizeExtension(storageUnitId, ownerCapId, characterId) {
        if (!this.wallet.isConnected()) {
            throw new Error('Wallet not connected');
        }

        if (!window.SuiTransaction) {
            throw new Error('Sui SDK not loaded yet. Please refresh and try again.');
        }

        const tx = new window.SuiTransaction();

        // Step 1: Borrow the SSU OwnerCap from the Character using Receiving pattern
        // This returns [OwnerCap, ReturnOwnerCapReceipt]
        const [borrowedOwnerCap, returnReceipt] = tx.moveCall({
            target: `${CONFIG.WORLD_PACKAGE_ID}::character::borrow_owner_cap`,
            typeArguments: [`${CONFIG.WORLD_PACKAGE_ID}::storage_unit::StorageUnit`],
            arguments: [
                tx.object(characterId),           // character: &mut Character (shared)
                tx.object(ownerCapId),            // owner_cap_ticket: Receiving<OwnerCap<StorageUnit>>
            ],
        });

        // Step 2: Authorize the DEADLIST extension on the SSU
        tx.moveCall({
            target: `${CONFIG.WORLD_PACKAGE_ID}::storage_unit::authorize_extension`,
            typeArguments: [`${this.packageId}::${this.moduleName}::DeadlistAuth`],
            arguments: [
                tx.object(storageUnitId),   // storage_unit: &mut StorageUnit
                borrowedOwnerCap,           // owner_cap: &OwnerCap<StorageUnit>
            ],
        });

        // Step 3: Return the OwnerCap back to the Character
        tx.moveCall({
            target: `${CONFIG.WORLD_PACKAGE_ID}::character::return_owner_cap`,
            typeArguments: [`${CONFIG.WORLD_PACKAGE_ID}::storage_unit::StorageUnit`],
            arguments: [
                tx.object(characterId),     // character: &Character
                borrowedOwnerCap,           // owner_cap: OwnerCap<T>
                returnReceipt,              // receipt: ReturnOwnerCapReceipt
            ],
        });

        console.log('[BountyContract] Authorizing DEADLIST extension on SSU:', storageUnitId);
        console.log('[BountyContract] Using Character:', characterId, 'OwnerCap:', ownerCapId);
        const result = await this.wallet.signAndExecuteTransaction(tx);
        return result;
    }

    /**
     * Get bounty IDs targeting a specific player
     *
     * @param {string} playerId - EVE Frontier player ID
     * @returns {Promise<string[]>} Array of bounty object IDs
     */
    async getBountyIdsOnPlayer(playerId) {
        try {
            // Query the BountyBoard object to get bounties_by_target table
            const boardObj = await this.rpc.getObject(this.boardId);

            if (!boardObj.data || !boardObj.data.content) {
                console.log('[BountyContract] BountyBoard not found');
                return [];
            }

            // The bounties_by_target is a Table<u256, vector<ID>>
            // We need to query the dynamic field
            const fields = boardObj.data.content.fields;

            if (fields && fields.bounties_by_target) {
                // For a real implementation, we'd need to query dynamic fields
                console.log('[BountyContract] Board fields:', fields);
            }

            return [];
        } catch (error) {
            console.error('[BountyContract] Error getting bounties:', error);
            return [];
        }
    }

    /**
     * Get active bounty count from the board
     *
     * @returns {Promise<number>}
     */
    async getActiveBountyCount() {
        try {
            const boardObj = await this.rpc.getObject(this.boardId);

            if (!boardObj.data || !boardObj.data.content) {
                return 0;
            }

            const fields = boardObj.data.content.fields;
            return parseInt(fields.active_bounties || '0', 10);
        } catch (error) {
            console.error('[BountyContract] Error getting active bounties:', error);
            return 0;
        }
    }

    /**
     * Get total bounty count from the board
     *
     * @returns {Promise<number>}
     */
    async getTotalBountyCount() {
        try {
            const boardObj = await this.rpc.getObject(this.boardId);

            if (!boardObj.data || !boardObj.data.content) {
                return 0;
            }

            const fields = boardObj.data.content.fields;
            return parseInt(fields.total_bounties || '0', 10);
        } catch (error) {
            console.error('[BountyContract] Error getting total bounties:', error);
            return 0;
        }
    }

    /**
     * Get bounty details by object ID
     *
     * @param {string} bountyId - Bounty object ID
     * @returns {Promise<Object|null>}
     */
    async getBountyDetails(bountyId) {
        try {
            const bountyObj = await this.rpc.getObject(bountyId);

            if (!bountyObj.data || !bountyObj.data.content) {
                return null;
            }

            const fields = bountyObj.data.content.fields;

            return {
                id: bountyId,
                poster: fields.poster,
                targetPlayerId: fields.target_player_id,
                reward: parseInt(fields.reward?.fields?.balance || '0', 10),
                minKillValue: parseInt(fields.min_kill_value || '0', 10),
                blacklist: fields.blacklist || [],
                createdAt: parseInt(fields.created_at || '0', 10),
                status: parseInt(fields.status || '0', 10),
            };
        } catch (error) {
            console.error('[BountyContract] Error getting bounty details:', error);
            return null;
        }
    }

    /**
     * Query BountyPosted events to get active bounties
     *
     * @param {number} limit - Maximum number of events to return
     * @returns {Promise<Object[]>}
     */
    async getActiveBounties(limit = 50) {
        try {
            // Query BountyPosted events
            const events = await this.rpc.queryEvents({
                MoveEventType: `${this.packageId}::${this.moduleName}::BountyPosted`,
            }, null, limit, true);

            if (!events || !events.data) {
                return [];
            }

            // Parse events into bounty data
            const bounties = events.data.map(event => ({
                id: event.parsedJson?.bounty_id,
                poster: event.parsedJson?.poster,
                targetPlayerId: event.parsedJson?.target_player_id,
                reward: parseInt(event.parsedJson?.reward_amount || '0', 10),
                minKillValue: parseInt(event.parsedJson?.min_kill_value || '0', 10),
                timestamp: parseInt(event.timestampMs || '0', 10),
            }));

            return bounties;
        } catch (error) {
            console.error('[BountyContract] Error querying events:', error);
            return [];
        }
    }

    /**
     * Get bounties posted by a specific address
     *
     * @param {string} address - Poster's wallet address
     * @returns {Promise<Object[]>}
     */
    async getBountiesByPoster(address) {
        try {
            // Query owned objects of type Bounty
            const objects = await this.rpc.getOwnedObjects(address, {
                filter: {
                    StructType: `${this.packageId}::${this.moduleName}::Bounty`,
                },
            });

            if (!objects || !objects.data) {
                return [];
            }

            // Get detailed info for each bounty
            const bountyIds = objects.data.map(obj => obj.data?.objectId).filter(Boolean);
            const detailedBounties = await Promise.all(
                bountyIds.map(id => this.getBountyDetails(id))
            );

            return detailedBounties.filter(Boolean);
        } catch (error) {
            console.error('[BountyContract] Error getting bounties by poster:', error);
            return [];
        }
    }
}

// =========================================
// Mock Data (fallback for demo/testing)
// =========================================

const MOCK_PLAYERS = [
    { id: '0x1a2b3c4d', name: 'DarkMatter_IX', tribe: 'Void Reapers', avatar: 'DM' },
    { id: '0x2b3c4d5e', name: 'NullSec_Hunter', tribe: 'Shadow Fleet', avatar: 'NH' },
    { id: '0x3c4d5e6f', name: 'CryptoNova', tribe: 'Stellar Corp', avatar: 'CN' },
    { id: '0x4d5e6f7g', name: 'GateKeeper_77', tribe: 'Iron Guard', avatar: 'GK' },
    { id: '0x5e6f7g8h', name: 'WarpDrive_X', tribe: 'Nomad Fleet', avatar: 'WD' },
    { id: '0x6f7g8h9i', name: 'AbyssWalker', tribe: 'Void Reapers', avatar: 'AW' },
    { id: '0x7g8h9i0j', name: 'SolarFlare', tribe: 'Phoenix Rising', avatar: 'SF' },
    { id: '0x8h9i0j1k', name: 'QuantumShift', tribe: 'Quantum Corp', avatar: 'QS' },
    { id: '0x9i0j1k2l', name: 'NebulaDrift', tribe: 'Drifter Collective', avatar: 'ND' },
    { id: '0x0j1k2l3m', name: 'VoidReaper_01', tribe: 'Void Reapers', avatar: 'VR' },
    { id: '0x1k2l3m4n', name: 'StarForge', tribe: 'Stellar Corp', avatar: 'SF' },
    { id: '0x2l3m4n5o', name: 'BlackHole_X', tribe: 'Event Horizon', avatar: 'BH' },
];

const MOCK_BOUNTIES = [
    {
        id: 'b001',
        target: MOCK_PLAYERS[0],
        poster: MOCK_PLAYERS[4],
        reward: 150000,
        minKillValue: 50000,
        createdAt: Date.now() - 3600000 * 2,
        status: 'active',
        blacklist: [],
        description: 'Raided our mining operation. Made it personal.',
    },
    {
        id: 'b002',
        target: MOCK_PLAYERS[1],
        poster: MOCK_PLAYERS[6],
        reward: 75000,
        minKillValue: 25000,
        createdAt: Date.now() - 3600000 * 8,
        status: 'active',
        blacklist: ['0x3c4d5e6f'],
        description: 'Gatecamper. Needs to learn a lesson.',
    },
    {
        id: 'b003',
        target: MOCK_PLAYERS[2],
        poster: MOCK_PLAYERS[8],
        reward: 500000,
        minKillValue: 100000,
        createdAt: Date.now() - 3600000 * 24,
        status: 'active',
        blacklist: [],
        description: 'Scammed our corp for 2M EVE. HIGH PRIORITY.',
    },
    {
        id: 'b004',
        target: MOCK_PLAYERS[3],
        poster: MOCK_PLAYERS[0],
        reward: 25000,
        minKillValue: 10000,
        createdAt: Date.now() - 3600000 * 48,
        status: 'active',
        blacklist: [],
        description: 'Extorting gate fees. Take him down.',
    },
    {
        id: 'b005',
        target: MOCK_PLAYERS[5],
        poster: MOCK_PLAYERS[7],
        reward: 200000,
        minKillValue: 75000,
        createdAt: Date.now() - 3600000 * 12,
        status: 'active',
        blacklist: ['0x1a2b3c4d', '0x2b3c4d5e'],
        description: 'Corp traitor. Stole from the treasury.',
    },
    {
        id: 'b006',
        target: MOCK_PLAYERS[6],
        poster: MOCK_PLAYERS[1],
        reward: 45000,
        minKillValue: 20000,
        createdAt: Date.now() - 3600000 * 72,
        status: 'active',
        blacklist: [],
        description: 'Destroyed my hauler. Revenge time.',
    },
    {
        id: 'b007',
        target: MOCK_PLAYERS[7],
        poster: MOCK_PLAYERS[3],
        reward: 350000,
        minKillValue: 150000,
        createdAt: Date.now() - 3600000 * 6,
        status: 'active',
        blacklist: [],
        description: 'Warlord causing chaos in low-sec. Big reward for removal.',
    },
    {
        id: 'b008',
        target: MOCK_PLAYERS[8],
        poster: MOCK_PLAYERS[2],
        reward: 80000,
        minKillValue: 30000,
        createdAt: Date.now() - 3600000 * 36,
        status: 'active',
        blacklist: [],
        description: 'Spy. Leaked our jump coordinates.',
    },
    {
        id: 'b009',
        target: MOCK_PLAYERS[9],
        poster: MOCK_PLAYERS[5],
        reward: 120000,
        minKillValue: 50000,
        createdAt: Date.now() - 3600000 * 4,
        status: 'active',
        blacklist: [],
        description: 'Former ally turned pirate. Hunt him down.',
    },
    {
        id: 'b010',
        target: MOCK_PLAYERS[10],
        poster: MOCK_PLAYERS[9],
        reward: 60000,
        minKillValue: 25000,
        createdAt: Date.now() - 3600000 * 96,
        status: 'active',
        blacklist: [],
        description: 'Griefed our newbro fleet. Payback time.',
    },
    {
        id: 'b011',
        target: MOCK_PLAYERS[11],
        poster: MOCK_PLAYERS[10],
        reward: 1000000,
        minKillValue: 500000,
        createdAt: Date.now() - 3600000 * 1,
        status: 'active',
        blacklist: [],
        description: 'MOST WANTED. 1 MILLION EVE REWARD. The Event Horizon menace.',
    },
    {
        id: 'b012',
        target: MOCK_PLAYERS[4],
        poster: MOCK_PLAYERS[11],
        reward: 35000,
        minKillValue: 15000,
        createdAt: Date.now() - 3600000 * 120,
        status: 'active',
        blacklist: [],
        description: 'Annoying scout. Keep seeing him everywhere.',
    },
];

const MOCK_HUNTERS = [
    { player: MOCK_PLAYERS[1], kills: 47, earnings: 2450000 },
    { player: MOCK_PLAYERS[4], kills: 38, earnings: 1890000 },
    { player: MOCK_PLAYERS[7], kills: 31, earnings: 1560000 },
    { player: MOCK_PLAYERS[0], kills: 28, earnings: 1230000 },
    { player: MOCK_PLAYERS[3], kills: 22, earnings: 980000 },
    { player: MOCK_PLAYERS[9], kills: 19, earnings: 750000 },
    { player: MOCK_PLAYERS[6], kills: 15, earnings: 620000 },
    { player: MOCK_PLAYERS[2], kills: 12, earnings: 480000 },
];

const MOCK_MOST_WANTED = [
    { player: MOCK_PLAYERS[11], totalBounty: 1250000, bountyCount: 3 },
    { player: MOCK_PLAYERS[2], totalBounty: 890000, bountyCount: 5 },
    { player: MOCK_PLAYERS[7], totalBounty: 650000, bountyCount: 2 },
    { player: MOCK_PLAYERS[0], totalBounty: 420000, bountyCount: 4 },
    { player: MOCK_PLAYERS[5], totalBounty: 380000, bountyCount: 3 },
    { player: MOCK_PLAYERS[1], totalBounty: 275000, bountyCount: 2 },
    { player: MOCK_PLAYERS[8], totalBounty: 180000, bountyCount: 1 },
    { player: MOCK_PLAYERS[3], totalBounty: 125000, bountyCount: 2 },
];

const MOCK_RECENT_CLAIMS = [
    { hunter: MOCK_PLAYERS[1], target: MOCK_PLAYERS[10], reward: 45000, timestamp: Date.now() - 1800000 },
    { hunter: MOCK_PLAYERS[4], target: MOCK_PLAYERS[6], reward: 120000, timestamp: Date.now() - 7200000 },
    { hunter: MOCK_PLAYERS[7], target: MOCK_PLAYERS[8], reward: 85000, timestamp: Date.now() - 14400000 },
    { hunter: MOCK_PLAYERS[0], target: MOCK_PLAYERS[3], reward: 200000, timestamp: Date.now() - 28800000 },
    { hunter: MOCK_PLAYERS[3], target: MOCK_PLAYERS[5], reward: 35000, timestamp: Date.now() - 43200000 },
];

// =========================================
// Global Instances
// =========================================

let walletManager = null;
let rpcClient = null;
let bountyContract = null;
let eveAPI = null;

// =========================================
// State Management
// =========================================

let state = {
    currentPage: 'home',
    walletConnected: false,
    walletAddress: null,
    bounties: [...MOCK_BOUNTIES],
    filteredBounties: [...MOCK_BOUNTIES],
    searchQuery: '',
    filterReward: '',
    filterSort: 'newest',
    isLoading: false,
    useMockData: true, // Will be set to false when contract is deployed
};

// =========================================
// Utility Functions
// =========================================

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K';
    } else if (num < 1 && num > 0) {
        // Handle small decimals like 0.01, 0.1
        return num.toFixed(2);
    }
    return num.toLocaleString();
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}

function truncateAddress(address) {
    if (!address) return '';
    return address.slice(0, 6) + '...' + address.slice(-4);
}

/**
 * Convert SUI to MIST (smallest unit)
 * 1 SUI = 1,000,000,000 MIST
 */
function suiToMist(sui) {
    return BigInt(Math.floor(sui * 1e9));
}

/**
 * Convert MIST to SUI
 */
function mistToSui(mist) {
    return Number(mist) / 1e9;
}

// =========================================
// Navigation
// =========================================

function showPage(pageName) {
    state.currentPage = pageName;

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.classList.add('hidden');
    });

    // Show target page
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        targetPage.classList.add('active');
    }

    // Update nav links
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) {
            link.classList.add('active');
        }
    });

    // Trigger page-specific renders
    if (pageName === 'home') renderBounties();
    if (pageName === 'leaderboard') renderLeaderboard();
    if (pageName === 'mybounties') renderMyBounties();
}

function closeMobileMenu() {
    document.getElementById('mobileMenu').classList.add('hidden');
}

// =========================================
// Bounty Card Rendering
// =========================================

function createBountyCard(bounty, showCancelButton = false) {
    const timeAgo = formatTimeAgo(bounty.createdAt);
    const hasBlacklist = bounty.blacklist.length > 0;

    return `
        <div class="bounty-card" data-animate="fade-up" onclick="openBountyModal('${bounty.id}')">
            <div class="bounty-card-header">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="target-avatar">${bounty.target.avatar}</div>
                        <div>
                            <h3 class="font-orbitron font-bold text-lg text-white">${bounty.target.name}</h3>
                            <p class="text-sm text-gray-500">${bounty.target.tribe}</p>
                        </div>
                    </div>
                    <div class="bounty-status ${bounty.status}">
                        <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                        ${bounty.status}
                    </div>
                </div>
            </div>
            <div class="bounty-card-body">
                <p class="text-gray-400 text-sm mb-4 line-clamp-2">${bounty.description}</p>
                <div class="flex items-center justify-between">
                    <div>
                        <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Reward</div>
                        <div class="bounty-reward">${formatNumber(bounty.reward)} EVE</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Min Kill Value</div>
                        <div class="kill-value">${formatNumber(bounty.minKillValue)} LUX</div>
                    </div>
                </div>
            </div>
            <div class="bounty-card-footer">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <div class="anti-farm-badge">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                            </svg>
                            Protected
                        </div>
                        ${hasBlacklist ? `
                            <span class="text-xs text-eve-accent">${bounty.blacklist.length} blacklisted</span>
                        ` : ''}
                    </div>
                    <span class="text-sm text-gray-500">${timeAgo}</span>
                </div>
                ${showCancelButton ? `
                    <button onclick="event.stopPropagation(); cancelBountyAction('${bounty.id}')" class="cancel-btn mt-3 w-full">
                        Cancel Bounty
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function renderBounties() {
    const grid = document.getElementById('bountiesGrid');
    const countEl = document.getElementById('bountyCount');

    // Apply filters
    let filtered = [...state.bounties];

    // Search filter
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(b =>
            b.target.name.toLowerCase().includes(query) ||
            b.target.id.toLowerCase().includes(query)
        );
    }

    // Reward filter
    if (state.filterReward) {
        const minReward = parseInt(state.filterReward);
        filtered = filtered.filter(b => b.reward >= minReward);
    }

    // Sort
    switch (state.filterSort) {
        case 'highest':
            filtered.sort((a, b) => b.reward - a.reward);
            break;
        case 'oldest':
            filtered.sort((a, b) => a.createdAt - b.createdAt);
            break;
        case 'newest':
        default:
            filtered.sort((a, b) => b.createdAt - a.createdAt);
    }

    state.filteredBounties = filtered;
    countEl.textContent = filtered.length;

    grid.innerHTML = filtered.map(bounty => createBountyCard(bounty)).join('');
}

// =========================================
// Leaderboard Rendering
// =========================================

function renderLeaderboard() {
    renderTopHunters();
    renderMostWanted();
    renderRecentClaims();
}

function renderTopHunters() {
    const container = document.getElementById('topHunters');

    container.innerHTML = MOCK_HUNTERS.map((hunter, index) => {
        const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default';
        return `
            <div class="leaderboard-entry">
                <div class="rank ${rankClass}">${index + 1}</div>
                <div class="target-avatar" style="border-color: #00ff88;">${hunter.player.avatar}</div>
                <div class="flex-1">
                    <div class="font-bold text-white">${hunter.player.name}</div>
                    <div class="text-sm text-gray-500">${hunter.player.tribe}</div>
                </div>
                <div class="text-right">
                    <div class="font-orbitron font-bold text-eve-green">${hunter.kills} kills</div>
                    <div class="text-sm text-gray-500">${formatNumber(hunter.earnings)} EVE earned</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderMostWanted() {
    const container = document.getElementById('mostWanted');

    container.innerHTML = MOCK_MOST_WANTED.map((wanted, index) => {
        const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default';
        return `
            <div class="leaderboard-entry">
                <div class="rank ${rankClass}">${index + 1}</div>
                <div class="target-avatar">${wanted.player.avatar}</div>
                <div class="flex-1">
                    <div class="font-bold text-white">${wanted.player.name}</div>
                    <div class="text-sm text-gray-500">${wanted.player.tribe}</div>
                </div>
                <div class="text-right">
                    <div class="font-orbitron font-bold text-eve-accent">${formatNumber(wanted.totalBounty)} EVE</div>
                    <div class="text-sm text-gray-500">${wanted.bountyCount} active bounties</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderRecentClaims() {
    const container = document.getElementById('recentClaims');

    container.innerHTML = MOCK_RECENT_CLAIMS.map(claim => `
        <div class="claim-entry">
            <div class="target-avatar" style="border-color: #00ff88; width: 2.5rem; height: 2.5rem; font-size: 0.875rem;">${claim.hunter.avatar}</div>
            <div class="font-medium text-white">${claim.hunter.name}</div>
            <div class="claim-arrow">&#10140;</div>
            <div class="target-avatar" style="width: 2.5rem; height: 2.5rem; font-size: 0.875rem;">${claim.target.avatar}</div>
            <div class="font-medium text-gray-400">${claim.target.name}</div>
            <div class="flex-1"></div>
            <div class="text-right">
                <div class="font-orbitron font-bold text-eve-accent-gold">${formatNumber(claim.reward)} EVE</div>
                <div class="text-sm text-gray-500">${formatTimeAgo(claim.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

// =========================================
// My Bounties
// =========================================

async function renderMyBounties() {
    if (!state.walletConnected) {
        document.getElementById('connectNotice').classList.remove('hidden');
        document.getElementById('myBountiesList').classList.add('hidden');
        return;
    }

    document.getElementById('connectNotice').classList.add('hidden');
    document.getElementById('myBountiesList').classList.remove('hidden');

    // Filter bounties to show only those posted by the connected wallet
    let myBounties = state.bounties.filter(b => {
        // Check if it's marked as own bounty
        if (b.isOwn) return true;
        // Check if poster ID matches wallet address
        if (b.poster && b.poster.id && state.walletAddress) {
            return b.poster.id.toLowerCase() === state.walletAddress.toLowerCase();
        }
        return false;
    });

    // Also try to fetch from blockchain if available
    if (bountyContract && window.SuiTransaction) {
        try {
            const chainBounties = await bountyContract.getBountiesByPoster(state.walletAddress);
            // Merge with existing, avoiding duplicates
            for (const cb of chainBounties) {
                if (!myBounties.find(b => b.id === cb.id)) {
                    myBounties.push(cb);
                }
            }
        } catch (error) {
            console.error('[MyBounties] Error fetching from chain:', error);
        }
    }

    document.getElementById('myBountyCount').textContent = myBounties.length;

    const grid = document.getElementById('myBountiesGrid');

    if (myBounties.length === 0) {
        grid.innerHTML = `
            <div class="text-center py-12">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-eve-gray flex items-center justify-center">
                    <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                </div>
                <p class="text-gray-400 mb-4">You haven't posted any bounties yet.</p>
                <button onclick="showPage('post')" class="px-6 py-2 bg-eve-accent/20 border border-eve-accent/50 rounded-lg text-eve-accent hover:bg-eve-accent/30 transition-colors">
                    Post Your First Bounty
                </button>
            </div>
        `;
    } else {
        grid.innerHTML = `<div class="grid gap-6">${myBounties.map(b => createBountyCard(b, true)).join('')}</div>`;
    }
}

// =========================================
// Bounty Modal
// =========================================

function openBountyModal(bountyId) {
    const bounty = state.bounties.find(b => b.id === bountyId);
    if (!bounty) return;

    const modal = document.getElementById('bountyModal');
    const content = document.getElementById('bountyModalContent');

    content.innerHTML = `
        <div class="modal-header">
            <button onclick="closeBountyModal()" class="absolute top-4 right-4 p-2 rounded-lg hover:bg-eve-gray transition-colors">
                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
            <div class="flex items-center space-x-4">
                <div class="target-avatar" style="width: 5rem; height: 5rem; font-size: 2rem;">${bounty.target.avatar}</div>
                <div>
                    <div class="bounty-status ${bounty.status} mb-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                        ${bounty.status}
                    </div>
                    <h2 class="font-orbitron text-2xl font-bold text-white">${bounty.target.name}</h2>
                    <p class="text-gray-400">${bounty.target.tribe}</p>
                </div>
            </div>
        </div>
        <div class="modal-body space-y-6">
            <div>
                <h4 class="text-sm text-gray-500 uppercase tracking-wider mb-2">Bounty Reason</h4>
                <p class="text-gray-200">${bounty.description}</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="bg-eve-darker rounded-lg p-4">
                    <div class="text-sm text-gray-500 uppercase tracking-wider mb-1">Reward</div>
                    <div class="bounty-reward text-2xl">${formatNumber(bounty.reward)} EVE</div>
                </div>
                <div class="bg-eve-darker rounded-lg p-4">
                    <div class="text-sm text-gray-500 uppercase tracking-wider mb-1">Min Kill Value</div>
                    <div class="kill-value text-2xl">${formatNumber(bounty.minKillValue)} LUX</div>
                </div>
            </div>

            <div class="bg-eve-darker rounded-lg p-4">
                <h4 class="text-sm text-gray-500 uppercase tracking-wider mb-3">Anti-Farming Protection</h4>
                <div class="space-y-2">
                    <div class="flex items-center text-sm">
                        <span class="text-eve-green mr-2">&#10003;</span>
                        <span class="text-gray-300">Same-tribe claims blocked</span>
                    </div>
                    <div class="flex items-center text-sm">
                        <span class="text-eve-green mr-2">&#10003;</span>
                        <span class="text-gray-300">Mutual kill detection active</span>
                    </div>
                    <div class="flex items-center text-sm">
                        <span class="text-eve-green mr-2">&#10003;</span>
                        <span class="text-gray-300">Kill value minimum enforced</span>
                    </div>
                    ${bounty.blacklist.length > 0 ? `
                        <div class="flex items-center text-sm">
                            <span class="text-eve-accent mr-2">!</span>
                            <span class="text-gray-300">${bounty.blacklist.length} player(s) blacklisted</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="flex items-center justify-between text-sm text-gray-500">
                <div>Posted by <span class="text-eve-cyan">${bounty.poster.name}</span></div>
                <div>${formatTimeAgo(bounty.createdAt)}</div>
            </div>

            <div class="flex items-center justify-between text-sm">
                <div class="text-gray-500">Target ID: <span class="font-mono text-gray-400">${bounty.target.id}</span></div>
                <div class="text-gray-500">Bounty ID: <span class="font-mono text-gray-400">${bounty.id}</span></div>
            </div>
        </div>
        <div class="modal-footer">
            <div class="bg-eve-darker rounded-lg p-4 mb-4">
                <h4 class="text-sm text-gray-500 uppercase tracking-wider mb-3">Claim Bounty (Have corpse at terminal)</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label class="text-xs text-gray-500">Corpse Type ID</label>
                        <input type="number" id="claimCorpseType" value="0" placeholder="0 = any"
                            class="w-full bg-eve-gray border border-eve-blue/30 rounded px-3 py-2 text-white text-sm">
                    </div>
                    <div>
                        <label class="text-xs text-gray-500">Quantity</label>
                        <input type="number" id="claimCorpseQty" value="1" min="1"
                            class="w-full bg-eve-gray border border-eve-blue/30 rounded px-3 py-2 text-white text-sm">
                    </div>
                </div>
                <p class="text-xs text-gray-500 mb-2">Bounty ID: ${bounty.onChainBountyId || '1'} | Target Char ID: ${bounty.target.id}</p>
            </div>
            <div class="flex gap-3">
                <button onclick="closeBountyModal()" class="flex-1 py-3 bg-eve-gray border border-eve-blue/50 rounded-lg font-medium hover:bg-eve-gray-light transition-colors">
                    Close
                </button>
                <button onclick="claimBountyAction('${bounty.target.id}', '${bounty.onChainBountyId || '1'}', document.getElementById('claimCorpseType').value, document.getElementById('claimCorpseQty').value)" class="flex-1 claim-btn text-center">
                    Claim Bounty
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeBountyModal() {
    const modal = document.getElementById('bountyModal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// =========================================
// Wallet Connection
// =========================================

async function connectWallet() {
    showToast('Detecting Sui wallets...', 'info');

    try {
        // Initialize wallet manager if not already done
        if (!walletManager) {
            walletManager = new SuiWalletManager();
            await walletManager.init();
        }

        // Check if any wallets are available
        if (walletManager.wallets.length === 0) {
            showToast('No Sui wallet detected. Please install Sui Wallet, Suiet, or another Sui-compatible wallet.', 'error');
            return;
        }

        // ALWAYS show wallet selector so user can choose
        showWalletSelector(walletManager.wallets);
        return;

        // Old code - kept for reference but unreachable
        showToast(`Connecting to ${walletManager.wallets[0].name}...`, 'info');

        // Connect to wallet
        const account = await walletManager.connect();

        if (account) {
            state.walletConnected = true;
            state.walletAddress = account.address;

            // Initialize RPC client and contract interface
            rpcClient = new SuiRPCClient(CONFIG.RPC_URL[CONFIG.NETWORK]);
            bountyContract = new BountyContract(walletManager, rpcClient);

            // Check if contract is deployed by trying to fetch the board
            try {
                if (CONFIG.BOUNTY_BOARD_ID !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    const activeBounties = await bountyContract.getActiveBountyCount();
                    console.log('[Wallet] Active bounties on chain:', activeBounties);
                    state.useMockData = false;
                }
            } catch (err) {
                console.log('[Wallet] Contract not deployed or not accessible, using mock data');
                state.useMockData = true;
            }

            // Setup connection change handler
            walletManager.onConnectionChange = (newAccount) => {
                if (newAccount) {
                    state.walletAddress = newAccount.address;
                    updateWalletUI();
                } else {
                    handleDisconnect();
                }
            };

            updateWalletUI();
            showToast('Wallet connected successfully!', 'success');

            // Re-render my bounties page if active
            if (state.currentPage === 'mybounties') {
                renderMyBounties();
            }
        }
    } catch (error) {
        console.error('[Wallet] Connection error:', error);
        showToast(`Connection failed: ${error.message}`, 'error');
    }
}

function updateWalletUI() {
    const btn = document.getElementById('connectWallet');
    if (state.walletConnected && state.walletAddress) {
        btn.innerHTML = `
            <div class="w-2 h-2 rounded-full bg-eve-green"></div>
            <span class="text-sm font-medium text-eve-green">${truncateAddress(state.walletAddress)}</span>
        `;
        btn.onclick = showWalletMenu;
    } else {
        btn.innerHTML = `
            <div class="w-2 h-2 rounded-full bg-eve-accent animate-pulse"></div>
            <span class="text-sm font-medium text-eve-cyan group-hover:text-white transition-colors">Connect Wallet</span>
        `;
        btn.onclick = connectWallet;
    }
}

function showWalletMenu() {
    // Simple toggle for now - could be expanded to a dropdown
    if (confirm('Disconnect wallet?')) {
        handleDisconnect();
    }
}

/**
 * Show wallet selector modal when multiple wallets are detected
 */
function showWalletSelector(wallets) {
    const modal = document.getElementById('bountyModal');
    const content = document.getElementById('bountyModalContent');

    content.innerHTML = `
        <div class="modal-header">
            <button onclick="closeBountyModal()" class="absolute top-4 right-4 p-2 rounded-lg hover:bg-eve-gray transition-colors">
                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
            <h2 class="font-orbitron text-2xl font-bold text-white mb-2">Select Wallet</h2>
            <p class="text-gray-400">Choose which wallet to connect</p>
        </div>
        <div class="modal-body space-y-3">
            ${wallets.map((wallet, index) => `
                <button onclick="selectAndConnectWallet('${wallet.name}')"
                        class="w-full p-4 bg-eve-darker border border-eve-blue/30 rounded-lg hover:border-eve-cyan/50 hover:bg-eve-gray transition-all flex items-center space-x-4">
                    <div class="w-10 h-10 rounded-lg bg-eve-gray flex items-center justify-center">
                        ${wallet.icon ? `<img src="${wallet.icon}" alt="${wallet.name}" class="w-6 h-6"/>` :
                          `<svg class="w-6 h-6 text-eve-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                          </svg>`}
                    </div>
                    <div class="flex-1 text-left">
                        <div class="font-medium text-white">${wallet.name}</div>
                        <div class="text-sm text-gray-500">${wallet.name.includes('Sui') ? 'Official Sui Wallet' : 'Third-party wallet'}</div>
                    </div>
                    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </button>
            `).join('')}
        </div>
        <div class="modal-footer">
            <button onclick="closeBountyModal()" class="w-full py-3 bg-eve-gray border border-eve-blue/50 rounded-lg font-medium hover:bg-eve-gray-light transition-colors">
                Cancel
            </button>
        </div>
    `;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

/**
 * Connect to a specific wallet by name
 */
async function selectAndConnectWallet(walletName) {
    closeBountyModal();
    showToast(`Connecting to ${walletName}...`, 'info');

    try {
        const account = await walletManager.connect(walletName);

        if (account) {
            state.walletConnected = true;
            state.walletAddress = account.address;

            // Initialize RPC client and contract interface
            rpcClient = new SuiRPCClient(CONFIG.RPC_URL[CONFIG.NETWORK]);
            bountyContract = new BountyContract(walletManager, rpcClient);

            // Check if contract is deployed
            try {
                if (CONFIG.BOUNTY_BOARD_ID !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    const activeBounties = await bountyContract.getActiveBountyCount();
                    console.log('[Wallet] Active bounties on chain:', activeBounties);
                    state.useMockData = false;
                }
            } catch (err) {
                console.log('[Wallet] Contract not deployed or not accessible, using mock data');
                state.useMockData = true;
            }

            // Setup connection change handler
            walletManager.onConnectionChange = (newAccount) => {
                if (newAccount) {
                    state.walletAddress = newAccount.address;
                    updateWalletUI();
                } else {
                    handleDisconnect();
                }
            };

            updateWalletUI();
            showToast('Wallet connected successfully!', 'success');

            if (state.currentPage === 'mybounties') {
                renderMyBounties();
            }
        }
    } catch (error) {
        console.error('[Wallet] Connection error:', error);
        showToast(`Connection failed: ${error.message}`, 'error');
    }
}

// Make selectAndConnectWallet globally accessible
window.selectAndConnectWallet = selectAndConnectWallet;

let isDisconnecting = false;

async function handleDisconnect() {
    // Prevent infinite loop - disconnect() triggers disconnect event
    if (isDisconnecting) {
        return;
    }
    isDisconnecting = true;

    try {
        if (walletManager) {
            await walletManager.disconnect();
        }

        state.walletConnected = false;
        state.walletAddress = null;
        state.useMockData = true;

        updateWalletUI();
        showToast('Wallet disconnected', 'info');

        if (state.currentPage === 'mybounties') {
            renderMyBounties();
        }
    } finally {
        isDisconnecting = false;
    }
}

// =========================================
// Bounty Actions
// =========================================

function applyFilters() {
    state.searchQuery = document.getElementById('searchInput').value;
    state.filterReward = document.getElementById('filterReward').value;
    state.filterSort = document.getElementById('filterSort').value;
    renderBounties();
}

async function postBounty(e) {
    e.preventDefault();

    if (!state.walletConnected) {
        showToast('Please connect your wallet first', 'error');
        return;
    }

    const targetPlayer = document.getElementById('targetPlayer').value;
    const targetCharacterId = document.getElementById('targetCharacterId')?.value || '0';
    const rewardAmount = parseFloat(document.getElementById('rewardAmount').value);
    const minCorpseQty = parseInt(document.getElementById('minKillValue').value) || 1;

    // Validate character was selected via search
    const charId = BigInt(targetCharacterId || '0');
    if (charId === 0n) {
        showToast('Please search and select a valid character first!', 'error');
        return;
    }

    if (!targetPlayer) {
        showToast('Please search and select a target character', 'error');
        return;
    }

    if (!rewardAmount || rewardAmount < 0.001) {
        showToast('Minimum reward is 0.001 EVE', 'error');
        return;
    }

    showToast('Preparing transaction...', 'info');

    try {
        let txDigest = null;
        let onChainBountyId = (state.bounties.length + 1).toString(); // Default

        if (bountyContract && window.SuiTransaction) {
            // Real blockchain transaction
            const rewardInMist = suiToMist(rewardAmount);

            showToast('Please confirm the transaction in your wallet...', 'info');

            const result = await bountyContract.postBounty(
                charId.toString(),      // targetCharacterId
                targetPlayer,           // targetName
                Number(rewardInMist),   // rewardAmount in MIST
                0,                      // requiredCorpseTypeId (0 = any)
                minCorpseQty            // minCorpseQuantity
            );

            txDigest = result.digest || result.hash || 'confirmed';

            // Try to get the bounty_id from the BountyPosted event
            if (result.events) {
                const bountyEvent = result.events.find(e => e.type?.includes('BountyPosted'));
                if (bountyEvent?.parsedJson?.bounty_id) {
                    onChainBountyId = bountyEvent.parsedJson.bounty_id.toString();
                    console.log('[PostBounty] Got bounty_id from event:', onChainBountyId);
                }
            }

            showToast(`Bounty #${onChainBountyId} posted! TX: ${truncateAddress(txDigest)}`, 'success');
        }

        // Add the new bounty to the UI immediately (optimistic update)
        const newBounty = {
            id: txDigest || ('b' + Date.now()),
            onChainBountyId: onChainBountyId, // Track the on-chain ID for claiming
            target: {
                id: charId.toString(),
                name: targetPlayer,
                tribe: 'Unknown',
                avatar: targetPlayer.substr(0, 2).toUpperCase()
            },
            poster: {
                id: state.walletAddress,
                name: truncateAddress(state.walletAddress),
                tribe: 'Your Wallet',
                avatar: state.walletAddress ? state.walletAddress.slice(2, 4).toUpperCase() : 'YO'
            },
            reward: rewardAmount, // Store in SUI (not MIST) for display
            minKillValue: minCorpseQty,
            createdAt: Date.now(),
            status: 'active',
            description: 'Bounty posted via DEADLIST. Bring the corpse to claim!',
            blacklist: [],
            isOwn: true, // Mark as user's own bounty
        };

        // Add to beginning of bounties list
        state.bounties.unshift(newBounty);

        if (!txDigest) {
            showToast(`Bounty posted! ${formatNumber(rewardAmount)} EVE locked in escrow.`, 'success');
        }

        // Reset form and navigate to home
        document.getElementById('postBountyForm').reset();
        showPage('home');
        renderBounties(); // Force re-render

    } catch (error) {
        console.error('[PostBounty] Error:', error);
        showToast(`Transaction failed: ${error.message}`, 'error');
    }
}

/**
 * Search for a character by ID, name, or wallet address
 * Shows verified character info before posting bounty
 */
async function searchCharacter() {
    const searchInput = document.getElementById('characterSearch');
    const resultsDiv = document.getElementById('characterSearchResults');
    const query = searchInput?.value?.trim();

    if (!query) {
        showToast('Enter a Character ID, name, or wallet address', 'error');
        return;
    }

    resultsDiv.classList.remove('hidden');

    try {
        let characters = [];

        // If it looks like a wallet address (0x...), search by owner
        if (query.startsWith('0x') && query.length > 20) {
            showToast('Searching by wallet address...', 'info');
            resultsDiv.innerHTML = '<p class="text-gray-400 p-2">Searching wallet...</p>';
            characters = await searchCharacterByWallet(query);
        }
        // If it's a number, search by Character ID
        else if (/^\d+$/.test(query)) {
            showToast('Searching by Character ID...', 'info');
            resultsDiv.innerHTML = '<p class="text-gray-400 p-2">Searching by ID...</p>';
            characters = await searchCharacterById(query);
        }
        // Otherwise search by name
        else {
            showToast('Searching all characters by name...', 'info');
            resultsDiv.innerHTML = '<p class="text-gray-400 p-2" id="searchProgress">Searching... 0 characters checked</p>';
            characters = await searchCharacterByName(query, (progress) => {
                const progressEl = document.getElementById('searchProgress');
                if (progressEl) {
                    progressEl.textContent = `Searching... ${progress} characters checked`;
                }
            });
        }

        if (characters.length === 0) {
            const isWalletSearch = query.startsWith('0x') && query.length > 20;

            resultsDiv.innerHTML = `
                <div class="bg-eve-accent/10 border border-eve-accent/30 rounded-lg p-3">
                    <p class="text-eve-accent">No characters found for "${query}"</p>
                    <p class="text-gray-400 text-sm mt-1">Try a different spelling or check browser console (F12) for details.</p>
                </div>
            `;
            return;
        }

        // Show results
        resultsDiv.innerHTML = characters.map(char => `
            <div class="bg-eve-gray border border-eve-blue/30 rounded-lg p-3 mb-2 cursor-pointer hover:border-eve-cyan/50 transition-colors"
                 onclick="selectCharacter('${char.id}', '${char.name.replace(/'/g, "\\'")}', '${char.tribeId}')">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-white font-bold">${char.name || 'Unknown'}</p>
                        <p class="text-gray-400 text-sm font-mono">ID: ${char.id}</p>
                        ${char.tribeId ? `<p class="text-gray-500 text-xs">Tribe: #${char.tribeId}</p>` : ''}
                    </div>
                    <div class="text-eve-cyan text-sm">Select →</div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('[SearchCharacter] Error:', error);
        resultsDiv.innerHTML = `
            <div class="bg-eve-accent/10 border border-eve-accent/30 rounded-lg p-3">
                <p class="text-eve-accent">Search failed</p>
                <p class="text-gray-400 text-sm mt-1">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Search for character by numeric Character ID
 */
async function searchCharacterById(characterId) {
    console.log('[SearchById] Searching for item_id:', characterId);

    // Query CharacterCreatedEvent and MetadataChangedEvent events
    const response = await fetch(CONFIG.RPC_URL[CONFIG.NETWORK], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'suix_queryEvents',
            params: [{
                MoveModule: {
                    package: CONFIG.WORLD_PACKAGE_ID,
                    module: 'character'
                }
            }, null, 500, false]
        })
    });

    const data = await response.json();
    const events = data.result?.data || [];

    console.log('[SearchById] Found events:', events.length);

    // Build a map of character data from events
    let characterObjectId = null;
    let characterName = null;
    let tribeId = 0;
    let walletAddress = null;

    for (const event of events) {
        const parsed = event.parsedJson || {};
        const eventType = event.type || '';

        // CharacterCreatedEvent has: key.item_id, character_id (object ID), tribe_id, character_address
        if (eventType.includes('CharacterCreatedEvent')) {
            const itemId = String(parsed.key?.item_id || '');
            if (itemId === characterId) {
                characterObjectId = parsed.character_id;
                tribeId = parsed.tribe_id || 0;
                walletAddress = parsed.character_address;
                console.log('[SearchById] Found CharacterCreatedEvent:', { characterObjectId, tribeId });
            }
        }

        // MetadataChangedEvent has: assembly_key.item_id, name, assembly_id
        if (eventType.includes('MetadataChangedEvent')) {
            const itemId = String(parsed.assembly_key?.item_id || '');
            if (itemId === characterId) {
                characterName = parsed.name;
                if (!characterObjectId) {
                    characterObjectId = parsed.assembly_id;
                }
                console.log('[SearchById] Found MetadataChangedEvent:', { characterName });
            }
        }
    }

    // If we found the character object ID, fetch full details
    if (characterObjectId) {
        const charData = await fetchCharacterByObjectId(characterObjectId);
        if (charData) {
            return [charData];
        }
        // If object fetch failed, return what we have from events
        if (characterName) {
            return [{
                id: characterId,
                name: characterName,
                tribeId: tribeId,
                objectId: characterObjectId,
                walletAddress: walletAddress
            }];
        }
    }

    console.log('[SearchById] Character not found in events');
    return [];
}


/**
 * Fetch character data by object ID
 */
async function fetchCharacterByObjectId(objectId) {
    const response = await fetch(CONFIG.RPC_URL[CONFIG.NETWORK], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_getObject',
            params: [objectId, { showType: true, showContent: true }]
        })
    });

    const data = await response.json();
    const obj = data.result?.data;

    if (obj?.type?.includes('::character::Character')) {
        const fields = obj.content?.fields || {};
        return {
            id: fields.key?.fields?.item_id || 'Unknown',
            name: fields.metadata?.fields?.name || 'Unknown',
            tribeId: fields.tribe_id || 0,
            objectId: obj.objectId
        };
    }

    return null;
}

/**
 * Search for character by wallet address
 */
async function searchCharacterByWallet(walletAddress) {
    console.log('[SearchByWallet] Searching for wallet:', walletAddress);

    // Step 1: Get PlayerProfile objects owned by the wallet
    const response = await fetch(CONFIG.RPC_URL[CONFIG.NETWORK], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'suix_getOwnedObjects',
            params: [walletAddress, {
                filter: { Package: CONFIG.WORLD_PACKAGE_ID },
                options: { showType: true, showContent: true }
            }, null, 20]
        })
    });

    const data = await response.json();
    const objects = data.result?.data || [];
    const characters = [];

    console.log('[SearchByWallet] Found objects:', objects.length);

    // Step 2: Find PlayerProfile objects and fetch their associated Character objects
    for (const obj of objects) {
        const objType = obj.data?.type || '';
        console.log('[SearchByWallet] Object type:', objType);

        // Check for PlayerProfile (which links to Character)
        if (objType.includes('::character::PlayerProfile')) {
            const fields = obj.data.content?.fields || {};
            const characterObjectId = fields.character_id;

            console.log('[SearchByWallet] Found PlayerProfile with character_id:', characterObjectId);

            if (characterObjectId) {
                // Fetch the actual Character object
                const charResponse = await fetch(CONFIG.RPC_URL[CONFIG.NETWORK], {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'sui_getObject',
                        params: [characterObjectId, {
                            showType: true,
                            showContent: true
                        }]
                    })
                });

                const charData = await charResponse.json();
                const charFields = charData.result?.data?.content?.fields || {};

                console.log('[SearchByWallet] Character data:', charFields);

                characters.push({
                    id: charFields.key?.fields?.item_id || 'Unknown',
                    name: charFields.metadata?.fields?.name || 'Unknown',
                    tribeId: charFields.tribe_id || 0,
                    objectId: characterObjectId,
                    walletAddress: charFields.character_address
                });
            }
        }
        // Also check if they directly own a Character (fallback)
        else if (objType.includes('::character::Character')) {
            const fields = obj.data.content?.fields || {};
            characters.push({
                id: fields.key?.fields?.item_id || 'Unknown',
                name: fields.metadata?.fields?.name || 'Unknown',
                tribeId: fields.tribe_id || 0,
                objectId: obj.data.objectId,
                walletAddress: fields.character_address
            });
        }
    }

    console.log('[SearchByWallet] Found characters:', characters.length);
    return characters;
}

/**
 * Search for character by name using GraphQL
 * This searches through all Character objects and filters by name
 */
async function searchCharacterByName(name, onProgress = null) {
    console.log('[SearchByName] Searching for name:', name);

    const searchLower = name.toLowerCase();
    const characters = [];
    const seenIds = new Set();
    let cursor = null;
    let pageCount = 0;
    let totalChecked = 0;
    const maxPages = 200; // Search up to 10000 characters (should cover all)
    const pageSize = 50;

    try {
        while (pageCount < maxPages) {
            const characterType = `${CONFIG.WORLD_PACKAGE_ID}::character::Character`;
            const afterClause = cursor ? `, after: "${cursor}"` : '';
            const query = `{ objects(filter: { type: "${characterType}" }, first: ${pageSize}${afterClause}) { pageInfo { hasNextPage endCursor } nodes { address asMoveObject { contents { json } } } } }`;

            console.log('[SearchByName] Query:', query);

            const graphqlUrl = CONFIG.GRAPHQL_URL[CONFIG.NETWORK];
            const requestBody = JSON.stringify({ query });

            console.log('[SearchByName] URL:', graphqlUrl);
            console.log('[SearchByName] Request body:', requestBody);

            const response = await fetch(graphqlUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestBody
            });

            console.log('[SearchByName] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[SearchByName] HTTP error:', response.status, errorText);
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('[SearchByName] Response data:', JSON.stringify(data).substring(0, 500));

            // Check for GraphQL errors
            if (data.errors) {
                console.error('[SearchByName] GraphQL errors:', data.errors);
                throw new Error(data.errors[0]?.message || 'GraphQL error');
            }

            const nodes = data.data?.objects?.nodes || [];
            const pageInfo = data.data?.objects?.pageInfo || {};

            totalChecked += nodes.length;
            if (onProgress) onProgress(totalChecked);

            console.log(`[SearchByName] Page ${pageCount + 1}: ${nodes.length} characters, total: ${totalChecked}, hasNextPage: ${pageInfo.hasNextPage}`);

            // Filter by name
            for (const node of nodes) {
                const json = node.asMoveObject?.contents?.json || {};
                const charName = json.metadata?.name || '';

                if (charName.toLowerCase().includes(searchLower)) {
                    const itemId = json.key?.item_id;
                    if (itemId && !seenIds.has(itemId)) {
                        seenIds.add(itemId);
                        characters.push({
                            id: itemId,
                            name: charName,
                            tribeId: json.tribe_id || 0,
                            objectId: node.address,
                            walletAddress: json.character_address
                        });

                        // Stop early if we found enough matches
                        if (characters.length >= 10) {
                            console.log('[SearchByName] Found enough matches, stopping early');
                            return characters;
                        }
                    }
                }
            }

            // Check for more pages
            if (!pageInfo.hasNextPage) {
                break;
            }

            cursor = pageInfo.endCursor;
            pageCount++;
        }

        console.log('[SearchByName] Found characters:', characters.length);
        return characters;

    } catch (error) {
        console.error('[SearchByName] GraphQL error:', error);
        console.log('[SearchByName] Trying fallback event-based search...');
        // Fallback to event-based search if GraphQL fails
        try {
            return await searchCharacterByNameFallback(name);
        } catch (fallbackError) {
            console.error('[SearchByName] Fallback also failed:', fallbackError);
            return [];
        }
    }
}

/**
 * Fallback name search using events (for when GraphQL is unavailable)
 */
async function searchCharacterByNameFallback(name) {
    console.log('[SearchByNameFallback] Using event-based search');

    const response = await fetch(CONFIG.RPC_URL[CONFIG.NETWORK], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'suix_queryEvents',
            params: [{
                MoveModule: {
                    package: CONFIG.WORLD_PACKAGE_ID,
                    module: 'character'
                }
            }, null, 500, false]
        })
    });

    const data = await response.json();
    const events = data.result?.data || [];
    const characters = [];
    const seenIds = new Set();
    const searchLower = name.toLowerCase();

    for (const event of events) {
        const parsed = event.parsedJson || {};
        const eventType = event.type || '';

        if (eventType.includes('MetadataChangedEvent')) {
            const charName = parsed.name || '';
            if (charName.toLowerCase().includes(searchLower)) {
                const itemId = String(parsed.assembly_key?.item_id || '');
                if (itemId && !seenIds.has(itemId)) {
                    seenIds.add(itemId);
                    characters.push({
                        id: itemId,
                        name: charName,
                        tribeId: 0,
                        objectId: parsed.assembly_id
                    });
                }
            }
        }
    }

    return characters;
}

/**
 * Find the user's OwnerCap for their Character
 * Returns { ownerCapId, characterId } or null
 */
async function findUserOwnerCap(walletAddress) {
    console.log('[FindOwnerCap] Looking for OwnerCap owned by:', walletAddress);

    try {
        const response = await fetch(CONFIG.RPC_URL[CONFIG.NETWORK], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'suix_getOwnedObjects',
                params: [
                    walletAddress,
                    {
                        filter: {
                            StructType: `${CONFIG.WORLD_PACKAGE_ID}::access::OwnerCap<${CONFIG.WORLD_PACKAGE_ID}::character::Character>`
                        },
                        options: { showType: true, showContent: true }
                    },
                    null,
                    10
                ]
            })
        });

        const data = await response.json();
        const objects = data.result?.data || [];

        if (objects.length === 0) {
            console.log('[FindOwnerCap] No OwnerCap found for Character type');
            return null;
        }

        const ownerCap = objects[0];
        const content = ownerCap.data?.content?.fields || {};
        const ownerCapId = ownerCap.data?.objectId;
        const authorizedObjectId = content.authorized_object_id;

        console.log('[FindOwnerCap] Found OwnerCap:', ownerCapId, 'for Character:', authorizedObjectId);

        return {
            ownerCapId: ownerCapId,
            characterId: authorizedObjectId
        };
    } catch (error) {
        console.error('[FindOwnerCap] Error:', error);
        return null;
    }
}

/**
 * Find StorageUnits the user has access to
 * In EVE Frontier, OwnerCaps are owned by Character objects, not wallets directly
 * Returns array of { id, ownerCapId, name }
 */
async function findUserStorageUnits(walletAddress) {
    console.log('[FindStorageUnits] Looking for StorageUnits accessible by:', walletAddress);

    try {
        const storageUnits = [];

        // Step 1: Find user's Character to get its object address
        const charOwnerCap = await findUserOwnerCap(walletAddress);
        if (charOwnerCap?.characterId) {
            console.log('[FindStorageUnits] Found Character:', charOwnerCap.characterId);

            // Step 2: Find OwnerCaps for StorageUnits owned by the Character
            const response = await fetch(CONFIG.RPC_URL[CONFIG.NETWORK], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'suix_getOwnedObjects',
                    params: [
                        charOwnerCap.characterId, // OwnerCaps are owned by Character object
                        {
                            filter: {
                                StructType: `${CONFIG.WORLD_PACKAGE_ID}::access::OwnerCap<${CONFIG.WORLD_PACKAGE_ID}::storage_unit::StorageUnit>`
                            },
                            options: { showType: true, showContent: true }
                        },
                        null,
                        50
                    ]
                })
            });

            const data = await response.json();
            const ownerCaps = data.result?.data || [];
            console.log('[FindStorageUnits] Found', ownerCaps.length, 'OwnerCaps on Character');

            for (const cap of ownerCaps) {
                const content = cap.data?.content?.fields || {};
                const storageUnitId = content.authorized_object_id;
                if (storageUnitId) {
                    storageUnits.push({
                        id: storageUnitId,
                        ownerCapId: cap.data?.objectId,
                        name: `SSU ${truncateAddress(storageUnitId)}`
                    });
                }
            }
        }

        // Also check wallet directly (in case some are there)
        const walletResponse = await fetch(CONFIG.RPC_URL[CONFIG.NETWORK], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'suix_getOwnedObjects',
                params: [
                    walletAddress,
                    {
                        filter: {
                            StructType: `${CONFIG.WORLD_PACKAGE_ID}::access::OwnerCap<${CONFIG.WORLD_PACKAGE_ID}::storage_unit::StorageUnit>`
                        },
                        options: { showType: true, showContent: true }
                    },
                    null,
                    50
                ]
            })
        });

        const walletData = await walletResponse.json();
        const walletCaps = walletData.result?.data || [];

        for (const cap of walletCaps) {
            const content = cap.data?.content?.fields || {};
            const storageUnitId = content.authorized_object_id;
            if (storageUnitId && !storageUnits.find(s => s.id === storageUnitId)) {
                storageUnits.push({
                    id: storageUnitId,
                    ownerCapId: cap.data?.objectId,
                    name: `SSU ${truncateAddress(storageUnitId)}`
                });
            }
        }

        console.log('[FindStorageUnits] Total found:', storageUnits.length, 'StorageUnits');
        return storageUnits;
    } catch (error) {
        console.error('[FindStorageUnits] Error:', error);
        return [];
    }
}

/**
 * Set target name directly (simple approach for hackathon)
 */
function setTargetName() {
    const input = document.getElementById('characterSearch');
    const name = input?.value?.trim();

    if (!name) {
        showToast('Enter a target name', 'error');
        return;
    }

    if (name.length < 2) {
        showToast('Name too short', 'error');
        return;
    }

    // Set the target name directly
    document.getElementById('targetPlayer').value = name;
    document.getElementById('targetCharacterId').value = '0'; // Will be resolved on-chain

    // Show selected character box
    document.getElementById('selectedCharacterName').textContent = name;
    document.getElementById('selectedCharacterId').textContent = 'Verified on claim';
    document.getElementById('selectedCharacterTribe').textContent = '-';
    document.getElementById('selectedCharacterBox').classList.remove('hidden');

    // Hide search results if visible
    document.getElementById('characterSearchResults')?.classList.add('hidden');

    showToast(`Target set: ${name}`, 'success');
}

/**
 * Select a character from search results
 */
function selectCharacter(id, name, tribeId) {
    // Update hidden input
    document.getElementById('targetCharacterId').value = id;
    document.getElementById('targetPlayer').value = name;

    // Show selected character box
    document.getElementById('selectedCharacterName').textContent = name;
    document.getElementById('selectedCharacterId').textContent = id;
    document.getElementById('selectedCharacterTribe').textContent = tribeId ? `#${tribeId}` : 'None';
    document.getElementById('selectedCharacterBox').classList.remove('hidden');

    // Hide search results
    document.getElementById('characterSearchResults').classList.add('hidden');

    showToast(`Selected: ${name}`, 'success');
}

/**
 * Clear selected character
 */
function clearSelectedCharacter() {
    document.getElementById('targetCharacterId').value = '';
    document.getElementById('targetPlayer').value = '';
    document.getElementById('selectedCharacterBox').classList.add('hidden');
    document.getElementById('characterSearch').value = '';
}

async function cancelBountyAction(bountyId) {
    showToast('Cancel clicked...', 'info');

    if (!state.walletConnected) {
        showToast('Please connect your wallet first', 'error');
        return;
    }

    // Check if this is a mock bounty (can't cancel fake bounties)
    if (bountyId.startsWith('b0')) {
        showToast('This is a demo bounty - cannot cancel', 'error');
        return;
    }

    // Find the bounty to get targetCharacterId and onChainBountyId
    const bounty = state.bounties.find(b => b.id === bountyId);
    if (!bounty) {
        showToast('Bounty not found in state', 'error');
        return;
    }

    showToast('Found bounty, preparing transaction...', 'info');

    try {
        if (!state.useMockData && bountyContract) {
            // Real blockchain transaction
            showToast('Please confirm the transaction in your wallet...', 'info');

            const targetCharacterId = bounty.target.id;
            const onChainBountyId = bounty.onChainBountyId || '1';

            console.log('[CancelBounty] Cancelling:', { targetCharacterId, onChainBountyId });

            const result = await bountyContract.cancelBounty(targetCharacterId, onChainBountyId);

            showToast(`Bounty cancelled! TX: ${truncateAddress(result.digest || 'confirmed')}`, 'success');

            // Remove from state.bounties immediately
            state.bounties = state.bounties.filter(b => b.id !== bountyId);
        } else {
            // Mock transaction
            await new Promise(resolve => setTimeout(resolve, 1500));
            state.bounties = state.bounties.filter(b => b.id !== bountyId);
            showToast(`Bounty cancelled. ${formatNumber(bounty.reward)} EVE returned to wallet.`, 'success');
        }

        renderBounties();
        renderMyBounties();

    } catch (error) {
        console.error('[CancelBounty] Error:', error);
        showToast(`Cancellation failed: ${error.message}`, 'error');
    }
}

/**
 * Setup the Bounty Terminal (authorize DEADLIST extension on SSU)
 * Must be called once by the SSU owner
 */
async function setupBountyTerminal() {
    if (!state.walletConnected) {
        showToast('Please connect your wallet first', 'error');
        return;
    }

    // Check if we're using the EVE Vault wallet (required for Character access)
    const isEveVault = state.walletAddress?.toLowerCase() === '0x7efc9bd40aeea4a890bd227157122b70e0fe6b1250691d34fe58e68ef0b11617';

    if (!isEveVault) {
        showToast('SSU setup requires your EVE Vault wallet (in-game).', 'error');
        console.log('[SetupTerminal] Wrong wallet. Need EVE Vault, got:', state.walletAddress);
        return;
    }

    showToast('Borrowing OwnerCap from Character and authorizing extension...', 'info');

    try {
        console.log('[SetupTerminal] Using SSU:', CONFIG.BOUNTY_TERMINAL_SSU_ID);
        console.log('[SetupTerminal] Using OwnerCap:', CONFIG.BOUNTY_TERMINAL_OWNERCAP_ID);
        console.log('[SetupTerminal] Using Character:', CONFIG.CHARACTER_ID);
        console.log('[SetupTerminal] Connected wallet (EVE Vault):', state.walletAddress);

        showToast('Please confirm the transaction in your wallet...', 'info');

        const result = await bountyContract.authorizeExtension(
            CONFIG.BOUNTY_TERMINAL_SSU_ID,
            CONFIG.BOUNTY_TERMINAL_OWNERCAP_ID,
            CONFIG.CHARACTER_ID
        );

        showToast(`Bounty Terminal setup complete! TX: ${truncateAddress(result.digest || 'confirmed')}`, 'success');
    } catch (error) {
        console.error('[SetupTerminal] Error:', error);
        showToast(`Setup failed: ${error.message}`, 'error');
    }
}

/**
 * Claim a bounty (called by hunters)
 * Requires corpse to be deposited at the Bounty Terminal SSU
 */
async function claimBountyAction(targetCharacterId, bountyId, corpseTypeId = 0, corpseQuantity = 1) {
    if (!state.walletConnected) {
        showToast('Please connect your wallet first', 'error');
        return;
    }

    showToast('Finding your character and OwnerCap...', 'info');

    try {
        // Step 1: Find hunter's Character and OwnerCap
        const ownerCapInfo = await findUserOwnerCap(state.walletAddress);
        if (!ownerCapInfo) {
            showToast('Character OwnerCap not found. Do you have an EVE Frontier character?', 'error');
            return;
        }

        const { ownerCapId, characterId } = ownerCapInfo;
        console.log('[ClaimBounty] Found OwnerCap:', ownerCapId, 'Character:', characterId);

        // Step 2: Execute blockchain transaction
        if (!state.useMockData && bountyContract) {
            showToast('Please confirm the transaction in your wallet...', 'info');

            const result = await bountyContract.claimBounty(
                CONFIG.BOUNTY_TERMINAL_SSU_ID,  // storageUnitId
                characterId,                      // hunter's character
                ownerCapId,                       // hunter's OwnerCap
                targetCharacterId,                // target's character ID (u64)
                bountyId,                         // bounty ID (u64)
                corpseTypeId,                     // corpse type (0 = any)
                corpseQuantity                    // corpse count
            );

            showToast(`Bounty claimed! TX: ${truncateAddress(result.digest || 'confirmed')}`, 'success');
        } else {
            // Mock claim
            await new Promise(resolve => setTimeout(resolve, 2000));
            showToast('Bounty claimed! (mock mode)', 'success');
        }

        renderBounties();
        closeBountyModal();

    } catch (error) {
        console.error('[ClaimBounty] Error:', error);
        showToast(`Claim failed: ${error.message}`, 'error');
    }
}

function huntTarget(bountyId) {
    closeBountyModal();
    showToast('Target added to your hunt list! Good hunting, pilot.', 'success');
}

// =========================================
// Contract Read Functions
// =========================================

/**
 * Fetch and display active bounties from the blockchain via events
 */
async function loadActiveBounties() {
    console.log('[LoadBounties] Fetching bounties from chain...');

    try {
        // Query BountyPosted events
        const response = await fetch(CONFIG.RPC_URL[CONFIG.NETWORK], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'suix_queryEvents',
                params: [
                    { MoveEventType: `${CONFIG.PACKAGE_ID}::deadlist::BountyPosted` },
                    null,
                    50,
                    false
                ]
            })
        });

        const data = await response.json();
        const events = data.result?.data || [];

        console.log('[LoadBounties] Found', events.length, 'BountyPosted events');

        // Also query BountyCancelled to filter out cancelled ones
        const cancelResponse = await fetch(CONFIG.RPC_URL[CONFIG.NETWORK], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'suix_queryEvents',
                params: [
                    { MoveEventType: `${CONFIG.PACKAGE_ID}::deadlist::BountyCancelled` },
                    null,
                    50,
                    false
                ]
            })
        });

        const cancelData = await cancelResponse.json();
        const cancelledIds = new Set((cancelData.result?.data || []).map(e => e.parsedJson?.bounty_id));

        // Also query BountyClaimed
        const claimResponse = await fetch(CONFIG.RPC_URL[CONFIG.NETWORK], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'suix_queryEvents',
                params: [
                    { MoveEventType: `${CONFIG.PACKAGE_ID}::deadlist::BountyClaimed` },
                    null,
                    50,
                    false
                ]
            })
        });

        const claimData = await claimResponse.json();
        const claimedIds = new Set((claimData.result?.data || []).map(e => e.parsedJson?.bounty_id));

        // Build bounties list from events, excluding cancelled/claimed
        const bounties = [];
        for (const event of events) {
            const p = event.parsedJson;
            if (!p) continue;

            // Skip if cancelled or claimed
            if (cancelledIds.has(p.bounty_id) || claimedIds.has(p.bounty_id)) {
                continue;
            }

            // Decode target name from bytes
            let targetName = 'Unknown';
            if (p.target_name && Array.isArray(p.target_name)) {
                targetName = String.fromCharCode(...p.target_name);
            }

            bounties.push({
                id: event.id?.txDigest || `bounty-${p.bounty_id}`,
                onChainBountyId: p.bounty_id,
                target: {
                    id: p.target_character_id,
                    name: targetName,
                    tribe: 'Unknown',
                    avatar: targetName.substring(0, 2).toUpperCase(),
                },
                poster: {
                    id: p.poster,
                    name: truncateAddress(p.poster),
                    tribe: 'Unknown',
                    avatar: p.poster.slice(2, 4).toUpperCase(),
                },
                reward: mistToSui(p.reward_amount),
                minKillValue: 1,
                createdAt: event.timestampMs || Date.now(),
                status: 'active',
                blacklist: [],
                description: 'Bounty posted on DEADLIST.',
                isOwn: state.walletAddress && p.poster.toLowerCase() === state.walletAddress.toLowerCase(),
            });
        }

        console.log('[LoadBounties] Active bounties from chain:', bounties.length);

        // Merge: real bounties first, then mock bounties for display
        state.bounties = [...bounties, ...MOCK_BOUNTIES];
        renderBounties();
        renderMyBounties();

    } catch (error) {
        console.error('[LoadBounties] Error:', error);
    }
}

// Keep old function signature for compatibility
async function loadActiveBountiesOld() {
    if (state.useMockData || !bountyContract) {
        return; // Use mock data
    }

    try {
        const bounties = await bountyContract.getActiveBounties();
        if (bounties.length > 0) {
            // Transform blockchain data to UI format
            state.bounties = bounties.map(b => ({
                id: b.id,
                target: {
                    id: b.targetPlayerId,
                    name: `Player ${truncateAddress(b.targetPlayerId)}`,
                    tribe: 'Unknown',
                    avatar: b.targetPlayerId.slice(2, 4).toUpperCase(),
                },
                poster: {
                    id: b.poster,
                    name: truncateAddress(b.poster),
                    tribe: 'Unknown',
                    avatar: b.poster.slice(2, 4).toUpperCase(),
                },
                reward: mistToSui(b.reward),
                minKillValue: b.minKillValue,
                createdAt: b.timestamp,
                status: 'active',
                blacklist: [],
                description: 'Bounty posted on DEADLIST.',
            }));

            renderBounties();
        }
    } catch (error) {
        console.error('[LoadBounties] Error:', error);
    }
}

/**
 * Get bounty IDs for a specific player
 */
async function getBountiesOnPlayer(playerId) {
    if (state.useMockData || !bountyContract) {
        return [];
    }

    try {
        return await bountyContract.getBountyIdsOnPlayer(playerId);
    } catch (error) {
        console.error('[GetBounties] Error:', error);
        return [];
    }
}

/**
 * Get total and active bounty statistics
 */
async function getBountyStats() {
    if (state.useMockData || !bountyContract) {
        return {
            total: MOCK_BOUNTIES.length,
            active: MOCK_BOUNTIES.filter(b => b.status === 'active').length,
        };
    }

    try {
        const [total, active] = await Promise.all([
            bountyContract.getTotalBountyCount(),
            bountyContract.getActiveBountyCount(),
        ]);
        return { total, active };
    } catch (error) {
        console.error('[GetStats] Error:', error);
        return { total: 0, active: 0 };
    }
}

// =========================================
// Toast Notifications
// =========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');

    const icons = {
        success: '<svg class="w-5 h-5 text-eve-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
        error: '<svg class="w-5 h-5 text-eve-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
        info: '<svg class="w-5 h-5 text-eve-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        ${icons[type]}
        <span class="text-sm text-gray-200">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// =========================================
// Player Search Autocomplete
// =========================================

function setupPlayerSearch() {
    const input = document.getElementById('targetPlayer');
    const suggestions = document.getElementById('playerSuggestions');

    if (!input || !suggestions) return;

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();

        if (query.length < 2) {
            suggestions.classList.add('hidden');
            return;
        }

        const matches = MOCK_PLAYERS.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.id.toLowerCase().includes(query)
        ).slice(0, 5);

        if (matches.length === 0) {
            suggestions.classList.add('hidden');
            return;
        }

        suggestions.innerHTML = matches.map(player => `
            <div class="px-4 py-3 hover:bg-eve-gray cursor-pointer flex items-center space-x-3" onclick="selectPlayer('${player.name}')">
                <div class="target-avatar" style="width: 2rem; height: 2rem; font-size: 0.75rem;">${player.avatar}</div>
                <div>
                    <div class="font-medium text-white">${player.name}</div>
                    <div class="text-xs text-gray-500">${player.tribe}</div>
                </div>
            </div>
        `).join('');

        suggestions.classList.remove('hidden');
    });

    input.addEventListener('blur', () => {
        setTimeout(() => suggestions.classList.add('hidden'), 200);
    });
}

function selectPlayer(name) {
    document.getElementById('targetPlayer').value = name;
    document.getElementById('playerSuggestions').classList.add('hidden');
}

// =========================================
// Animated Stats Counter
// =========================================

function animateStats() {
    const stats = [
        { id: 'statTotalBounties', target: 247, suffix: '' },
        { id: 'statTotalValue', target: 1.2, suffix: 'M' },
        { id: 'statClaimed', target: 89, suffix: '' },
        { id: 'statHunters', target: 156, suffix: '' },
    ];

    stats.forEach(stat => {
        const el = document.getElementById(stat.id);
        if (!el) return;

        const duration = 2000;
        const steps = 60;
        const increment = stat.target / steps;
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= stat.target) {
                current = stat.target;
                clearInterval(timer);
            }

            if (stat.suffix === 'M') {
                el.textContent = current.toFixed(1) + stat.suffix;
            } else {
                el.textContent = Math.floor(current) + stat.suffix;
            }
        }, duration / steps);
    });
}

// =========================================
// Mobile Menu
// =========================================

function setupMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('mobileMenu');

    if (!btn || !menu) return;

    btn.addEventListener('click', () => {
        menu.classList.toggle('hidden');
    });
}

// =========================================
// Initialize Application
// =========================================

async function initializeApp() {
    console.log('[DEADLIST] Initializing application...');

    // Setup event listeners
    setupPlayerSearch();
    setupMobileMenu();

    // Form submission
    const form = document.getElementById('postBountyForm');
    if (form) {
        form.addEventListener('submit', postBounty);
    }

    // Search input enter key
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') applyFilters();
        });
    }

    // Wallet connect button
    const walletBtn = document.getElementById('connectWallet');
    if (walletBtn) {
        walletBtn.addEventListener('click', connectWallet);
    }

    // Close modal on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeBountyModal();
        }
    });

    // Initialize wallet manager (don't auto-connect)
    try {
        walletManager = new SuiWalletManager();
        await walletManager.init();
        console.log('[DEADLIST] Wallet manager initialized');
    } catch (error) {
        console.error('[DEADLIST] Wallet init error:', error);
    }

    // Initialize EVE Frontier API client
    try {
        if (typeof EVEFrontierAPI !== 'undefined') {
            eveAPI = new EVEFrontierAPI({
                demoMode: state.useMockData, // Use demo mode when mock data is enabled
            });
            console.log('[DEADLIST] EVE Frontier API initialized');
        } else {
            console.warn('[DEADLIST] EVE Frontier API not loaded, using mock verification');
        }
    } catch (error) {
        console.error('[DEADLIST] EVE API init error:', error);
    }

    // Initial render with mock data
    renderBounties();
    animateStats();

    // Load real bounties from blockchain + keep mock data for display
    loadActiveBounties();

    console.log('%c DEADLIST ', 'background: #ff4444; color: white; font-size: 24px; font-weight: bold;');
    console.log('%c The Unfarmable Bounty Board ', 'color: #00d4ff; font-size: 14px;');
    console.log('%c EVE Frontier x Sui Hackathon 2026 ', 'color: #666; font-size: 12px;');
    console.log('%c Sui Wallet Integration: ACTIVE ', 'color: #00ff88; font-size: 12px;');
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Export for external use
window.DEADLIST = {
    connectWallet,
    postBounty: postBounty,
    cancelBounty: cancelBountyAction,
    claimBounty: claimBountyAction,
    setupBountyTerminal: setupBountyTerminal,
    findUserOwnerCap: findUserOwnerCap,
    findUserStorageUnits: findUserStorageUnits,
    getBountiesOnPlayer,
    getBountyStats,
    loadActiveBounties,
    loadBounties: loadActiveBounties,
    walletManager: () => walletManager,
    bountyContract: () => bountyContract,
    eveAPI: () => eveAPI,
    state: () => state,
    CONFIG: CONFIG,
    // Anti-farming verification helpers
    verifyKillEligibility: async (killerId, targetId) => {
        if (!eveAPI) return { eligible: true, reason: 'API not available' };
        try {
            const sameTribe = await eveAPI.checkSameTribe(killerId, targetId);
            if (sameTribe) return { eligible: false, reason: 'Same tribe' };
            return { eligible: true, reason: null };
        } catch (e) {
            return { eligible: true, reason: 'Verification unavailable' };
        }
    },
};
