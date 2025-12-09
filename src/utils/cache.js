// ==============================================================================
// CACHE MANAGER - Gestion du cache intelligent
// ==============================================================================

class CacheManager {
    constructor() {
        this.prefix = 'pulseai_cache_';
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Stocke des données en cache
     */
    set(key, data, ttl = this.defaultTTL) {
        try {
            const item = {
                data,
                timestamp: Date.now(),
                ttl
            };
            localStorage.setItem(this.prefix + key, JSON.stringify(item));
            return true;
        } catch (error) {
            console.warn('Cache set error:', error);
            return false;
        }
    }

    /**
     * Récupère des données du cache
     */
    get(key) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            if (!item) return null;

            const parsed = JSON.parse(item);
            
            // Vérifier l'expiration
            if (Date.now() - parsed.timestamp > parsed.ttl) {
                this.remove(key);
                return null;
            }

            return parsed.data;
        } catch (error) {
            console.warn('Cache get error:', error);
            return null;
        }
    }

    /**
     * Supprime une entrée du cache
     */
    remove(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.warn('Cache remove error:', error);
            return false;
        }
    }

    /**
     * Vide tout le cache
     */
    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.warn('Cache clear error:', error);
            return false;
        }
    }

    /**
     * Récupère avec fallback (cache ou fonction)
     */
    async getOrFetch(key, fetchFn, ttl = this.defaultTTL) {
        // Essayer le cache d'abord
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        // Sinon, exécuter la fonction
        const data = await fetchFn();
        if (data) {
            this.set(key, data, ttl);
        }
        return data;
    }

    /**
     * Invalide le cache correspondant à un pattern
     */
    invalidate(pattern) {
        try {
            const keys = Object.keys(localStorage);
            const regex = new RegExp(this.prefix + pattern);
            
            keys.forEach(key => {
                if (regex.test(key)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.warn('Cache invalidate error:', error);
            return false;
        }
    }
}

export const cache = new CacheManager();
export default cache;
