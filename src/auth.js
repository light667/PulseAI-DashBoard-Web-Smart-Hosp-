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
async function initAuth() {
    console.log('🚀 PulseAI Auth - Initialisation...')
    
    // 1. Configurer les listeners EN PREMIER (pour que les boutons marchent tout de suite)
    setupEventListeners()

    // 0. Vérifier si déjà connecté (Redirection Dashboard)
    // On ne bloque pas l'initialisation pour ça, mais on redirige si besoin
    try {
        // On vérifie la session SANS délai
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
            console.log('🔍 Session locale trouvée, validation serveur...');
            
            // VALIDATION SERVEUR : Vérifier si l'utilisateur existe vraiment
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            
            if (userError || !user) {
                console.warn('⚠️ Session invalide ou utilisateur supprimé. Nettoyage complet...');
                await supabase.auth.signOut();
                localStorage.clear();
                sessionStorage.clear();
                // Pas de reload ici pour éviter une boucle infinie de rechargement
                return;
            }

            // Check for loop
            const loopCount = parseInt(sessionStorage.getItem('auth_loop_count') || '0');
            // On augmente la tolérance à 5 pour les cas de liens email qui peuvent faire plusieurs sauts
            if (loopCount > 5) {
                console.warn('🛑 Boucle de redirection détectée. Arrêt.');
                return;
            }
            
            sessionStorage.setItem('auth_loop_count', (loopCount + 1).toString());

            console.log('✅ Session validée, redirection vers le dashboard...')
            window.location.href = 'dashboard.html'
        }
    } catch (e) {
        console.warn('Erreur vérification session:', e)
    }
    
    // 2. Charger les données ensuite
    await loadServices()
    
    console.log('✅ Initialisation terminée')
}

// Gérer le chargement du module (compatible avec defer/async/module)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth)
} else {
    // Si le DOM est déjà prêt (cas fréquent avec type="module")
    initAuth()
}

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
    console.log('⚙️ Configuration des écouteurs d\'événements...')
    
    // GÉOLOCALISATION - Utilisation de délégation d'événements
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'btnGetLocation') {
            e.preventDefault()
            console.log('🎯 Bouton géolocalisation cliqué!')
            handleGeolocation()
        }
        
        // Gérer aussi le clic sur l'icône à l'intérieur du bouton
        if (e.target && e.target.closest('#btnGetLocation')) {
            e.preventDefault()
            console.log('🎯 Bouton géolocalisation cliqué (via icône)!')
            handleGeolocation()
        }
    })
    
    // AJOUT D'HORAIRE - Utilisation de délégation d'événements
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'btnAddOpening') {
            e.preventDefault()
            console.log('➕ Bouton ajout horaire cliqué!')
            handleAddOpening()
        }
        
        // Gérer aussi le clic sur l'icône à l'intérieur du bouton
        if (e.target && e.target.closest('#btnAddOpening')) {
            e.preventDefault()
            console.log('➕ Bouton ajout horaire cliqué (via icône)!')
            handleAddOpening()
        }
    })
    
    // LOGIN
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log('✓ Écouteur LOGIN (submit) configuré');
    } else {
        // Fallback pour compatibilité si le HTML n'est pas à jour
        const btnLogin = document.getElementById('btnLogin');
        if (btnLogin) {
            btnLogin.addEventListener('click', handleLogin);
            console.log('✓ Écouteur LOGIN (click) configuré');
        }
    }
    
    // SIGNUP - Écouter le SUBMIT du formulaire
    const signupForm = document.getElementById('signupForm')
    if (signupForm) {
        // Désactiver la validation HTML5 native qui peut bloquer silencieusement
        signupForm.setAttribute('novalidate', 'true')
        
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault()
            console.log('📝 Formulaire d\'inscription soumis!')
            
            // Debug des éléments
            const spinner = document.getElementById('signupSpinner')
            const btn = document.getElementById('btnSignup')
            console.log('Elements trouvés:', { spinner: !!spinner, btn: !!btn })
            
            // Afficher le spinner immédiatement
            if (spinner) {
                spinner.classList.remove('d-none')
                console.log('Spinner affiché')
            }
            if (btn) {
                btn.disabled = true
                console.log('Bouton désactivé')
            }
            
            console.log('Appel de handleSignup dans 10ms...')
            
            // Appel direct pour tester (sans timeout pour l'instant pour voir si ça bloque)
            try {
                console.log('Type de handleSignup:', typeof handleSignup)
                handleSignup()
            } catch (err) {
                console.error('CRASH handleSignup immédiat:', err)
                if (spinner) spinner.classList.add('d-none')
                if (btn) btn.disabled = false
                alert('Erreur interne: ' + err.message)
            }
        })
        console.log('✓ Écouteur SIGNUP (submit) configuré')
    }

    // SÉCURITÉ SUPPLÉMENTAIRE: Écouter aussi le clic sur le bouton
    const btnSignup = document.getElementById('btnSignup')
    if (btnSignup) {
        btnSignup.addEventListener('click', (e) => {
            // On ne fait rien ici, on laisse le submit se déclencher
            // Sauf si le bouton est disabled
            if (btnSignup.disabled) {
                e.preventDefault()
                e.stopPropagation()
            }
            console.log('🖱️ Clic sur bouton inscription détecté')
        })
    }
    
    // LOGOUT
    const btnLogout = document.getElementById('btnLogout')
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabase.auth.signOut()
            window.location.reload()
        })
        console.log('✓ Écouteur LOGOUT configuré')
    }
    
    console.log('✅ Tous les écouteurs configurés')
}

// ==============================================================================
// GÉOLOCALISATION
// ==============================================================================
function handleGeolocation() {
    console.log('📍 handleGeolocation appelée')
    
    if (!navigator.geolocation) {
        console.error('❌ Géolocalisation non supportée')
        notify.error('La géolocalisation n\'est pas disponible sur votre navigateur')
        alert('Votre navigateur ne supporte pas la géolocalisation')
        return
    }
    
    console.log('✓ Navigator.geolocation disponible')
    
    const btn = document.getElementById('btnGetLocation')
    const statusInput = document.getElementById('locationStatus')
    
    console.log('Bouton:', btn)
    console.log('Input status:', statusInput)
    
    // Désactiver le bouton pendant le chargement
    if (btn) {
        btn.disabled = true
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Localisation...'
    }
    
    notify.info('Demande de localisation en cours...')
    console.log('🔍 Appel de getCurrentPosition...')
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            console.log('✅ Position obtenue:', position.coords)
            
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            }
            
            console.log('📍 userLocation:', userLocation)
            
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
            console.log('✅ Géolocalisation réussie')
        },
        (error) => {
            console.error('❌ Erreur géolocalisation:', error)
            
            let errorMessage = 'Impossible d\'obtenir votre position'
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Vous avez refusé l\'accès à votre position. Veuillez autoriser la géolocalisation dans les paramètres de votre navigateur.'
                    console.error('Permission refusée')
                    break
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Position indisponible. Vérifiez votre connexion GPS.'
                    console.error('Position indisponible')
                    break
                case error.TIMEOUT:
                    errorMessage = 'La demande de position a expiré. Réessayez.'
                    console.error('Timeout')
                    break
            }
            
            notify.error(errorMessage)
            alert(errorMessage)
            
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
    console.log('➕ handleAddOpening appelée')
    
    const daySelect = document.getElementById('daySelect')
    const timeRange = document.getElementById('timeRange')
    
    console.log('daySelect:', daySelect)
    console.log('timeRange:', timeRange)
    
    if (!daySelect || !timeRange) {
        console.error('❌ Éléments non trouvés')
        notify.error('Erreur: éléments de formulaire non trouvés')
        alert('Erreur: éléments de formulaire non trouvés')
        return
    }
    
    const day = daySelect.value
    const range = timeRange.value
    
    console.log('Jour sélectionné:', day)
    console.log('Horaire sélectionné:', range)
    
    // Vérifier si cette combinaison existe déjà
    const exists = openings.some(opening => 
        opening.day === day && opening.range === range
    )
    
    if (exists) {
        console.warn('⚠️ Horaire déjà existant')
        notify.warning(`${day} ${range} est déjà ajouté`)
        alert(`${day} ${range} est déjà ajouté`)
        return
    }
    
    console.log('✓ Ajout de l\'horaire...')
    openings.push({ day, range })
    console.log('Horaires actuels:', openings)
    
    updateOpeningsList()
    notify.success(`${day} ${range} ajouté`)
    console.log('✅ Horaire ajouté avec succès')
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
async function handleLogin(e) {
    if (e) e.preventDefault(); // Empêcher le rechargement de la page
    
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
        
        // Reset loop counter on successful manual login
        sessionStorage.removeItem('auth_loop_count');

        // Redirection après un court délai
        setTimeout(() => {
            window.location.href = 'dashboard.html'
        }, 1000)
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
    console.log('🔥 handleSignup() appelée!')
    
    // VALIDATION
    clearFormErrors()
    
    const formData = {
        email: document.getElementById('signupEmail').value.trim(),
        password: document.getElementById('signupPassword').value,
        hospitalName: document.getElementById('signupHospitalName').value.trim(),
        phone: document.getElementById('signupPhone').value.trim(),
        address: document.getElementById('signupAddress').value.trim()
    }
    
    console.log('📋 Données du formulaire:', formData)
    
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
            minLength: 5,
            message: 'Adresse trop courte (minimum 5 caractères - Ville, Pays)'
        }
    }
    
    const validation = validateForm(formData, rules)
    
    if (!validation.valid) {
        displayFormErrors(validation.errors)
        notify.warning('Veuillez corriger les erreurs dans le formulaire')
        // Réactiver le bouton si erreur
        const spinner = document.getElementById('signupSpinner')
        const btn = document.getElementById('btnSignup')
        if (spinner) spinner.classList.add('d-none')
        if (btn) btn.disabled = false
        return
    }
    
    if (!userLocation) {
        notify.warning('Veuillez autoriser la géolocalisation pour continuer')
        document.getElementById('btnGetLocation')?.classList.add('btn-pulse')
        // Réactiver le bouton si erreur
        const spinner = document.getElementById('signupSpinner')
        const btn = document.getElementById('btnSignup')
        if (spinner) spinner.classList.add('d-none')
        if (btn) btn.disabled = false
        return
    }
    
    // Récupérer les services cochés
    selectedServices = Array.from(document.querySelectorAll('#servicesGrid input:checked'))
        .map(input => parseInt(input.value))
    
    // ⚠️ DÉSACTIVATION TEMPORAIRE DE LA VÉRIFICATION DES SERVICES
    // Si aucun service n'est chargé (problème réseau/cache), on permet quand même l'inscription
    // if (selectedServices.length === 0) {
    //     notify.warning('Veuillez sélectionner au moins un service médical')
    //     return
    // }
    
    if (!document.getElementById('termsCheck')?.checked) {
        notify.warning('Veuillez accepter les conditions d\'utilisation')
        // Réactiver le bouton si erreur
        if (spinner) spinner.classList.add('d-none')
        if (btn) btn.disabled = false
        return
    }
    
    // On ne réactive pas le spinner ici car il est déjà activé par l'event listener
    // const spinner = document.getElementById('signupSpinner')
    // const btn = document.getElementById('btnSignup')
    // if (spinner) spinner.classList.remove('d-none')
    // if (btn) btn.disabled = true
    
    console.log('🚀 Début de l\'inscription...')
    console.log('📧 Email:', formData.email)
    console.log('🏥 Hôpital:', formData.hospitalName)
    console.log('📍 Location:', userLocation)
    console.log('🕒 Horaires:', openings)
    console.log('🏥 Services sélectionnés:', selectedServices)
    
    const loader = notify.loading('Création du compte en cours...')
    
    try {
        // 1. CRÉER LE COMPTE AUTH
        console.log('1️⃣ Création du compte Auth...')
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
        
        console.log('Auth Response:', { authData, authError })
        
        if (authError) throw authError
        
        if (!authData.user) {
            throw new Error('Erreur lors de la création du compte')
        }
        
        console.log('✅ Compte Auth créé:', authData.user.id)
        
        // VÉRIFICATION DE LA SESSION (Email Confirmation)
        if (!authData.session) {
            console.warn('⚠️ Pas de session active (Email confirmation requise)')
            
            // SAUVEGARDE DES DONNÉES POUR FINALISATION ULTÉRIEURE
            const pendingData = {
                name: formData.hospitalName,
                phone: formData.phone,
                address: formData.address,
                location: {
                    type: 'Point',
                    coordinates: [userLocation.lng, userLocation.lat]
                },
                openings: openings,
                services: selectedServices
            };
            localStorage.setItem('pending_hospital_creation', JSON.stringify(pendingData));
            console.log('💾 Données sauvegardées pour finalisation après validation email');

            loader.dismiss()
            
            // Remplacer le formulaire par un message de succès clair
            const signupForm = document.getElementById('signupForm')
            if (signupForm) {
                signupForm.innerHTML = `
                    <div class="text-center py-5">
                        <div class="mb-4">
                            <i class="bi bi-envelope-check text-success" style="font-size: 4rem;"></i>
                        </div>
                        <h4 class="mb-3">Vérifiez vos emails</h4>
                        <p class="text-muted mb-4">
                            Un lien de confirmation a été envoyé à <strong>${formData.email}</strong>.<br>
                            Veuillez cliquer dessus pour activer votre compte.
                        </p>
                        <div class="alert alert-info small mx-3">
                            <i class="bi bi-info-circle me-2"></i>
                            Une fois confirmé, vous pourrez vous connecter à votre tableau de bord.
                        </div>
                        <a href="index.html" class="btn btn-outline-primary mt-3">Retour à l'accueil</a>
                    </div>
                `
                // Faire défiler vers le haut pour voir le message
                signupForm.scrollIntoView({ behavior: 'smooth' })
            }
            return
        }

        loader.update('Compte créé! Configuration de l\'hôpital...', 'info')
        
        // 2. CRÉER L'HÔPITAL
        console.log('2️⃣ Création de l\'hôpital...')
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
        
        console.log('Hospital Data:', hospitalData)
        
        const { data: hospital, error: hospitalError } = await api.createHospital(hospitalData)
        
        console.log('Hospital Response:', { hospital, hospitalError })
        
        if (hospitalError) throw hospitalError
        
        if (!hospital) {
            throw new Error('Erreur: hôpital non créé')
        }
        
        console.log('✅ Hôpital créé:', hospital.id)
        loader.update('Hôpital créé! Ajout des services...', 'info')
        
        // 3. AJOUTER LES SERVICES
        console.log('3️⃣ Ajout des services...')
        for (const serviceId of selectedServices) {
            console.log(`Ajout service ${serviceId}...`)
            const result = await api.upsertHospitalService(hospital.id, serviceId)
            console.log(`Service ${serviceId} ajouté:`, result)
        }
        
        console.log('✅ Tous les services ajoutés')
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
        // Récupérer les éléments à nouveau car ils ne sont pas dans la portée du finally
        const spinner = document.getElementById('signupSpinner')
        const btn = document.getElementById('btnSignup')
        if (spinner) spinner.classList.add('d-none')
        if (btn) btn.disabled = false
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
        
        // Check for loop
        const loopCount = parseInt(sessionStorage.getItem('auth_loop_count') || '0');
        if (loopCount > 2) {
            console.warn('🛑 Boucle de redirection détectée (onAuthStateChange). Arrêt.');
            return;
        }
        sessionStorage.setItem('auth_loop_count', (loopCount + 1).toString());

        setTimeout(() => {
            window.location.href = 'dashboard.html'
        }, 500)
    }
})