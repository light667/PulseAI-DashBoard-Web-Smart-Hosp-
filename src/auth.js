// auth.js — Gestion complète de l'authentification et inscription
import { supabase } from './supabase.js'
import { api } from './utils/api.js'
import { notify } from './utils/notifications.js'
import { validators, validateForm, displayFormErrors, clearFormErrors } from './utils/validation.js'
import { store } from './utils/store.js'
import { cache } from './utils/cache.js'

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
    try {
        // Utiliser le cache pour éviter les requêtes répétées
        const services = await cache.getOrFetch('services', async () => {
            const { data, error } = await api.getAllServices()
            if (error) throw error
            return data
        }, 30 * 60 * 1000) // Cache 30 minutes
        
        if (!services || services.length === 0) {
            notify.warning('Aucun service médical disponible')
            return
        }
        
        store.setServices(services)
        
        const grid = document.getElementById('servicesGrid')
        if (!grid) return
        
        grid.innerHTML = '' // Vider le spinner
        
        // Grouper par catégorie
        const categories = {}
        services.forEach(service => {
            const cat = service.category || 'Autre'
            if (!categories[cat]) categories[cat] = []
            categories[cat].push(service)
        })
        
        // Afficher par catégorie
        Object.entries(categories).forEach(([category, categoryServices]) => {
            const categoryHeader = document.createElement('div')
            categoryHeader.className = 'col-12 mt-3'
            categoryHeader.innerHTML = `<h6 class="text-muted">${category}</h6>`
            grid.appendChild(categoryHeader)
            
            categoryServices.forEach(service => {
                const col = document.createElement('div')
                col.className = 'col-md-4 col-6'
                col.innerHTML = `
                    <div class="form-check service-checkbox">
                        <input class="form-check-input" type="checkbox" value="${service.id}" id="svc${service.id}">
                        <label class="form-check-label" for="svc${service.id}">
                            <i class="bi bi-${service.icon || 'circle-fill'}" style="color: ${service.color || '#3b82f6'}"></i>
                            <span>${service.name}</span>
                        </label>
                    </div>
                `
                grid.appendChild(col)
            })
        })
    } catch (error) {
        console.error('Erreur chargement services:', error)
        notify.error('Impossible de charger les services médicaux')
    }
}

// ==============================================================================
// EVENT LISTENERS
// ==============================================================================
function setupEventListeners() {
    // GÉOLOCALISATION
    const btnLocation = document.getElementById('btnGetLocation')
    if (btnLocation) {
        btnLocation.addEventListener('click', handleGeolocation)
    } else {
        console.warn('Bouton de géolocalisation non trouvé')
    }
    
    // AJOUT D'HORAIRE
    const btnAddOpening = document.getElementById('btnAddOpening')
    if (btnAddOpening) {
        btnAddOpening.addEventListener('click', handleAddOpening)
    } else {
        console.warn('Bouton d\'ajout d\'horaire non trouvé')
    }
    
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
// GÉOLOCALISATION
// ==============================================================================
function handleGeolocation() {
    if (!navigator.geolocation) {
        notify.error('La géolocalisation n\'est pas disponible sur votre navigateur')
        return
    }
    
    const btn = document.getElementById('btnGetLocation')
    const statusInput = document.getElementById('locationStatus')
    
    // Désactiver le bouton pendant le chargement
    if (btn) {
        btn.disabled = true
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Localisation...'
    }
    
    notify.info('Demande de localisation en cours...')
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            }
            
            if (statusInput) {
                statusInput.value = `📍 ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`
                statusInput.classList.add('text-success', 'fw-bold')
            }
            
            if (btn) {
                btn.disabled = false
                btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Position détectée'
                btn.classList.remove('btn-outline-secondary')
                btn.classList.add('btn-success')
            }
            
            notify.success('Position détectée avec succès!')
        },
        (error) => {
            let errorMessage = 'Impossible d\'obtenir votre position'
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Vous avez refusé l\'accès à votre position. Veuillez autoriser la géolocalisation dans les paramètres de votre navigateur.'
                    break
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Position indisponible. Vérifiez votre connexion GPS.'
                    break
                case error.TIMEOUT:
                    errorMessage = 'La demande de position a expiré. Réessayez.'
                    break
            }
            
            notify.error(errorMessage)
            
            if (btn) {
                btn.disabled = false
                btn.innerHTML = '<i class="bi bi-crosshair"></i> Détecter ma position'
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    )
}

// ==============================================================================
// AJOUT D'HORAIRE
// ==============================================================================
function handleAddOpening() {
    const daySelect = document.getElementById('daySelect')
    const timeRange = document.getElementById('timeRange')
    
    if (!daySelect || !timeRange) {
        notify.error('Erreur: éléments de formulaire non trouvés')
        return
    }
    
    const day = daySelect.value
    const range = timeRange.value
    
    // Vérifier si cette combinaison existe déjà
    const exists = openings.some(opening => 
        opening.day === day && opening.range === range
    )
    
    if (exists) {
        notify.warning(`${day} ${range} est déjà ajouté`)
        return
    }
    
    openings.push({ day, range })
    updateOpeningsList()
    notify.success(`${day} ${range} ajouté`)
}

// ==============================================================================
// AFFICHER LA LISTE DES HORAIRES
// ==============================================================================
function updateOpeningsList() {
    const list = document.getElementById('openingsList')
    if (!list) {
        console.warn('Liste des horaires non trouvée')
        return
    }
    
    list.innerHTML = ''
    
    if (openings.length === 0) {
        list.innerHTML = '<small class="text-muted">Aucun horaire ajouté</small>'
        return
    }
    
    openings.forEach((opening, index) => {
        const badge = document.createElement('span')
        badge.className = 'badge bg-primary me-1 mb-1'
        badge.style.cursor = 'pointer'
        badge.innerHTML = `${opening.day} ${opening.range} <i class="bi bi-x-circle ms-1"></i>`
        badge.title = 'Cliquer pour supprimer'
        badge.onclick = () => {
            openings.splice(index, 1)
            updateOpeningsList()
            notify.info(`${opening.day} ${opening.range} supprimé`)
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
    
    // Validation
    clearFormErrors()
    
    if (!validators.email(email)) {
        displayFormErrors({ loginEmail: 'Adresse email invalide' })
        return
    }
    
    if (!password) {
        displayFormErrors({ loginPassword: 'Mot de passe requis' })
        return
    }
    
    const spinner = document.getElementById('loginSpinner')
    const btn = document.getElementById('btnLogin')
    
    spinner.classList.remove('d-none')
    btn.disabled = true
    
    const loader = notify.loading('Connexion en cours...')
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        
        if (error) throw error
        
        store.setUser(data.user)
        loader.update('Connexion réussie!', 'success')
        
        // Redirection après un court délai
        setTimeout(() => {
            window.location.href = 'dashboard.html'
        }, 500)
    } catch (error) {
        console.error('Login error:', error)
        loader.dismiss()
        
        if (error.message.includes('Invalid login credentials')) {
            notify.error('Email ou mot de passe incorrect')
        } else {
            notify.error('Erreur de connexion: ' + error.message)
        }
    } finally {
        spinner.classList.add('d-none')
        btn.disabled = false
    }
}

// ==============================================================================
// SIGNUP COMPLET
// ==============================================================================
async function handleSignup() {
    // VALIDATION
    clearFormErrors()
    
    const formData = {
        email: document.getElementById('signupEmail').value.trim(),
        password: document.getElementById('signupPassword').value,
        hospitalName: document.getElementById('signupHospitalName').value.trim(),
        phone: document.getElementById('signupPhone').value.trim(),
        address: document.getElementById('signupAddress').value.trim()
    }
    
    // Règles de validation
    const rules = {
        email: {
            required: true,
            validator: validators.email,
            message: 'Adresse email invalide'
        },
        password: {
            required: true,
            validator: validators.password,
            message: 'Mot de passe trop faible'
        },
        hospitalName: {
            required: true,
            minLength: 3,
            message: 'Le nom de l\'hôpital doit contenir au moins 3 caractères'
        },
        phone: {
            required: true,
            validator: validators.phone,
            message: 'Numéro de téléphone invalide'
        },
        address: {
            required: true,
            minLength: 10,
            message: 'Adresse trop courte (minimum 10 caractères)'
        }
    }
    
    const validation = validateForm(formData, rules)
    
    if (!validation.valid) {
        displayFormErrors(validation.errors)
        notify.warning('Veuillez corriger les erreurs dans le formulaire')
        return
    }
    
    if (!userLocation) {
        notify.warning('Veuillez autoriser la géolocalisation pour continuer')
        document.getElementById('btnGetLocation')?.classList.add('btn-pulse')
        return
    }
    
    // Récupérer les services cochés
    selectedServices = Array.from(document.querySelectorAll('#servicesGrid input:checked'))
        .map(input => parseInt(input.value))
    
    if (selectedServices.length === 0) {
        notify.warning('Veuillez sélectionner au moins un service médical')
        return
    }
    
    if (!document.getElementById('termsCheck')?.checked) {
        notify.warning('Veuillez accepter les conditions d\'utilisation')
        return
    }
    
    const spinner = document.getElementById('signupSpinner')
    const btn = document.getElementById('btnSignup')
    spinner.classList.remove('d-none')
    btn.disabled = true
    
    const loader = notify.loading('Création du compte en cours...')
    
    try {
        // 1. CRÉER LE COMPTE AUTH
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: {
                    full_name: formData.hospitalName,
                    role: 'hospital_admin'
                },
                emailRedirectTo: window.location.origin + '/public/dashboard.html'
            }
        })
        
        if (authError) throw authError
        
        if (!authData.user) {
            throw new Error('Erreur lors de la création du compte')
        }
        
        loader.update('Compte créé! Configuration de l\'hôpital...', 'info')
        
        // 2. CRÉER L'HÔPITAL
        const hospitalData = {
            owner_id: authData.user.id,
            name: formData.hospitalName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            location: {
                type: 'Point',
                coordinates: [userLocation.lng, userLocation.lat]
            },
            openings: openings,
            status: 'pending'
        }
        
        const { data: hospital, error: hospitalError } = await api.createHospital(hospitalData)
        
        if (hospitalError) throw hospitalError
        
        loader.update('Hôpital créé! Ajout des services...', 'info')
        
        // 3. AJOUTER LES SERVICES
        for (const serviceId of selectedServices) {
            await api.upsertHospitalService(hospital.id, serviceId)
        }
        
        loader.update('✅ Inscription réussie! Redirection...', 'success')
        
        // Nettoyer le cache
        cache.invalidate('hospitals')
        
        // Redirection
        setTimeout(() => {
            window.location.href = 'dashboard.html'
        }, 1500)
        
    } catch (error) {
        console.error('Signup error:', error)
        loader.dismiss()
        
        if (error.message.includes('already registered')) {
            notify.error('Cet email est déjà utilisé')
        } else if (error.message.includes('Password')) {
            notify.error('Le mot de passe ne respecte pas les critères de sécurité')
        } else {
            notify.error('Erreur lors de l\'inscription: ' + error.message)
        }
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