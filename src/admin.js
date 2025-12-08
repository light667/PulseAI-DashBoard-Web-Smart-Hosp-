import { supabase } from './supabase.js';
import { 
    getAllUsers, 
    getUserStats, 
    updateUserRole, 
    toggleUserStatus,
    deleteUser 
} from './manage.js';

// Éléments DOM
const pendingList = document.getElementById('pendingList')
const approvedList = document.getElementById('approvedList')
const rejectedList = document.getElementById('rejectedList')

// État
let currentAdmin = null;

// Initialisation
async function init() {
    // Vérifier la session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        // Vérifier si l'utilisateur est admin
        const isAdmin = await checkAdminRole(session.user.id);
        
        if (isAdmin) {
            currentAdmin = session.user;
            showAdminPanel();
            await loadDashboard();
        } else {
            showUnauthorized();
        }
    } else {
        showUnauthorized();
    }
}

// Vérifier le rôle admin
async function checkAdminRole(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', userId)
            .single();
        
        if (error) throw error;
        return data.role === 'admin';
    } catch (error) {
        console.error('Erreur lors de la vérification du rôle:', error);
        return false;
    }
}

// Charger le dashboard
async function loadDashboard() {
    await Promise.all([
        loadUsers(),
        loadStats()
    ]);
}

// Charger les utilisateurs
async function loadUsers() {
    const result = await getAllUsers();
    
    if (result.success) {
        displayUsers(result.data);
    } else {
        showError('Erreur lors du chargement des utilisateurs');
    }
}

// Afficher les utilisateurs
function displayUsers(users) {
    usersList.innerHTML = '';
    
    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.innerHTML = `
            <h4>${user.email}</h4>
            <p>Rôle: ${user.role || 'user'}</p>
            <p>Statut: ${user.is_active ? 'Actif' : 'Inactif'}</p>
            <p>Créé le: ${new Date(user.created_at).toLocaleDateString('fr-FR')}</p>
            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <button onclick="window.adminActions.toggleRole('${user.user_id}', '${user.role}')">
                    ${user.role === 'admin' ? 'Rétrograder' : 'Promouvoir'}
                </button>
                <button onclick="window.adminActions.toggleStatus('${user.user_id}', ${!user.is_active})">
                    ${user.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button onclick="window.adminActions.removeUser('${user.user_id}')" style="background: var(--error);">
                    Supprimer
                </button>
            </div>
        `;
        usersList.appendChild(userCard);
    });
}

// Charger les statistiques
async function loadStats() {
    const result = await getUserStats();
    
    if (result.success) {
        displayStats(result.data);
    } else {
        showError('Erreur lors du chargement des statistiques');
    }
}

// Afficher les statistiques
function displayStats(stats) {
    statsContent.innerHTML = `
        <div class="stat-card">
            <div class="value">${stats.totalUsers}</div>
            <div class="label">Utilisateurs totaux</div>
        </div>
        <div class="stat-card">
            <div class="value">${stats.activeUsers}</div>
            <div class="label">Utilisateurs actifs</div>
        </div>
        <div class="stat-card">
            <div class="value">${stats.admins}</div>
            <div class="label">Administrateurs</div>
        </div>
        <div class="stat-card">
            <div class="value">${stats.newUsersThisMonth}</div>
            <div class="label">Nouveaux ce mois</div>
        </div>
    `;
}

// Actions admin
window.adminActions = {
    toggleRole: async (userId, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        const result = await updateUserRole(userId, newRole);
        
        if (result.success) {
            await loadUsers();
            showSuccess('Rôle mis à jour');
        } else {
            showError('Erreur lors de la mise à jour du rôle');
        }
    },
    
    toggleStatus: async (userId, newStatus) => {
        const result = await toggleUserStatus(userId, newStatus);
        
        if (result.success) {
            await loadUsers();
            showSuccess('Statut mis à jour');
        } else {
            showError('Erreur lors de la mise à jour du statut');
        }
    },
    
    removeUser: async (userId) => {
        if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
            const result = await deleteUser(userId);
            
            if (result.success) {
                await loadDashboard();
                showSuccess('Utilisateur supprimé');
            } else {
                showError('Erreur lors de la suppression');
            }
        }
    }
};

// Affichage
function showAdminPanel() {
    adminAuth.style.display = 'none';
    adminPanel.style.display = 'block';
}

function showUnauthorized() {
    adminAuth.style.display = 'block';
    adminPanel.style.display = 'none';
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    adminPanel.insertBefore(errorDiv, adminPanel.firstChild);
    setTimeout(() => errorDiv.remove(), 3000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    adminPanel.insertBefore(successDiv, adminPanel.firstChild);
    setTimeout(() => successDiv.remove(), 3000);
}

// Event Listeners
if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
}

// Démarrer l'application
init();
