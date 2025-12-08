// dashboard.js — Interface complète de gestion hospitalière
import { supabase } from './supabase.js'

// ==============================================================================
// ÉTAT GLOBAL
// ==============================================================================
let currentUser = null
let currentHospital = null
let hospitalServices = []

// ==============================================================================
// INITIALISATION
// ==============================================================================
async function init() {
    // Vérifier la session
    const { data: { session } } = await supabase.auth.getSession()
    currentUser = session?.user
    
    if (!currentUser) {
        window.location.href = 'index.html'
        return
    }
    
    // Charger les données de l'hôpital
    await loadHospital()
    
    // Charger les services
    await loadHospitalServices()
    
    // Mettre à jour les statistiques globales
    updateGlobalStats()
    
    // Configurer les listeners
    setupEventListeners()
}

// ==============================================================================
// CHARGER L'HÔPITAL
// ==============================================================================
async function loadHospital() {
    const { data, error } = await supabase
        .from('hospitals')
        .select('*')
        .eq('owner_id', currentUser.id)
        .maybeSingle()
    
    if (error) {
        console.error('Erreur chargement hôpital:', error)
        showAlert('Erreur de chargement des données: ' + error.message, 'danger')
        return
    }
    
    if (!data) {
        console.warn('Aucun hôpital trouvé pour cet utilisateur')
        showAlert('Aucun hôpital associé à ce compte. Veuillez vous réinscrire.', 'warning')
        // Créer un hôpital vide pour éviter les crashes
        currentHospital = { id: null, name: 'Non configuré', status: 'pending' }
        return
    }
    
    currentHospital = data
    
    // Afficher les infos dans la navbar
    document.getElementById('hospitalNameTitle').textContent = data.name
    document.getElementById('userEmailDisplay').textContent = currentUser.email
    
    // Afficher le statut de validation
    displayStatus(data.status, data.rejection_reason)
    
    // Remplir le formulaire de profil
    document.getElementById('editName').value = data.name || ''
    document.getElementById('editPhone').value = data.phone || ''
    document.getElementById('editAddress').value = data.address || ''
    
    // Afficher la note moyenne
    document.getElementById('averageRating').innerHTML = `
        <i class="bi bi-star-fill"></i> ${data.average_rating || 0}
    `
    document.getElementById('totalRatings').textContent = data.total_ratings || 0
}

// ==============================================================================
// AFFICHER LE STATUT DE VALIDATION
// ==============================================================================
function displayStatus(status, rejectionReason) {
    const badge = document.getElementById('hospitalStatusBadge')
    const message = document.getElementById('statusMessage')
    
    switch (status) {
        case 'pending':
            badge.className = 'badge bg-warning text-dark fs-6 mb-2'
            badge.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>EN ATTENTE DE VALIDATION'
            message.textContent = 'Votre dossier est en cours d\'examen par notre équipe.'
            break
        case 'approved':
            badge.className = 'badge bg-success fs-6 mb-2'
            badge.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>ÉTABLISSEMENT VÉRIFIÉ'
            message.textContent = 'Votre établissement est validé et visible dans l\'application Flutter.'
            break
        case 'rejected':
            badge.className = 'badge bg-danger fs-6 mb-2'
            badge.innerHTML = '<i class="bi bi-x-circle-fill me-2"></i>DOSSIER REJETÉ'
            message.textContent = rejectionReason || 'Votre dossier a été rejeté. Contactez le support.'
            break
    }
}

// ==============================================================================
// CHARGER LES SERVICES DE L'HÔPITAL
// ==============================================================================
async function loadHospitalServices() {
    if (!currentHospital || !currentHospital.id) {
        console.warn('Pas d\'hôpital chargé, impossible de charger les services')
        hospitalServices = []
        displayServices()
        return
    }
    
    const { data, error } = await supabase
        .from('hospital_services')
        .select(`
            *,
            services (id, name, icon)
        `)
        .eq('hospital_id', currentHospital.id)
    
    if (error) {
        console.error('Erreur chargement services:', error)
        return
    }
    
    hospitalServices = data
    displayServices()
}

// ==============================================================================
// AFFICHER LES SERVICES SOUS FORME DE CARTES
// ==============================================================================
function displayServices() {
    const container = document.getElementById('servicesManagement')
    
    if (hospitalServices.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-4">
                <i class="bi bi-info-circle fs-1"></i>
                <p class="mt-2">Aucun service configuré lors de votre inscription.</p>
                <p class="small">Contactez le support pour ajouter des services.</p>
            </div>
        `
        return
    }
    
    container.innerHTML = ''
    
    hospitalServices.forEach(hs => {
        const card = document.createElement('div')
        card.className = 'col-md-6'
        card.innerHTML = `
            <div class="card service-card ${hs.is_active ? '' : 'inactive'} mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <h6 class="mb-0">
                            <i class="bi bi-${hs.services.icon || 'circle-fill'} me-2"></i>
                            ${hs.services.name}
                        </h6>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" ${hs.is_active ? 'checked' : ''} 
                                   onchange="window.toggleService('${hs.id}', this.checked)">
                            <label class="form-check-label small text-muted">Actif</label>
                        </div>
                    </div>
                    
                    <!-- Stats Temps Réel -->
                    <div class="row g-2">
                        <!-- Médecins -->
                        <div class="col-6">
                            <label class="small text-muted">Médecins Total</label>
                            <input type="number" class="form-control form-control-sm" min="0" 
                                   value="${hs.doctors_total}" 
                                   onchange="window.updateStat('${hs.id}', 'doctors_total', this.value)">
                        </div>
                        <div class="col-6">
                            <label class="small text-muted">Disponibles</label>
                            <input type="number" class="form-control form-control-sm" min="0" 
                                   value="${hs.doctors_available}" 
                                   onchange="window.updateStat('${hs.id}', 'doctors_available', this.value)">
                        </div>
                        
                        <!-- Lits -->
                        <div class="col-6">
                            <label class="small text-muted">Lits Total</label>
                            <input type="number" class="form-control form-control-sm" min="0" 
                                   value="${hs.beds_total}" 
                                   onchange="window.updateStat('${hs.id}', 'beds_total', this.value)">
                        </div>
                        <div class="col-6">
                            <label class="small text-muted">Disponibles</label>
                            <input type="number" class="form-control form-control-sm" min="0" 
                                   value="${hs.beds_available}" 
                                   onchange="window.updateStat('${hs.id}', 'beds_available', this.value)">
                        </div>
                        
                        <!-- File d'attente -->
                        <div class="col-12">
                            <label class="small text-muted">File d'attente (personnes)</label>
                            <input type="number" class="form-control form-control-sm" min="0" 
                                   value="${hs.queue_length}" 
                                   onchange="window.updateStat('${hs.id}', 'queue_length', this.value)">
                        </div>
                    </div>
                </div>
            </div>
        `
        container.appendChild(card)
    })
}

// ==============================================================================
// METTRE À JOUR UNE STATISTIQUE
// ==============================================================================
window.updateStat = async function(serviceId, field, value) {
    const { error } = await supabase
        .from('hospital_services')
        .update({ [field]: parseInt(value) || 0 })
        .eq('id', serviceId)
    
    if (error) {
        console.error('Erreur mise à jour:', error)
        showAlert('Erreur lors de la mise à jour', 'danger')
        return
    }
    
    // Recharger et mettre à jour les stats globales
    await loadHospitalServices()
    updateGlobalStats()
}

// ==============================================================================
// ACTIVER/DÉSACTIVER UN SERVICE
// ==============================================================================
window.toggleService = async function(serviceId, isActive) {
    const { error } = await supabase
        .from('hospital_services')
        .update({ is_active: isActive })
        .eq('id', serviceId)
    
    if (error) {
        console.error('Erreur toggle service:', error)
        showAlert('Erreur lors de la modification', 'danger')
        return
    }
    
    showAlert(isActive ? 'Service activé' : 'Service désactivé', 'success')
    await loadHospitalServices()
    updateGlobalStats()
}

// ==============================================================================
// METTRE À JOUR LES STATS GLOBALES
// ==============================================================================
function updateGlobalStats() {
    let totalDoctors = 0
    let availableDoctors = 0
    let availableBeds = 0
    let totalQueue = 0
    
    hospitalServices.forEach(hs => {
        totalDoctors += hs.doctors_total || 0
        availableDoctors += hs.doctors_available || 0
        availableBeds += hs.beds_available || 0
        totalQueue += hs.queue_length || 0
    })
    
    document.getElementById('totalDoctors').textContent = totalDoctors
    document.getElementById('availableDoctors').textContent = availableDoctors
    document.getElementById('availableBeds').textContent = availableBeds
    document.getElementById('totalQueue').textContent = totalQueue
}

// ==============================================================================
// EVENT LISTENERS
// ==============================================================================
function setupEventListeners() {
    // SAUVEGARDER LE PROFIL
    document.getElementById('btnSaveProfile')?.addEventListener('click', async () => {
        const name = document.getElementById('editName').value.trim()
        const phone = document.getElementById('editPhone').value.trim()
        const address = document.getElementById('editAddress').value.trim()
        
        if (!name || !phone || !address) {
            showAlert('Veuillez remplir tous les champs', 'warning')
            return
        }
        
        const { error } = await supabase
            .from('hospitals')
            .update({ name, phone, address })
            .eq('id', currentHospital.id)
        
        if (error) {
            console.error('Erreur sauvegarde:', error)
            showAlert('Erreur lors de la sauvegarde', 'danger')
            return
        }
        
        showAlert('✅ Profil mis à jour avec succès', 'success')
        await loadHospital()
    })
    
    // DÉCONNEXION
    const logoutBtn = document.getElementById('btnLogout')
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault()
            console.log('Déconnexion...')
            await supabase.auth.signOut()
            window.location.href = 'index.html'
        })
    } else {
        console.warn('Bouton btnLogout non trouvé dans le DOM')
    }
}

// ==============================================================================
// AFFICHER UNE ALERTE
// ==============================================================================
function showAlert(message, type = 'info') {
    const alertZone = document.getElementById('alertZone')
    const alert = document.createElement('div')
    alert.className = `alert alert-${type} alert-dismissible fade show`
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `
    alertZone.appendChild(alert)
    
    setTimeout(() => alert.remove(), 5000)
}

// ==============================================================================
// DÉMARRAGE
// ==============================================================================
init()
