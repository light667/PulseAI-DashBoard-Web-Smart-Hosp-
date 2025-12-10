// ==============================================================================
// STATE MANAGEMENT - Gestionnaire d'état global
// ==============================================================================

/**
 * Gestionnaire d'état simple et efficace pour l'application
 */
class StateManager {
    constructor() {
        this.state = {
            user: null,
            hospital: null,
            services: [],
            hospitalServices: [],
            loading: false,
            error: null
        };
        this.listeners = {};
    }

    /**
     * Récupère l'état actuel
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Met à jour l'état
     */
    setState(updates) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...updates };
        
        // Notifier les listeners
        Object.keys(updates).forEach(key => {
            if (this.listeners[key]) {
                this.listeners[key].forEach(callback => {
                    callback(this.state[key], prevState[key]);
                });
            }
        });

        // Notifier les listeners globaux
        if (this.listeners['*']) {
            this.listeners['*'].forEach(callback => {
                callback(this.state, prevState);
            });
        }
    }

    /**
     * S'abonne aux changements d'état
     */
    subscribe(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(callback);

        // Retourne une fonction de désabonnement
        return () => {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
        };
    }

    /**
     * Réinitialise l'état
     */
    reset() {
        this.setState({
            user: null,
            hospital: null,
            services: [],
            hospitalServices: [],
            loading: false,
            error: null
        });
    }

    // Helpers spécifiques
    setUser(user) {
        this.setState({ user });
    }

    setHospital(hospital) {
        this.setState({ hospital });
    }

    setServices(services) {
        this.setState({ services });
    }

    setHospitalServices(hospitalServices) {
        this.setState({ hospitalServices });
    }

    setLoading(loading) {
        this.setState({ loading });
    }

    setError(error) {
        this.setState({ error });
    }

    clearError() {
        this.setState({ error: null });
    }
}

// Export singleton
export const store = new StateManager();
export default store;
