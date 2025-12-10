// ==============================================================================
// PULSEAI - PANNEAU ADMIN DE VALIDATION
// ==============================================================================

import { supabase } from './supabase.js';

let currentAdmin = null;
let hospitals = { pending: [], approved: [], rejected: [] };

// ==============================================================================
// INITIALISATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAuth();
    await loadHospitals();
    setupEventListeners();
});

// ==============================================================================
// VÉRIFICATION ADMIN
// ==============================================================================
async function checkAdminAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (!session) {
        alert('Accès non autorisé - Connexion requise');
        window.location.href = 'index.html';
        return;
    }
    
    currentAdmin = session.user;
    
    // Vérifier le rôle admin dans la base
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', currentAdmin.id)
        .single();
    
    if (!profile || profile.role !== 'admin') {
        alert('Accès non autorisé - Rôle administrateur requis');
        window.location.href = 'dashboard.html';
        return;
    }
}

// ==============================================================================
// CHARGEMENT DES HÔPITAUX
// ==============================================================================
async function loadHospitals() {
    try {
        const { data, error } = await supabase
            .from('hospitals')
            .select(`
                *,
                hospital_services(
                    service_id,
                    is_active,
                    total_doctors,
                    total_beds,
                    services(name, icon)
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Grouper par statut
        hospitals.pending = data.filter(h => h.status === 'pending');
        hospitals.approved = data.filter(h => h.status === 'approved');
        hospitals.rejected = data.filter(h => h.status === 'rejected');

        updateStats();
        displayHospitals();
    } catch (error) {
        console.error('Erreur chargement hôpitaux:', error);
        showError('Impossible de charger les hôpitaux');
    }
}

// ==============================================================================
// MISE À JOUR DES STATISTIQUES
// ==============================================================================
function updateStats() {
    document.getElementById('statPending').textContent = hospitals.pending.length;
    document.getElementById('statApproved').textContent = hospitals.approved.length;
    document.getElementById('statRejected').textContent = hospitals.rejected.length;
    document.getElementById('statTotal').textContent = 
        hospitals.pending.length + hospitals.approved.length + hospitals.rejected.length;

    document.getElementById('badgePending').textContent = hospitals.pending.length;
    document.getElementById('badgeApproved').textContent = hospitals.approved.length;
    document.getElementById('badgeRejected').textContent = hospitals.rejected.length;
}

// ==============================================================================
// AFFICHAGE DES HÔPITAUX
// ==============================================================================
function displayHospitals() {
    displayHospitalList('pending', hospitals.pending);
    displayHospitalList('approved', hospitals.approved);
    displayHospitalList('rejected', hospitals.rejected);
}

function displayHospitalList(status, list) {
    const container = document.getElementById(`${status}List`);
    
    if (list.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-inbox display-1 text-muted"></i>
                <p class="text-muted mt-3">Aucun hôpital ${status === 'pending' ? 'en attente' : status === 'approved' ? 'approuvé' : 'rejeté'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(hospital => createHospitalCard(hospital, status)).join('');
}

// ==============================================================================
// CRÉATION CARTE HÔPITAL
// ==============================================================================
function createHospitalCard(hospital, status) {
    const activeServices = hospital.hospital_services?.filter(hs => hs.is_active) || [];
    const totalDoctors = activeServices.reduce((sum, hs) => sum + (hs.total_doctors || 0), 0);
    const totalBeds = activeServices.reduce((sum, hs) => sum + (hs.total_beds || 0), 0);
    
    const createdDate = new Date(hospital.created_at).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const servicesHTML = activeServices.map(hs => `
        <span class="service-badge">
            <i class="bi bi-${hs.services?.icon || 'heart-pulse'}"></i>
            ${hs.services?.name || 'Service'}
        </span>
    `).join('');

    // Boutons selon le statut
    let actionsHTML = '';
    if (status === 'pending') {
        actionsHTML = `
            <button class="btn btn-success" onclick="updateStatus('${hospital.id}', 'approved')">
                <i class="bi bi-check-circle me-2"></i>Approuver
            </button>
            <button class="btn btn-danger" onclick="updateStatus('${hospital.id}', 'rejected')">
                <i class="bi bi-x-circle me-2"></i>Rejeter
            </button>
        `;
    } else if (status === 'approved') {
        actionsHTML = `
            <button class="btn btn-warning" onclick="updateStatus('${hospital.id}', 'pending')">
                <i class="bi bi-arrow-counterclockwise me-2"></i>Remettre en attente
            </button>
            <button class="btn btn-danger" onclick="updateStatus('${hospital.id}', 'rejected')">
                <i class="bi bi-x-circle me-2"></i>Rejeter
            </button>
        `;
    } else {
        actionsHTML = `
            <button class="btn btn-success" onclick="updateStatus('${hospital.id}', 'approved')">
                <i class="bi bi-check-circle me-2"></i>Approuver
            </button>
            <button class="btn btn-warning" onclick="updateStatus('${hospital.id}', 'pending')">
                <i class="bi bi-arrow-counterclockwise me-2"></i>En attente
            </button>
        `;
    }

    return `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-white border-bottom">
                    <h5 class="mb-1">${hospital.name}</h5>
                    <small class="text-muted"><i class="bi bi-calendar3 me-1"></i>${createdDate}</small>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <div class="d-flex align-items-center mb-2">
                            <i class="bi bi-envelope text-primary me-2"></i>
                            <small>${hospital.email}</small>
                        </div>
                        <div class="d-flex align-items-center mb-2">
                            <i class="bi bi-telephone text-primary me-2"></i>
                            <small>${hospital.phone || 'Non renseigné'}</small>
                        </div>
                        <div class="d-flex align-items-center">
                            <i class="bi bi-geo-alt text-primary me-2"></i>
                            <small>${hospital.address || 'Adresse non renseignée'}</small>
                        </div>
                    </div>

                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <div class="text-center p-2 bg-light rounded">
                                <div class="fw-bold text-primary">${totalDoctors}</div>
                                <small class="text-muted">Médecins</small>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="text-center p-2 bg-light rounded">
                                <div class="fw-bold text-success">${totalBeds}</div>
                                <small class="text-muted">Lits</small>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <strong class="d-block mb-2 small text-muted">Services actifs (${activeServices.length}):</strong>
                        <div class="d-flex flex-wrap gap-1">
                            ${servicesHTML || '<small class="text-muted">Aucun service</small>'}
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-white border-top">
                    <div class="d-flex gap-2">
                        ${actionsHTML}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ==============================================================================
// MISE À JOUR DU STATUT (Fonction globale)
// ==============================================================================
window.updateStatus = async function(hospitalId, newStatus) {
    const confirmMsg = {
        'approved': 'Voulez-vous approuver cet hôpital ? Il sera visible publiquement.',
        'rejected': 'Voulez-vous rejeter cet hôpital ? Il ne sera pas visible.',
        'pending': 'Remettre cet hôpital en attente de validation ?'
    };

    if (!confirm(confirmMsg[newStatus])) return;

    try {
        const { error } = await supabase
            .from('hospitals')
            .update({ status: newStatus })
            .eq('id', hospitalId);

        if (error) throw error;

        alert('✓ Statut mis à jour avec succès');
        await loadHospitals(); // Recharger
    } catch (error) {
        console.error('Erreur mise à jour statut:', error);
        alert('Erreur lors de la mise à jour du statut');
    }
};

// ==============================================================================
// EVENT LISTENERS
// ==============================================================================
function setupEventListeners() {
    document.getElementById('btnLogout')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
}

// ==============================================================================
// GESTION DES ERREURS
// ==============================================================================
function showError(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
    alert.style.zIndex = '9999';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alert);
    
    setTimeout(() => alert.remove(), 5000);
}
