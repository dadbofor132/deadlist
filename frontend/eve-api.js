/**
 * EVE Frontier API Client
 * Integrates with the EVE Frontier game API for kill mail and tribe data
 *
 * API Documentation: https://docs.evefrontier.com/SwaggerWorldApi
 * Kill data indexed by Primordium indexer
 */

class EVEFrontierAPI {
    constructor(config = {}) {
        // API configuration
        this.baseUrl = config.baseUrl || 'https://api.evefrontier.com/v1';
        this.indexerUrl = config.indexerUrl || 'https://indexer.primordium.evefrontier.com/api';
        this.timeout = config.timeout || 10000;
        this.demoMode = config.demoMode || false;

        // Cache configuration
        this.cache = new Map();
        this.cacheTTL = config.cacheTTL || 60000; // 1 minute default

        // Request tracking
        this.pendingRequests = new Map();
    }

    /**
     * Internal fetch wrapper with timeout, caching, and error handling
     */
    async _fetch(url, options = {}) {
        const cacheKey = `${options.method || 'GET'}:${url}`;

        // Check cache first
        const cached = this._getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        // Deduplicate concurrent requests
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const requestPromise = (async () => {
            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...options.headers
                    }
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new EVEAPIError(
                        `API request failed: ${response.status} ${response.statusText}`,
                        response.status
                    );
                }

                const data = await response.json();

                // Cache successful responses
                this._setCache(cacheKey, data);

                return data;
            } catch (error) {
                clearTimeout(timeoutId);

                if (error.name === 'AbortError') {
                    throw new EVEAPIError('Request timeout', 408);
                }

                throw error;
            } finally {
                this.pendingRequests.delete(cacheKey);
            }
        })();

        this.pendingRequests.set(cacheKey, requestPromise);
        return requestPromise;
    }

    /**
     * Cache management
     */
    _getFromCache(key) {
        const entry = this.cache.get(key);
        if (entry && Date.now() - entry.timestamp < this.cacheTTL) {
            return entry.data;
        }
        this.cache.delete(key);
        return null;
    }

    _setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    /**
     * Get kill mails involving a specific player
     *
     * @param {string} playerId - The player's character ID or wallet address
     * @param {Object} options - Query options
     * @param {number} options.limit - Max results to return (default 50)
     * @param {number} options.offset - Pagination offset
     * @param {string} options.role - Filter by 'killer', 'victim', or 'both' (default)
     * @param {number} options.fromTimestamp - Filter kills after this timestamp
     * @param {number} options.toTimestamp - Filter kills before this timestamp
     * @returns {Promise<KillMailResponse>}
     */
    async getKillMails(playerId, options = {}) {
        if (this.demoMode) {
            return this._getMockKillMails(playerId, options);
        }

        const params = new URLSearchParams({
            limit: options.limit || 50,
            offset: options.offset || 0
        });

        if (options.role && options.role !== 'both') {
            params.append('role', options.role);
        }
        if (options.fromTimestamp) {
            params.append('from', options.fromTimestamp);
        }
        if (options.toTimestamp) {
            params.append('to', options.toTimestamp);
        }

        try {
            // Try the Primordium indexer first for kill data
            const url = `${this.indexerUrl}/killmails/character/${playerId}?${params}`;
            return await this._fetch(url);
        } catch (error) {
            console.warn('EVE API: Failed to fetch kill mails, using fallback', error);
            return this._getMockKillMails(playerId, options);
        }
    }

    /**
     * Get character information including tribe membership
     *
     * @param {string} characterId - The character ID or wallet address
     * @returns {Promise<CharacterInfo>}
     */
    async getCharacter(characterId) {
        if (this.demoMode) {
            return this._getMockCharacter(characterId);
        }

        try {
            const url = `${this.baseUrl}/characters/${characterId}`;
            return await this._fetch(url);
        } catch (error) {
            console.warn('EVE API: Failed to fetch character, using fallback', error);
            return this._getMockCharacter(characterId);
        }
    }

    /**
     * Get tribe information and member list
     *
     * @param {string} tribeId - The tribe ID
     * @returns {Promise<TribeInfo>}
     */
    async getTribe(tribeId) {
        if (this.demoMode) {
            return this._getMockTribe(tribeId);
        }

        try {
            const url = `${this.baseUrl}/tribes/${tribeId}`;
            return await this._fetch(url);
        } catch (error) {
            console.warn('EVE API: Failed to fetch tribe, using fallback', error);
            return this._getMockTribe(tribeId);
        }
    }

    /**
     * Verify that a specific kill event occurred
     * Used for bounty validation
     *
     * @param {string} killerId - The killer's character ID
     * @param {string} victimId - The victim's character ID
     * @param {number} timestamp - Unix timestamp (seconds) of the alleged kill
     * @param {number} tolerance - Time tolerance in seconds (default 3600 = 1 hour)
     * @returns {Promise<KillVerification>}
     */
    async verifyKill(killerId, victimId, timestamp, tolerance = 3600) {
        if (this.demoMode) {
            return this._getMockKillVerification(killerId, victimId, timestamp);
        }

        try {
            // Query for kills by the killer around the given timestamp
            const fromTimestamp = timestamp - tolerance;
            const toTimestamp = timestamp + tolerance;

            const kills = await this.getKillMails(killerId, {
                role: 'killer',
                fromTimestamp,
                toTimestamp,
                limit: 100
            });

            // Search for a matching kill
            const matchingKill = kills.killmails?.find(km =>
                km.victim?.characterId === victimId ||
                km.victim?.address?.toLowerCase() === victimId.toLowerCase()
            );

            if (matchingKill) {
                return {
                    verified: true,
                    killmail: matchingKill,
                    killerId: killerId,
                    victimId: victimId,
                    timestamp: matchingKill.timestamp,
                    killmailId: matchingKill.id
                };
            }

            return {
                verified: false,
                killerId: killerId,
                victimId: victimId,
                requestedTimestamp: timestamp,
                message: 'No matching kill found within time tolerance'
            };
        } catch (error) {
            console.warn('EVE API: Kill verification failed', error);
            return this._getMockKillVerification(killerId, victimId, timestamp);
        }
    }

    /**
     * Check if two players are in the same tribe
     * Used for bounty restrictions (can't bounty tribemates)
     *
     * @param {string} playerA - First player's character ID
     * @param {string} playerB - Second player's character ID
     * @returns {Promise<TribeMembershipCheck>}
     */
    async checkSameTribe(playerA, playerB) {
        if (this.demoMode) {
            return this._getMockTribeCheck(playerA, playerB);
        }

        try {
            // Fetch both characters in parallel
            const [charA, charB] = await Promise.all([
                this.getCharacter(playerA),
                this.getCharacter(playerB)
            ]);

            const tribeA = charA.tribe?.id || charA.tribeId;
            const tribeB = charB.tribe?.id || charB.tribeId;

            const sameTribe = tribeA && tribeB && tribeA === tribeB;

            return {
                sameTribe,
                playerA: {
                    characterId: playerA,
                    name: charA.name,
                    tribeId: tribeA,
                    tribeName: charA.tribe?.name
                },
                playerB: {
                    characterId: playerB,
                    name: charB.name,
                    tribeId: tribeB,
                    tribeName: charB.tribe?.name
                }
            };
        } catch (error) {
            console.warn('EVE API: Tribe check failed', error);
            return this._getMockTribeCheck(playerA, playerB);
        }
    }

    /**
     * Get recent kills across all players (for leaderboards/activity feed)
     *
     * @param {Object} options - Query options
     * @returns {Promise<KillMailResponse>}
     */
    async getRecentKills(options = {}) {
        if (this.demoMode) {
            return this._getMockRecentKills(options);
        }

        try {
            const params = new URLSearchParams({
                limit: options.limit || 20,
                offset: options.offset || 0
            });

            const url = `${this.indexerUrl}/killmails/recent?${params}`;
            return await this._fetch(url);
        } catch (error) {
            console.warn('EVE API: Failed to fetch recent kills', error);
            return this._getMockRecentKills(options);
        }
    }

    /**
     * Search for characters by name
     *
     * @param {string} query - Search query
     * @returns {Promise<CharacterSearchResult>}
     */
    async searchCharacters(query) {
        if (this.demoMode) {
            return this._getMockCharacterSearch(query);
        }

        try {
            const params = new URLSearchParams({ q: query, limit: 10 });
            const url = `${this.baseUrl}/characters/search?${params}`;
            return await this._fetch(url);
        } catch (error) {
            console.warn('EVE API: Character search failed', error);
            return this._getMockCharacterSearch(query);
        }
    }

    // ==================== Mock Data Methods ====================

    _getMockKillMails(playerId, options = {}) {
        const now = Math.floor(Date.now() / 1000);
        const limit = options.limit || 50;

        // Generate consistent mock data based on playerId
        const hash = this._hashString(playerId);
        const killCount = (hash % 15) + 5;

        const killmails = [];
        for (let i = 0; i < Math.min(killCount, limit); i++) {
            const isKiller = (hash + i) % 2 === 0;
            const killTime = now - (i * 3600 * 24) - (hash % 3600);

            killmails.push({
                id: `km_${playerId.slice(0, 8)}_${i}`,
                timestamp: killTime,
                killer: {
                    characterId: isKiller ? playerId : `0x${((hash + i) * 12345).toString(16).slice(0, 40)}`,
                    name: isKiller ? 'You' : this._generateMockName(hash + i),
                    shipType: this._getRandomShip(hash + i)
                },
                victim: {
                    characterId: isKiller ? `0x${((hash + i) * 54321).toString(16).slice(0, 40)}` : playerId,
                    name: isKiller ? this._generateMockName(hash + i + 100) : 'You',
                    shipType: this._getRandomShip(hash + i + 50)
                },
                location: {
                    solarSystem: this._getRandomSystem(hash + i),
                    coordinates: {
                        x: (hash + i) % 1000000,
                        y: ((hash + i) * 7) % 1000000,
                        z: ((hash + i) * 13) % 1000000
                    }
                },
                value: ((hash + i) % 1000) * 1000000
            });
        }

        return {
            total: killCount,
            killmails,
            pagination: {
                limit,
                offset: options.offset || 0,
                hasMore: killCount > limit
            }
        };
    }

    _getMockCharacter(characterId) {
        const hash = this._hashString(characterId);
        const hasTribe = hash % 3 !== 0;

        return {
            characterId,
            address: characterId,
            name: this._generateMockName(hash),
            created: Date.now() - (hash % 365) * 24 * 60 * 60 * 1000,
            tribe: hasTribe ? {
                id: `tribe_${(hash % 100).toString().padStart(3, '0')}`,
                name: this._generateMockTribeName(hash),
                role: hash % 5 === 0 ? 'leader' : 'member'
            } : null,
            stats: {
                kills: hash % 500,
                deaths: (hash % 300) + 10,
                bountyValue: (hash % 100) * 1000000000
            }
        };
    }

    _getMockTribe(tribeId) {
        const hash = this._hashString(tribeId);
        const memberCount = (hash % 50) + 5;

        const members = [];
        for (let i = 0; i < memberCount; i++) {
            members.push({
                characterId: `0x${((hash + i) * 11111).toString(16).slice(0, 40)}`,
                name: this._generateMockName(hash + i),
                role: i === 0 ? 'leader' : (i < 3 ? 'officer' : 'member'),
                joinedAt: Date.now() - (i * 24 * 60 * 60 * 1000)
            });
        }

        return {
            id: tribeId,
            name: this._generateMockTribeName(hash),
            description: 'A tribe of space pioneers exploring the frontier.',
            created: Date.now() - (hash % 365) * 24 * 60 * 60 * 1000,
            memberCount,
            members,
            stats: {
                totalKills: hash % 5000,
                totalDeaths: (hash % 3000) + 100,
                territoriesControlled: hash % 20
            }
        };
    }

    _getMockKillVerification(killerId, victimId, timestamp) {
        // Simulate ~70% verification success rate for demo
        const hash = this._hashString(killerId + victimId + timestamp);
        const verified = hash % 10 < 7;

        if (verified) {
            return {
                verified: true,
                killmail: {
                    id: `km_verified_${hash.toString(16).slice(0, 8)}`,
                    timestamp: timestamp + (hash % 1800) - 900, // Within 15 min
                    killer: {
                        characterId: killerId,
                        name: this._generateMockName(hash)
                    },
                    victim: {
                        characterId: victimId,
                        name: this._generateMockName(hash + 100)
                    }
                },
                killerId,
                victimId,
                timestamp: timestamp + (hash % 1800) - 900,
                killmailId: `km_verified_${hash.toString(16).slice(0, 8)}`
            };
        }

        return {
            verified: false,
            killerId,
            victimId,
            requestedTimestamp: timestamp,
            message: 'No matching kill found within time tolerance'
        };
    }

    _getMockTribeCheck(playerA, playerB) {
        const hashA = this._hashString(playerA);
        const hashB = this._hashString(playerB);

        // Same tribe if hashes mod 10 are equal (10% chance for random addresses)
        const sameTribe = hashA % 10 === hashB % 10;
        const tribeId = sameTribe ? `tribe_${(hashA % 100).toString().padStart(3, '0')}` : null;

        return {
            sameTribe,
            playerA: {
                characterId: playerA,
                name: this._generateMockName(hashA),
                tribeId: `tribe_${(hashA % 100).toString().padStart(3, '0')}`,
                tribeName: this._generateMockTribeName(hashA)
            },
            playerB: {
                characterId: playerB,
                name: this._generateMockName(hashB),
                tribeId: sameTribe ? tribeId : `tribe_${(hashB % 100).toString().padStart(3, '0')}`,
                tribeName: this._generateMockTribeName(sameTribe ? hashA : hashB)
            }
        };
    }

    _getMockRecentKills(options = {}) {
        const now = Math.floor(Date.now() / 1000);
        const limit = options.limit || 20;
        const killmails = [];

        for (let i = 0; i < limit; i++) {
            const killTime = now - (i * 300); // Every 5 minutes

            killmails.push({
                id: `km_recent_${i}`,
                timestamp: killTime,
                killer: {
                    characterId: `0x${(i * 12345).toString(16).padStart(40, '0')}`,
                    name: this._generateMockName(i * 100),
                    shipType: this._getRandomShip(i)
                },
                victim: {
                    characterId: `0x${(i * 54321).toString(16).padStart(40, '0')}`,
                    name: this._generateMockName(i * 200),
                    shipType: this._getRandomShip(i + 50)
                },
                location: {
                    solarSystem: this._getRandomSystem(i)
                },
                value: (i + 1) * 500000000
            });
        }

        return {
            total: 1000,
            killmails,
            pagination: {
                limit,
                offset: options.offset || 0,
                hasMore: true
            }
        };
    }

    _getMockCharacterSearch(query) {
        const hash = this._hashString(query);
        const resultCount = Math.min((hash % 8) + 1, 10);
        const characters = [];

        for (let i = 0; i < resultCount; i++) {
            characters.push({
                characterId: `0x${((hash + i) * 99999).toString(16).slice(0, 40)}`,
                name: `${query.charAt(0).toUpperCase()}${query.slice(1)}${i > 0 ? i : ''}`,
                tribe: (hash + i) % 3 !== 0 ? {
                    id: `tribe_${((hash + i) % 100).toString().padStart(3, '0')}`,
                    name: this._generateMockTribeName(hash + i)
                } : null
            });
        }

        return {
            query,
            total: resultCount,
            characters
        };
    }

    // ==================== Helper Methods ====================

    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    _generateMockName(seed) {
        const prefixes = ['Dark', 'Star', 'Nova', 'Void', 'Solar', 'Lunar', 'Astro', 'Cyber', 'Neo', 'Quantum'];
        const suffixes = ['Runner', 'Hunter', 'Walker', 'Rider', 'Striker', 'Phoenix', 'Wolf', 'Hawk', 'Blade', 'Storm'];
        return `${prefixes[seed % prefixes.length]}${suffixes[(seed * 7) % suffixes.length]}${seed % 100}`;
    }

    _generateMockTribeName(seed) {
        const adjectives = ['Shadow', 'Iron', 'Golden', 'Silent', 'Crimson', 'Azure', 'Obsidian', 'Emerald'];
        const nouns = ['Legion', 'Vanguard', 'Syndicate', 'Coalition', 'Order', 'Fleet', 'Corps', 'Alliance'];
        return `${adjectives[seed % adjectives.length]} ${nouns[(seed * 3) % nouns.length]}`;
    }

    _getRandomShip(seed) {
        const ships = [
            'Frigate', 'Destroyer', 'Cruiser', 'Battlecruiser', 'Battleship',
            'Interceptor', 'Assault Ship', 'Heavy Assault', 'Command Ship', 'Dreadnought'
        ];
        return ships[seed % ships.length];
    }

    _getRandomSystem(seed) {
        const systems = [
            'Alpha Centauri', 'Proxima Prime', 'New Eden', 'Frontier-7',
            'Deep Space 9', 'Omega Station', 'Nebula Core', 'Void Gate',
            'Sol Minor', 'Terra Nova', 'Helios Prime', 'Dark Sector'
        ];
        return systems[seed % systems.length];
    }
}

/**
 * Custom error class for EVE API errors
 */
class EVEAPIError extends Error {
    constructor(message, statusCode = null) {
        super(message);
        this.name = 'EVEAPIError';
        this.statusCode = statusCode;
    }
}

// ==================== Type Definitions (JSDoc) ====================

/**
 * @typedef {Object} KillMailResponse
 * @property {number} total - Total number of matching kills
 * @property {KillMail[]} killmails - Array of kill mail objects
 * @property {Object} pagination - Pagination info
 */

/**
 * @typedef {Object} KillMail
 * @property {string} id - Unique kill mail ID
 * @property {number} timestamp - Unix timestamp of the kill
 * @property {Object} killer - Killer information
 * @property {Object} victim - Victim information
 * @property {Object} location - Kill location
 * @property {number} value - Estimated LUX value
 */

/**
 * @typedef {Object} CharacterInfo
 * @property {string} characterId - Character ID
 * @property {string} address - Wallet address
 * @property {string} name - Character name
 * @property {Object} tribe - Tribe membership info
 * @property {Object} stats - Character statistics
 */

/**
 * @typedef {Object} TribeInfo
 * @property {string} id - Tribe ID
 * @property {string} name - Tribe name
 * @property {string} description - Tribe description
 * @property {number} memberCount - Number of members
 * @property {Object[]} members - Array of tribe members
 */

/**
 * @typedef {Object} KillVerification
 * @property {boolean} verified - Whether the kill was verified
 * @property {KillMail} [killmail] - The matching kill mail if verified
 * @property {string} killerId - Killer character ID
 * @property {string} victimId - Victim character ID
 * @property {number} timestamp - Kill timestamp if verified
 */

/**
 * @typedef {Object} TribeMembershipCheck
 * @property {boolean} sameTribe - Whether players are in the same tribe
 * @property {Object} playerA - First player info
 * @property {Object} playerB - Second player info
 */

// ==================== Export ====================

// Export for browser use
if (typeof window !== 'undefined') {
    window.EVEFrontierAPI = EVEFrontierAPI;
    window.EVEAPIError = EVEAPIError;
}

// Export for module use (Node.js/bundlers)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EVEFrontierAPI, EVEAPIError };
}
