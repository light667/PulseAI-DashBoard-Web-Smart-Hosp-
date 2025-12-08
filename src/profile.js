// ==============================================================================
// PULSEAI - PAGE PROFIL
// ==============================================================================

import { supabase } from './supabase.js';

let currentUser = null;
let currentHospital = null;

const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ==============================================================================
// INITIALISATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadHospitalData();
    setupEventListeners();
});

// ==============================================================================
// VÉRIFICATION AUTHENTIFICATION
// ==============================================================================
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = session.user;
    document.getElementById('userEmail').textContent = currentUser.email;
}

// ==============================================================================
// CHARGEMENT DES DONNÉES HÔPITAL
// ==============================================================================
window.loadHospitalData = async function() {
    try {
        const { data: hospital, error } = await supabase
            .from('hospitals')
            .select(`
                *,
                hospital_services(
                    is_active,
                    services(name)
                )
            `)
            .eq('owner_id', currentUser.id)
            .maybeSingle();

        if (error) throw error;
        
        if (!hospital) {
            showError('Aucun hôpital trouvé pour cet utilisateur');
            return;
        }

        currentHospital = hospital;
        populateForm(hospital);
        updateStats(hospital);
        displayOpeningHours(hospital.openings || []);
    } catch (error) {
        console.error('Erreur chargement hôpital:', error);
        showError('Impossible de charger les données de l\'hôpital');
    }
};

// ==============================================================================
// REMPLISSAGE DU FORMULAIRE
// ==============================================================================
function populateForm(hospital) {
    document.getElementById('hospitalName').value = hospital.name || '';
    document.getElementById('hospitalEmail').value = hospital.email || '';
    document.getElementById('hospitalPhone').value = hospital.phone || '';
    document.getElementById('hospitalAddress').value = hospital.address || '';
    document.getElementById('hospitalDescription').value = hospital.description || '';
    
    // Badge de statut
    const statusBadge = document.getElementById('statusBadge');
    const statusMap = {
        'pending': { class: 'bg-warning', text: 'En attente de validation' },
        'approved': { class: 'bg-success', text: 'Approuvé ✓' },
        'rejected': { class: 'bg-danger', text: 'Rejeté' }
    };
    
    const status = statusMap[hospital.status] || statusMap['pending'];
    statusBadge.className = `badge ${status.class} fs-6`;
    statusBadge.textContent = status.text;
}

// ==============================================================================
// MISE À JOUR DES STATISTIQUES
// ==============================================================================
function updateStats(hospital) {
    const activeServices = hospital.hospital_services?.filter(hs => hs.is_active).length || 0;
    const createdDate = hospital.created_at ? new Date(hospital.created_at).toLocaleDateString('fr-FR') : '-';
    
    document.getElementById('statRating').textContent = hospital.average_rating?.toFixed(1) || '0.0';
    document.getElementById('statReviews').textContent = hospital.total_ratings || 0;
    document.getElementById('statServices').textContent = activeServices;
    document.getElementById('statCreated').textContent = createdDate;
}

// ==============================================================================
// AFFICHAGE DES HORAIRES
// ==============================================================================
function displayOpeningHours(openings) {
    const container = document.getElementById('openingHoursList');
    
    if (!openings || openings.length === 0) {
        container.innerHTML = '<p class="text-muted">Aucun horaire défini</p>';
        return;
    }
    
    container.innerHTML = openings.map(opening => `
        <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${opening.day}</strong>
                    <div class="text-muted small">
                        ${opening.open} - ${opening.close}
                    </div>
                </div>
                <i class="bi bi-clock text-primary"></i>
            </div>
        </div>
    `).join('');
}

// ==============================================================================
// ÉDITEUR D'HORAIRES DANS MODAL
// ==============================================================================
function initHoursEditor() {
    const editor = document.getElementById('hoursEditor');
    const currentOpenings = currentHospital?.openings || [];
    
    editor.innerHTML = DAYS_FR.map((day, index) => {
        const existing = currentOpenings.find(o => o.day === day);
        return `
            <div class="row mb-3 align-items-center">
                <div class="col-md-3">
                    <strong>${day}</strong>
                </div>
                <div class="col-md-4">
                    <input type="time" class="form-control" id="open_${index}" value="${existing?.open || '08:00'}">
                </div>
                <div class="col-md-4">
                    <input type="time" class="form-control" id="close_${index}" value="${existing?.close || '18:00'}">
                </div>
                <div class="col-md-1">
                    <input type="checkbox" class="form-check-input" id="active_${index}" ${existing ? 'checked' : ''}>
                </div>
            </div>
        `;
    }).join('');
}

// ==============================================================================
// SAUVEGARDE DES HORAIRES
// ==============================================================================
window.saveHours = async function() {
    const openings = [];
    
    DAYS_FR.forEach((day, index) => {
        const isActive = document.getElementById(`active_${index}`).checked;
        if (isActive) {
            openings.push({
                day: day,
                open: document.getElementById(`open_${index}`).value,
                close: document.getElementById(`close_${index}`).value
            });
        }
    });

    try {
        const { error } = await supabase
            .from('hospitals')
            .update({ openings: openings })
            .eq('id', currentHospital.id);

        if (error) throw error;

        alert('✓ Horaires mis à jour avec succès');
        bootstrap.Modal.getInstance(document.getElementById('editHoursModal')).hide();
        await loadHospitalData();
    } catch (error) {
        console.error('Erreur sauvegarde horaires:', error);
        alert('Erreur lors de la sauvegarde des horaires');
    }
};

// ==============================================================================
// SAUVEGARDE DU FORMULAIRE HÔPITAL
// ==============================================================================
function setupEventListeners() {
    document.getElementById('hospitalForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('hospitalName').value,
            email: document.getElementById('hospitalEmail').value,
            phone: document.getElementById('hospitalPhone').value,
            address: document.getElementById('hospitalAddress').value,
            description: document.getElementById('hospitalDescription').value
        };

        try {
            const { error } = await supabase
                .from('hospitals')
                .update(formData)
                .eq('id', currentHospital.id);

            if (error) throw error;

            alert('✓ Informations mises à jour avec succès');
            await loadHospitalData();
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            alert('Erreur lors de la sauvegarde');
        }
    });

    // Bouton déconnexion
    document.getElementById('btnLogout')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    // Initialiser l'éditeur d'horaires au clic du bouton modal
    const editHoursBtn = document.querySelector('[data-bs-target="#editHoursModal"]');
    editHoursBtn?.addEventListener('click', initHoursEditor);
}

// ==============================================================================
// GESTION DES ERREURS
// ==============================================================================
function showError(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container').prepend(alert);
    
    setTimeout(() => alert.remove(), 5000);
}
