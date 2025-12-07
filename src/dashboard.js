// dashboard.js — Interface de gestion pour les hôpitaux
import { supabase } from './supabase.js'

// État
let currentHospital = null
let currentUser = null

// Éléments DOM
const dashboardSection = document.getElementById('dashboardSection')
const servicesManagement = document.getElementById('servicesManagement')
const statsDisplay = document.getElementById('statsDisplay')

// =============================================
// INITIALISATION
// =============================================
async function init() {
    // Vérifier la session
    const { data: { session } } = await supabase.auth.getSession()
    currentUser = session?.user
    
    if (!currentUser) {
        window.location.href = 'index.html'
        return
    }
    
    // Charger l'hôpital de l'utilisateur
    await loadHospital()
    
    // Charger les services
    await loadServices()
    
    // Actualiser les stats
    setInterval(updateStats, 30000) // Toutes les 30 secondes
}

// =============================================
// CHARGER L'HÔPITAL
// =============================================
async function loadHospital() {
    const { data, error } = await supabase
        .from('hospitals')
        .select(`
            *,
            hospital_services (
                *,
                services (*)
            )
        `)
        .eq('owner_id', currentUser.id)
        .single()
    
    if (error) {
        console.error('Erreur:', error)
        return
    }
    
    currentHospital = data
    displayHospitalInfo()
}

// =============================================
// AFFICHER INFOS HÔPITAL
// =============================================
function displayHospitalInfo() {
    const statusBadge = {
        'pending': '<span class="badge badge-warning">⏳ En attente de validation</span>',
        'approved': '<span class="badge badge-success">✅ Approuvé</span>',
        'rejected': '<span class="badge badge-danger">❌ Rejeté</span>'
    }
    
    document.getElementById('hospitalName').textContent = currentHospital.name
    document.getElementById('hospitalStatus').innerHTML = statusBadge[currentHospital.status]
    
    if (currentHospital.status === 'rejected' && currentHospital.rejection_reason) {
        document.getElementById('rejectionReason').innerHTML = `
            <div class="alert alert-danger">
                <strong>Raison du rejet:</strong> ${currentHospital.rejection_reason}
            </div>
        `
    }
    
    // Afficher la note
    displayRating()
}

// =============================================
// AFFICHER LA NOTE
// =============================================
function displayRating() {
    const stars = '⭐'.repeat(Math.round(currentHospital.average_rating))
    document.getElementById('hospitalRating').innerHTML = `
        <div class="rating">
            ${stars} ${currentHospital.average_rating}/5
            <span class="muted">(${currentHospital.total_ratings} avis)</span>
        </div>
    `
}

// =============================================
// CHARGER LES SERVICES
// =============================================
async function loadServices() {
    const servicesContainer = document.getElementById('servicesGrid')
    servicesContainer.innerHTML = ''
    
    currentHospital.hospital_services.forEach(hs => {
        const card = createServiceCard(hs)
        servicesContainer.appendChild(card)
    })
}

// =============================================
// CRÉER UNE CARTE DE SERVICE
// =============================================
function createServiceCard(hospitalService) {
    const card = document.createElement('div')
    card.className = 'service-card'
    
    const service = hospitalService.services
    const availability = hospitalService.is_available ? 'Disponible' : 'Indisponible'
    const availClass = hospitalService.is_available ? 'text-success' : 'text-danger'
    
    card.innerHTML = `
        <div class="service-header">
            <h3>${service.name}</h3>
            <span class="${availClass}">${availability}</span>
        </div>
        
        <div class="service-stats">
            <div class="stat-item">
                <label>👨‍⚕️ Médecins</label>
                <input type="number" 
                    class="stat-input" 
                    data-field="available_doctors"
                    data-service-id="${hospitalService.id}"
                    value="${hospitalService.available_doctors || 0}"
                    min="0"
                    max="${hospitalService.total_doctors || 0}">
                <span class="muted">/ ${hospitalService.total_doctors || 0} total</span>
            </div>
            
            <div class="stat-item">
                <label>🛏️ Lits</label>
                <input type="number" 
                    class="stat-input"
                    data-field="available_beds"
                    data-service-id="${hospitalService.id}"
                    value="${hospitalService.available_beds || 0}"
                    min="0"
                    max="${hospitalService.total_beds || 0}">
                <span class="muted">/ ${hospitalService.total_beds || 0} total</span>
            </div>
            
            <div class="stat-item">
                <label>⏱️ File d'attente</label>
                <input type="number" 
                    class="stat-input"
                    data-field="queue_length"
                    data-service-id="${hospitalService.id}"
                    value="${hospitalService.queue_length || 0}"
                    min="0">
                <span class="muted">personnes</span>
            </div>
        </div>
        
        <div class="service-actions">
            <button onclick="updateServiceConfig('${hospitalService.id}', 'total')">
                ⚙️ Config totaux
            </button>
            <button onclick="toggleServiceAvailability('${hospitalService.id}', ${!hospitalService.is_available})">
                ${hospitalService.is_available ? '🔴 Désactiver' : '🟢 Activer'}
            </button>
        </div>
    `
    
    // Ajouter les event listeners pour les inputs
    card.querySelectorAll('.stat-input').forEach(input => {
        input.addEventListener('change', (e) => {
            updateServiceStat(
                e.target.dataset.serviceId,
                e.target.dataset.field,
                parseInt(e.target.value)
            )
        })
    })
    
    return card
}

// =============================================
// METTRE À JOUR UNE STAT DE SERVICE
// =============================================
async function updateServiceStat(serviceId, field, value) {
    const { error } = await supabase
        .from('hospital_services')
        .update({ [field]: value })
        .eq('id', serviceId)
    
    if (error) {
        alert('Erreur: ' + error.message)
        return
    }
    
    showNotification('✅ Mis à jour', 'success')
}

// =============================================
// CONFIGURER LES TOTAUX
// =============================================
window.updateServiceConfig = async function(serviceId, type) {
    const totalDoctors = prompt('Nombre total de médecins:')
    const totalBeds = prompt('Nombre total de lits:')
    
    if (totalDoctors === null || totalBeds === null) return
    
    const { error } = await supabase
        .from('hospital_services')
        .update({
            total_doctors: parseInt(totalDoctors) || 0,
            total_beds: parseInt(totalBeds) || 0
        })
        .eq('id', serviceId)
    
    if (error) {
        alert('Erreur: ' + error.message)
        return
    }
    
    await loadHospital()
    await loadServices()
    showNotification('✅ Configuration mise à jour', 'success')
}

// =============================================
// ACTIVER/DÉSACTIVER UN SERVICE
// =============================================
window.toggleServiceAvailability = async function(serviceId, newStatus) {
    const { error } = await supabase
        .from('hospital_services')
        .update({ is_available: newStatus })
        .eq('id', serviceId)
    
    if (error) {
        alert('Erreur: ' + error.message)
        return
    }
    
    await loadHospital()
    await loadServices()
    showNotification(
        newStatus ? '✅ Service activé' : '🔴 Service désactivé',
        newStatus ? 'success' : 'warning'
    )
}

// =============================================
// METTRE À JOUR LES STATISTIQUES GLOBALES
// =============================================
async function updateStats() {
    if (!currentHospital) return
    
    // Calculer les totaux
    const services = currentHospital.hospital_services
    const totalDoctors = services.reduce((sum, s) => sum + (s.available_doctors || 0), 0)
    const totalBeds = services.reduce((sum, s) => sum + (s.available_beds || 0), 0)
    const totalQueue = services.reduce((sum, s) => sum + (s.queue_length || 0), 0)
    const activeServices = services.filter(s => s.is_available).length
    
    document.getElementById('statsDisplay').innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${activeServices}</div>
                <div class="stat-label">Services actifs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalDoctors}</div>
                <div class="stat-label">Médecins disponibles</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalBeds}</div>
                <div class="stat-label">Lits disponibles</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalQueue}</div>
                <div class="stat-label">Personnes en attente</div>
            </div>
        </div>
    `
}

// =============================================
// NOTIFICATIONS
// =============================================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div')
    notification.className = `notification notification-${type}`
    notification.textContent = message
    document.body.appendChild(notification)
    
    setTimeout(() => {
        notification.classList.add('fade-out')
        setTimeout(() => notification.remove(), 300)
    }, 3000)
}

// =============================================
// DÉMARRAGE
// =============================================
init()

export { loadHospital, loadServices, updateStats }
