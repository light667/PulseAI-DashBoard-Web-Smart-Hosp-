// ==============================================================================
// API SERVICE - Centralisation des appels Supabase
// ==============================================================================

import { supabase } from '../supabase.js';

/**
 * Service API centralisé avec gestion d'erreurs et retry automatique
 */
class ApiService {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    /**
     * Exécute une requête avec retry automatique
     */
    async executeWithRetry(fn, retries = this.maxRetries) {
        try {
            const result = await fn();
            if (result.error) throw result.error;
            return { data: result.data, error: null };
        } catch (error) {
            if (retries > 0 && this.isRetryable(error)) {
                await this.sleep(this.retryDelay);
                return this.executeWithRetry(fn, retries - 1);
            }
            console.error('API Error:', error);
            return { data: null, error };
        }
    }

    /**
     * Détermine si une erreur est réessayable
     */
    isRetryable(error) {
        const retryableCodes = ['PGRST301', 'PGRST302', '500', '502', '503', '504'];
        return retryableCodes.some(code => error.message?.includes(code));
    }

    /**
     * Délai pour retry
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==========================================================================
    // HOSPITALS
    // ==========================================================================
    
    async getHospitalByOwner(ownerId) {
        return this.executeWithRetry(() => 
            supabase
                .from('hospitals')
                .select('*')
                .eq('owner_id', ownerId)
                .maybeSingle()
        );
    }

    async getHospitalWithServices(hospitalId) {
        return this.executeWithRetry(() =>
            supabase
                .from('hospitals')
                .select(`
                    *,
                    hospital_services(
                        *,
                        services(id, name, icon, category)
                    )
                `)
                .eq('id', hospitalId)
                .single()
        );
    }

    async updateHospital(hospitalId, updates) {
        return this.executeWithRetry(() =>
            supabase
                .from('hospitals')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', hospitalId)
                .select()
        );
    }

    async createHospital(data) {
        return this.executeWithRetry(() =>
            supabase
                .from('hospitals')
                .insert(data)
                .select()
                .single()
        );
    }

    async getAllHospitalsByStatus(status) {
        return this.executeWithRetry(() =>
            supabase
                .from('hospitals')
                .select(`
                    *,
                    hospital_services(
                        service_id,
                        is_active,
                        doctors_total,
                        doctors_available,
                        beds_total,
                        beds_available,
                        queue_length,
                        services(name, icon)
                    )
                `)
                .eq('status', status)
                .order('created_at', { ascending: false })
        );
    }

    async getApprovedHospitals() {
        return this.executeWithRetry(() =>
            supabase
                .from('hospitals')
                .select(`
                    *,
                    hospital_services(
                        service_id,
                        doctors_total,
                        doctors_available,
                        beds_total,
                        beds_available,
                        queue_length,
                        is_active,
                        services(name, icon)
                    )
                `)
                .eq('status', 'approved')
                .order('name')
        );
    }

    // ==========================================================================
    // HOSPITAL SERVICES
    // ==========================================================================

    async getHospitalServices(hospitalId) {
        return this.executeWithRetry(() =>
            supabase
                .from('hospital_services')
                .select(`
                    *,
                    services(id, name, icon, category)
                `)
                .eq('hospital_id', hospitalId)
        );
    }

    async updateServiceStats(serviceId, stats) {
        return this.executeWithRetry(() =>
            supabase
                .from('hospital_services')
                .update({ ...stats, updated_at: new Date().toISOString() })
                .eq('id', serviceId)
        );
    }

    async toggleServiceStatus(serviceId, isActive) {
        return this.executeWithRetry(() =>
            supabase
                .from('hospital_services')
                .update({ is_active: isActive, updated_at: new Date().toISOString() })
                .eq('id', serviceId)
        );
    }

    async upsertHospitalService(hospitalId, serviceId, data = {}) {
        return this.executeWithRetry(() =>
            supabase
                .from('hospital_services')
                .upsert({
                    hospital_id: hospitalId,
                    service_id: serviceId,
                    is_active: data.is_active ?? true,
                    doctors_total: data.doctors_total ?? 0,
                    doctors_available: data.doctors_available ?? 0,
                    beds_total: data.beds_total ?? 0,
                    beds_available: data.beds_available ?? 0,
                    queue_length: data.queue_length ?? 0,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'hospital_id,service_id'
                })
        );
    }

    // ==========================================================================
    // SERVICES
    // ==========================================================================

    async getAllServices() {
        return this.executeWithRetry(() =>
            supabase
                .from('services')
                .select('*')
                .order('category, name')
        );
    }

    // ==========================================================================
    // PROFILES
    // ==========================================================================

    async getProfile(userId) {
        return this.executeWithRetry(() =>
            supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single()
        );
    }

    async updateProfile(userId, updates) {
        return this.executeWithRetry(() =>
            supabase
                .from('profiles')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('user_id', userId)
        );
    }

    // ==========================================================================
    // RATINGS
    // ==========================================================================

    async getRatings(hospitalId) {
        return this.executeWithRetry(() =>
            supabase
                .from('ratings')
                .select('*')
                .eq('hospital_id', hospitalId)
                .order('created_at', { ascending: false })
        );
    }

    async createRating(data) {
        return this.executeWithRetry(() =>
            supabase
                .from('ratings')
                .insert(data)
        );
    }

    // ==========================================================================
    // ADMIN
    // ==========================================================================

    async updateHospitalStatus(hospitalId, status, rejectionReason = null) {
        const updates = { 
            status, 
            updated_at: new Date().toISOString()
        };
        if (rejectionReason) updates.rejection_reason = rejectionReason;
        
        return this.executeWithRetry(() =>
            supabase
                .from('hospitals')
                .update(updates)
                .eq('id', hospitalId)
        );
    }

    async deleteHospital(hospitalId) {
        return this.executeWithRetry(() =>
            supabase
                .from('hospitals')
                .delete()
                .eq('id', hospitalId)
        );
    }

    // ==========================================================================
    // ANALYTICS
    // ==========================================================================

    async getHospitalStats(hospitalId) {
        const { data: services } = await this.getHospitalServices(hospitalId);
        
        if (!services) return null;

        return {
            totalServices: services.length,
            activeServices: services.filter(s => s.is_active).length,
            totalDoctors: services.reduce((sum, s) => sum + (s.doctors_total || 0), 0),
            availableDoctors: services.reduce((sum, s) => sum + (s.doctors_available || 0), 0),
            totalBeds: services.reduce((sum, s) => sum + (s.beds_total || 0), 0),
            availableBeds: services.reduce((sum, s) => sum + (s.beds_available || 0), 0),
            totalQueue: services.reduce((sum, s) => sum + (s.queue_length || 0), 0),
            occupancyRate: this.calculateOccupancyRate(services)
        };
    }

    calculateOccupancyRate(services) {
        const totalBeds = services.reduce((sum, s) => sum + (s.beds_total || 0), 0);
        const availableBeds = services.reduce((sum, s) => sum + (s.beds_available || 0), 0);
        
        if (totalBeds === 0) return 0;
        
        return ((totalBeds - availableBeds) / totalBeds * 100).toFixed(1);
    }
}

// Export singleton
export const api = new ApiService();
export default api;
