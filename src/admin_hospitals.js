// admin.js — Validation des inscriptions d'hôpitaux
import { supabase } from './supabase.js'

let currentUser = null

// =============================================
// INITIALISATION
// =============================================
async function init() {
    // Vérifier la session et le rôle admin
    const { data: { session } } = await supabase.auth.getSession()
    currentUser = session?.user
    
    if (!currentUser) {
        alert('Connectez-vous d\'abord')
        window.location.href = 'index.html'
        return
    }
    
    // Vérifier le rôle admin
    const isAdmin = await checkAdminRole()
    if (!isAdmin) {
        alert('Accès réservé aux administrateurs')
        window.location.href = 'index.html'
        return
    }
    
    // Charger les hôpitaux
    await loadHospitals()
}

// =============================================
// VÉRIFIER LE RÔLE ADMIN
// =============================================
async function checkAdminRole() {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', currentUser.id)
        .single()
    
    return data?.role === 'admin'
}

// =============================================
// CHARGER LES HÔPITAUX
// =============================================
async function loadHospitals() {
    const { data: hospitals, error } = await supabase
        .from('hospitals')
        .select(`
            *,
            hospital_services (
                *,
                services (*)
            )
        `)
        .order('created_at', { ascending: false })
    
    if (error) {
        console.error('Erreur:', error)
        return
    }
    
    // Grouper par statut
    const pending = hospitals.filter(h => h.status === 'pending')
    const approved = hospitals.filter(h => h.status === 'approved')
    const rejected = hospitals.filter(h => h.status === 'rejected')
    
    displayHospitals('pendingList', pending)
    displayHospitals('approvedList', approved)
    displayHospitals('rejectedList', rejected)
    
    updateCounts(pending.length, approved.length, rejected.length)
}

// =============================================
// AFFICHER LES HÔPITAUX
// =============================================
function displayHospitals(containerId, hospitals) {
    const container = document.getElementById(containerId)
    if (!container) return
    
    container.innerHTML = ''
    
    if (hospitals.length === 0) {
        container.innerHTML = '<p class="muted">Aucun hôpital</p>'
        return
    }
    
    hospitals.forEach(hospital => {
        const card = createHospitalCard(hospital)
        container.appendChild(card)
    })
}

// =============================================
// CRÉER UNE CARTE D'HÔPITAL
// =============================================
function createHospitalCard(hospital) {
    const card = document.createElement('div')
    card.className = 'hospital-card'
    
    const services = hospital.hospital_services
        .map(hs => hs.services.name)
        .join(', ')
    
    const location = hospital.location 
        ? `📍 Position enregistrée` 
        : '📍 Position non enregistrée'
    
    const openings = hospital.openings?.length 
        ? hospital.openings.map(o => `${o.day}: ${o.range}`).join('<br>')
        : 'Non renseigné'
    
    card.innerHTML = `
        <div class="hospital-header">
            <div>
                <h3>${hospital.name}</h3>
                <p class="muted">${hospital.email} • ${hospital.phone}</p>
            </div>
            <span class="hospital-date">${new Date(hospital.created_at).toLocaleDateString('fr-FR')}</span>
        </div>
        
        <div class="hospital-info">
            <p><strong>Adresse:</strong> ${hospital.address || 'Non renseignée'}</p>
            <p><strong>Description:</strong> ${hospital.description || 'Aucune'}</p>
            <p><strong>Géolocalisation:</strong> ${location}</p>
            <p><strong>Horaires:</strong><br>${openings}</p>
            <p><strong>Services:</strong> ${services || 'Aucun'}</p>
        </div>
        
        ${hospital.status === 'rejected' && hospital.rejection_reason ? `
            <div class="rejection-reason">
                <strong>Raison du rejet:</strong> ${hospital.rejection_reason}
            </div>
        ` : ''}
        
        <div class="hospital-actions">
            ${hospital.status === 'pending' ? `
                <button class="btn-approve" onclick="approveHospital('${hospital.id}')">
                    ✅ Approuver
                </button>
                <button class="btn-reject" onclick="rejectHospital('${hospital.id}')">
                    ❌ Rejeter
                </button>
            ` : ''}
            
            ${hospital.status === 'approved' ? `
                <button class="btn-reject" onclick="rejectHospital('${hospital.id}')">
                    🔴 Révoquer
                </button>
            ` : ''}
            
            ${hospital.status === 'rejected' ? `
                <button class="btn-approve" onclick="approveHospital('${hospital.id}')">
                    ✅ Réapprouver
                </button>
            ` : ''}
            
            <button class="btn-delete" onclick="deleteHospital('${hospital.id}')">
                🗑️ Supprimer
            </button>
        </div>
    `
    
    return card
}

// =============================================
// APPROUVER UN HÔPITAL
// =============================================
window.approveHospital = async function(hospitalId) {
    const { error } = await supabase
        .from('hospitals')
        .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: currentUser.id,
            rejection_reason: null
        })
        .eq('id', hospitalId)
    
    if (error) {
        alert('Erreur: ' + error.message)
        return
    }
    
    showNotification('✅ Hôpital approuvé', 'success')
    await loadHospitals()
}

// =============================================
// REJETER UN HÔPITAL
// =============================================
window.rejectHospital = async function(hospitalId) {
    const reason = prompt('Raison du rejet:')
    if (!reason) return
    
    const { error } = await supabase
        .from('hospitals')
        .update({
            status: 'rejected',
            rejection_reason: reason,
            approved_at: null,
            approved_by: null
        })
        .eq('id', hospitalId)
    
    if (error) {
        alert('Erreur: ' + error.message)
        return
    }
    
    showNotification('❌ Hôpital rejeté', 'warning')
    await loadHospitals()
}

// =============================================
// SUPPRIMER UN HÔPITAL
// =============================================
window.deleteHospital = async function(hospitalId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet hôpital ?')) return
    
    const { error } = await supabase
        .from('hospitals')
        .delete()
        .eq('id', hospitalId)
    
    if (error) {
        alert('Erreur: ' + error.message)
        return
    }
    
    showNotification('🗑️ Hôpital supprimé', 'success')
    await loadHospitals()
}

// =============================================
// METTRE À JOUR LES COMPTEURS
// =============================================
function updateCounts(pending, approved, rejected) {
    document.getElementById('pendingCount').textContent = pending
    document.getElementById('approvedCount').textContent = approved
    document.getElementById('rejectedCount').textContent = rejected
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
