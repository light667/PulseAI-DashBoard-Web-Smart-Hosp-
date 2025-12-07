import supabase from './supabase.js';

/**
 * Gestion des utilisateurs
 */

// Récupérer tous les utilisateurs
async function getAllUsers() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        return { success: false, error: error.message };
    }
}

// Récupérer un utilisateur par ID
async function getUserById(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur:', error);
        return { success: false, error: error.message };
    }
}

// Mettre à jour un utilisateur
async function updateUser(userId, updates) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
        return { success: false, error: error.message };
    }
}

// Supprimer un utilisateur
async function deleteUser(userId) {
    try {
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('user_id', userId);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'utilisateur:', error);
        return { success: false, error: error.message };
    }
}

// Rechercher des utilisateurs
async function searchUsers(query) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`);
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Erreur lors de la recherche d\'utilisateurs:', error);
        return { success: false, error: error.message };
    }
}

// Statistiques utilisateurs
async function getUserStats() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*');
        
        if (error) throw error;
        
        const stats = {
            totalUsers: data.length,
            activeUsers: data.filter(u => u.is_active).length,
            admins: data.filter(u => u.role === 'admin').length,
            newUsersThisMonth: data.filter(u => {
                const created = new Date(u.created_at);
                const now = new Date();
                return created.getMonth() === now.getMonth() && 
                       created.getFullYear() === now.getFullYear();
            }).length
        };
        
        return { success: true, data: stats };
    } catch (error) {
        console.error('Erreur lors du calcul des statistiques:', error);
        return { success: false, error: error.message };
    }
}

// Changer le rôle d'un utilisateur
async function updateUserRole(userId, role) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ role, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Erreur lors du changement de rôle:', error);
        return { success: false, error: error.message };
    }
}

// Activer/désactiver un utilisateur
async function toggleUserStatus(userId, isActive) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ 
                is_active: isActive, 
                updated_at: new Date().toISOString() 
            })
            .eq('user_id', userId);
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Erreur lors du changement de statut:', error);
        return { success: false, error: error.message };
    }
}

export {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    searchUsers,
    getUserStats,
    updateUserRole,
    toggleUserStatus
};
