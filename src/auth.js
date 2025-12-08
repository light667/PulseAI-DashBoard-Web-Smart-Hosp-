// auth.js — Gestion complète de l'authentification et inscription
import { supabase } from './supabase.js'

// ==============================================================================
// VARIABLES GLOBALES
// ==============================================================================
let userLocation = null // { lat, lng }
let openings = [] // [{ day: 'Lundi', range: '08:00-12:00' }, ...]
let selectedServices = [] // [1, 3, 5, ...] (IDs des services cochés)

// ==============================================================================
// INITIALISATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Charger les services disponibles
    await loadServices()
    
    // Configurer les listeners
    setupEventListeners()
})

// ==============================================================================
// CHARGER LES SERVICES DEPUIS SUPABASE
// ==============================================================================
async function loadServices() {
    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .order('name')
    
    if (error) {
        console.error('Erreur chargement services:', error)
        return
    }
    
    const grid = document.getElementById('servicesGrid')
    grid.innerHTML = '' // Vider le spinner
    
    services.forEach(service => {
        const col = document.createElement('div')
        col.className = 'col-6'
        col.innerHTML = `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${service.id}" id="svc${service.id}">
                <label class="form-check-label small" for="svc${service.id}">
                    <i class="bi bi-${service.icon || 'circle-fill'}"></i> ${service.name}
                </label>
            </div>
        `
        grid.appendChild(col)
    })
}

// ==============================================================================
// EVENT LISTENERS
// ==============================================================================
function setupEventListeners() {
    // GÉOLOCALISATION
    document.getElementById('btnGetLocation')?.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert('Géolocalisation non disponible sur ce navigateur')
            return
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                }
                document.getElementById('locationStatus').value = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`
            },
            (error) => {
                alert('Impossible d\'obtenir votre position: ' + error.message)
            }
        )
    })
    
    // AJOUT D'HORAIRE
    document.getElementById('btnAddOpening')?.addEventListener('click', () => {
        const day = document.getElementById('daySelect').value
        const range = document.getElementById('timeRange').value
        
        openings.push({ day, range })
        updateOpeningsList()
    })
    
    // LOGIN
    document.getElementById('btnLogin')?.addEventListener('click', handleLogin)
    
    // SIGNUP
    document.getElementById('btnSignup')?.addEventListener('click', handleSignup)
    
    // LOGOUT
    document.getElementById('btnLogout')?.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.reload()
    })
}

// ==============================================================================
// AFFICHER LA LISTE DES HORAIRES
// ==============================================================================
function updateOpeningsList() {
    const list = document.getElementById('openingsList')
    list.innerHTML = ''
    
    openings.forEach((opening, index) => {
        const badge = document.createElement('span')
        badge.className = 'badge bg-primary'
        badge.innerHTML = `${opening.day} ${opening.range} <i class="bi bi-x-circle ms-1"></i>`
        badge.style.cursor = 'pointer'
        badge.onclick = () => {
            openings.splice(index, 1)
            updateOpeningsList()
        }
        list.appendChild(badge)
    })
}

// ==============================================================================
// LOGIN
// ==============================================================================
async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim()
    const password = document.getElementById('loginPassword').value
    
    if (!email || !password) {
        alert('Veuillez remplir tous les champs')
        return
    }
    
    const spinner = document.getElementById('loginSpinner')
    spinner.classList.remove('d-none')
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    spinner.classList.add('d-none')
    
    if (error) {
        alert('Erreur de connexion: ' + error.message)
        return
    }
    
    window.location.href = 'dashboard.html'
}

// ==============================================================================
// SIGNUP COMPLET
// ==============================================================================
async function handleSignup() {
    // VALIDATION
    const email = document.getElementById('signupEmail').value.trim()
    const password = document.getElementById('signupPassword').value
    const hospitalName = document.getElementById('signupHospitalName').value.trim()
    const phone = document.getElementById('signupPhone').value.trim()
    const address = document.getElementById('signupAddress').value.trim()
    
    if (!email || !password || !hospitalName || !phone || !address) {
        alert('Veuillez remplir tous les champs obligatoires (*)')
        return
    }
    
    if (!userLocation) {
        alert('Veuillez autoriser la géolocalisation pour continuer')
        return
    }
    
    // Récupérer les services cochés
    selectedServices = Array.from(document.querySelectorAll('#servicesGrid input:checked'))
        .map(input => parseInt(input.value))
    
    if (selectedServices.length === 0) {
        alert('Veuillez sélectionner au moins un service')
        return
    }
    
    if (!document.getElementById('termsCheck').checked) {
        alert('Veuillez accepter les conditions')
        return
    }
    
    const spinner = document.getElementById('signupSpinner')
    const btn = document.getElementById('btnSignup')
    spinner.classList.remove('d-none')
    btn.disabled = true
    
    try {
        // 1. CRÉER LE COMPTE AUTH
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: hospitalName,
                    role: 'hospital_admin'
                },
                emailRedirectTo: window.location.origin + '/public/dashboard.html'
            }
        })
        
        if (authError) throw authError
        
        if (!authData.user) {
            throw new Error('Échec de création du compte utilisateur')
        }
        
        const userId = authData.user.id
        console.log('Utilisateur créé avec ID:', userId)
        
        // Attendre que la session soit établie (important pour RLS)
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // 2. CRÉER L'ENREGISTREMENT HÔPITAL
        const { data: hospitalData, error: hospitalError } = await supabase
            .from('hospitals')
            .insert([{
                owner_id: userId,
                name: hospitalName,
                email: email,
                phone: phone,
                address: address,
                location: `POINT(${userLocation.lng} ${userLocation.lat})`,
                openings: openings,
                status: 'pending'
            }])
            .select()
        
        if (hospitalError) {
            console.error('Erreur création hôpital:', hospitalError)
            throw new Error('Impossible de créer le profil hôpital: ' + hospitalError.message)
        }
        
        const hospitalId = hospitalData[0].id
        
        // 3. INSÉRER LES SERVICES SÉLECTIONNÉS
        const serviceInserts = selectedServices.map(serviceId => ({
            hospital_id: hospitalId,
            service_id: serviceId,
            is_active: true,
            doctors_total: 0,
            doctors_available: 0,
            beds_total: 0,
            beds_available: 0,
            queue_length: 0
        }))
        
        const { error: servicesError } = await supabase
            .from('hospital_services')
            .insert(serviceInserts)
        
        if (servicesError) throw servicesError
        
        // SUCCÈS !
        alert('✅ Inscription réussie ! Votre compte est en attente de validation par notre équipe.')
        
        console.log('Inscription terminée. Session:', authData.session)
        
        // Redirection automatique si session active
        if (authData.session) {
            console.log('Session active, redirection vers dashboard...')
            setTimeout(() => {
                window.location.href = 'dashboard.html'
            }, 1500)
        } else {
            alert('📧 Un email de confirmation vous a été envoyé. Vérifiez votre boîte de réception puis connectez-vous.')
            // Basculer vers l'onglet connexion
            setTimeout(() => {
                document.getElementById('login-tab').click()
            }, 2000)
        }
        
    } catch (error) {
        console.error('Erreur inscription:', error)
        
        let errorMessage = error.message
        
        if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_CLOSED')) {
            errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet et réessayez dans quelques secondes.'
        } else if (error.message.includes('Email rate limit exceeded')) {
            errorMessage = 'Trop de tentatives. Attendez 60 secondes et réessayez.'
        } else if (error.message.includes('User already registered')) {
            errorMessage = 'Cet email est déjà enregistré. Utilisez la connexion.'
        }
        
        alert('❌ Erreur lors de l\'inscription: ' + errorMessage)
    } finally {
        spinner.classList.add('d-none')
        btn.disabled = false
    }
}

// ==============================================================================
// ÉCOUTE DES CHANGEMENTS D'AUTH (Auto-redirect)
// ==============================================================================
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event)
    
    // Auto-redirect uniquement après un SIGNED_IN actif (pas INITIAL_SESSION)
    // Cela évite les redirections lors du chargement de la page
    if (event === 'SIGNED_IN' && session && window.location.pathname.includes('index.html')) {
        console.log('Redirection vers dashboard après connexion réussie')
        setTimeout(() => {
            window.location.href = 'dashboard.html'
        }, 500)
    }
})