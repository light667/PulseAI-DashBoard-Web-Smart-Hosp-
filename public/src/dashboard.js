import { supabase } from './supabase.js';
import { api } from './utils/api.js'; // Assurez-vous que api.js exporte une instance par défaut ou nommée correctement

// État global du dashboard
const state = {
    user: null,
    hospital: null,
    services: [],
    equipments: []
};

// ==============================================================================
// INITIALISATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
        });
    }

    // GLOBAL LOGOUT LISTENER (Delegation)
    document.body.addEventListener('click', async (e) => {
        const btn = e.target.closest('#btnLogout');
        if (btn) {
            e.preventDefault();
            console.log('🚪 Déconnexion demandée (Global Listener)...');
            
            // 1. Clear Local Storage IMMEDIATELY (Synchronous)
            // This prevents any further auth checks from finding a session
            localStorage.clear();
            sessionStorage.clear();
            console.log('✅ Stockage local nettoyé');

            try {
                // 2. Try to sign out from Supabase (Best effort)
                await supabase.auth.signOut();
            } catch (err) {
                console.warn('Erreur Supabase signOut (ignorée car stockage nettoyé):', err);
            } finally {
                // 3. Redirect ALWAYS
                window.location.replace('index.html');
            }
        }
    });

    // Clear auth loop flag if we reached dashboard successfully
    if (sessionStorage.getItem('auth_loop_count')) {
        sessionStorage.removeItem('auth_loop_count');
    }

    // Vérifier si on est en train de traiter un lien magique ou une confirmation
    const isAuthRedirect = window.location.hash && (
        window.location.hash.includes('access_token') || 
        window.location.hash.includes('type=signup') || 
        window.location.hash.includes('type=recovery')
    );

    if (isAuthRedirect) {
        console.log('🔗 Détection d\'un lien d\'authentification, attente du traitement...');
    }

    // Fonction d'initialisation de la session (pour éviter la duplication)
    const initSession = async (session) => {
        console.log('✅ Session active:', session.user.email);
        state.user = session.user;
        
        // Mise à jour UI
        const userNameEl = document.getElementById('headerUserName');
        if (userNameEl) userNameEl.textContent = state.user.email;
        
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.style.display = 'none';

        // Initialisation des données si ce n'est pas déjà fait
        if (!state.hospital) {
            setupNavigation();
            try {
                await loadDashboardData();
            } catch (err) {
                console.error('❌ Erreur critique chargement dashboard:', err);
                // Ne pas bloquer l'UI, mais afficher une erreur
                const loader = document.getElementById('loading-overlay');
                if (loader) {
                    loader.innerHTML = `
                        <div class="text-center text-danger">
                            <h3>Erreur de chargement</h3>
                            <p>${err.message}</p>
                            <button class="btn btn-primary mt-3" onclick="window.location.reload()">Réessayer</button>
                        </div>
                    `;
                }
            }
        }
    };

    // On utilise onAuthStateChange pour gérer la session de manière plus robuste
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔐 Auth State Change:', event);
        
        if (session) {
            // Si on a une session, on initialise TOUJOURS, même si event est SIGNED_IN ou TOKEN_REFRESHED
            await initSession(session);
        } else {
            // Si on est en train de traiter un lien auth, on ne redirige pas tout de suite
            if (isAuthRedirect) {
                console.log('⏳ Traitement du lien auth en cours, pas de redirection immédiate...');
                return;
            }

            // DOUBLE VÉRIFICATION : Parfois onAuthStateChange(SIGNED_OUT) se déclenche au chargement
            // alors qu'une session existe dans le storage (race condition).
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                console.log('⚠️ Faux positif de déconnexion, session trouvée via getSession');
                await initSession(data.session);
                return;
            }

            // Retry once after 500ms to be sure
            setTimeout(async () => {
                const { data: retryData } = await supabase.auth.getSession();
                if (retryData.session) {
                    console.log('⚠️ Session récupérée après délai');
                    await initSession(retryData.session);
                    return;
                }
                
                // Si vraiment pas de session, on redirige
                console.warn('⛔ Pas de session, redirection vers index.html');
                window.location.href = 'index.html';
            }, 500);
        }
    });
});

// Ancienne fonction checkSession supprimée au profit de onAuthStateChange
// async function checkSession() { ... }

// ==============================================================================
// NAVIGATION (SPA ROUTER)
// ==============================================================================
function setupNavigation() {
    const links = document.querySelectorAll('.nav-link[data-target]');
    const sections = document.querySelectorAll('.content-section');
    const pageTitle = document.getElementById('pageTitle');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            
            // Update Active Link
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update Section
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(targetId)?.classList.add('active');

            // Update Title
            const titleMap = {
                'home': 'Tableau de bord',
                'services': 'Gestion des Services',
                'equipments': 'Parc d\'Équipements',
                'patients': 'File d\'attente',
                'settings': 'Paramètres'
            };
            pageTitle.textContent = titleMap[targetId] || 'PulseAI';
        });
    });

    // Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('🚪 Déconnexion en cours...');
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                console.log('✅ Déconnecté avec succès');
                window.location.href = 'index.html';
            } catch (err) {
                console.error('❌ Erreur lors de la déconnexion:', err);
                // Force redirect anyway
                window.location.href = 'index.html';
            }
        });
    } else {
        console.error('❌ Bouton de déconnexion non trouvé !');
    }
}

// ==============================================================================
// CHARGEMENT DES DONNÉES
// ==============================================================================
async function loadDashboardData() {
    try {
        // 1. Récupérer l'hôpital lié à l'utilisateur
        let { data: hospital, error } = await supabase
            .from('hospitals')
            .select('*')
            .eq('owner_id', state.user.id)
            .maybeSingle(); // Utiliser maybeSingle pour éviter l'erreur 406/PGRST116 si 0 résultats

        if (error) throw error;

        // CAS SPÉCIAL : Compte créé mais hôpital non finalisé (Email confirmation flow)
        if (!hospital) {
            console.warn('⚠️ Aucun hôpital trouvé. Vérification des données en attente...');
            const pendingData = localStorage.getItem('pending_hospital_creation');
            
            if (pendingData) {
                console.log('🔄 Finalisation de la création de l\'hôpital...');
                const data = JSON.parse(pendingData);
                
                // Préparation de la location en format WKT pour PostGIS
                // Le format attendu est "POINT(lng lat)"
                let locationWKT = null;
                if (data.location && data.location.coordinates) {
                    const [lng, lat] = data.location.coordinates;
                    locationWKT = `POINT(${lng} ${lat})`;
                }

                // Création de l'hôpital
                const { data: newHospital, error: createError } = await supabase
                    .from('hospitals')
                    .insert({
                        owner_id: state.user.id,
                        name: data.name,
                        email: state.user.email,
                        phone: data.phone,
                        address: data.address,
                        location: locationWKT, // Envoi du WKT
                        openings: data.openings,
                        status: 'pending'
                    })
                    .select()
                    .single();

                if (createError) throw createError;
                
                hospital = newHospital;
                localStorage.removeItem('pending_hospital_creation'); // Nettoyage
                console.log('✅ Hôpital créé avec succès !');

                // Ajout des services si présents
                if (data.services && data.services.length > 0) {
                    const servicesToInsert = data.services.map(serviceId => ({
                        hospital_id: hospital.id,
                        service_id: serviceId,
                        is_available: true
                    }));
                    await supabase.from('hospital_services').insert(servicesToInsert);
                }
            } else {
                // Vraiment aucun hôpital et pas de données en attente -> Redirection ou message
                console.error('❌ Compte orphelin : User ID', state.user.id);
                alert('Votre compte est actif mais aucun profil d\'hôpital n\'est associé. Veuillez contacter le support.');
                return;
            }
        }

        console.log('🏥 Hôpital chargé:', hospital);
        state.hospital = hospital;

        // Update UI Home
        const elName = document.getElementById('hospitalNameDisplay');
        const elAddr = document.getElementById('hospitalAddress');
        const elPhone = document.getElementById('hospitalPhone');
        const elStatus = document.getElementById('hospitalStatus');

        if (elName) elName.textContent = hospital.name;
        if (elAddr) elAddr.textContent = hospital.address;
        if (elPhone) elPhone.textContent = hospital.phone;
        if (elStatus) elStatus.textContent = hospital.status === 'approved' ? 'Validé' : 'En attente';

        // Update Settings Fields
        const settingsName = document.getElementById('settingsName');
        const settingsEmail = document.getElementById('settingsEmail');
        const settingsPhone = document.getElementById('settingsPhone');
        
        if (settingsName) settingsName.value = hospital.name;
        if (settingsEmail) settingsEmail.value = hospital.email;
        if (settingsPhone) settingsPhone.value = hospital.phone;

        // 2. Charger les services
        await loadServices();

        // 3. Charger les équipements
        await loadEquipments();

    } catch (error) {
        console.error('Erreur chargement dashboard:', error);
        // Si pas d'hôpital trouvé, rediriger vers une page de création ou afficher un message
        const loader = document.getElementById('loading-overlay');
        if (loader) {
            loader.innerHTML = `
                <div class="text-center text-danger">
                    <h3>Erreur de chargement</h3>
                    <p>${error.message || 'Impossible de charger les données'}</p>
                    <button class="btn btn-primary mt-3" onclick="window.location.reload()">Réessayer</button>
                </div>
            `;
        }
    }
}

// ==============================================================================
// GESTION DES SERVICES
// ==============================================================================
async function loadServices() {
    const { data, error } = await supabase
        .from('hospital_services')
        .select(`
            *,
            services ( name, icon, category )
        `)
        .eq('hospital_id', state.hospital.id);

    if (error) {
        console.error('Erreur services:', error);
        return;
    }

    state.services = data;
    renderServices();
    updateStats();
}

function renderServices() {
    const grid = document.getElementById('servicesGrid');
    grid.innerHTML = '';

    state.services.forEach(item => {
        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-4';
        card.innerHTML = `
            <div class="card service-card h-100 border-0 shadow-sm" onclick="window.openServiceDetails('${item.id}')">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-3">
                        <div class="bg-light rounded p-3 me-3 text-primary">
                            <i class="bi bi-${item.services.icon || 'hospital'} fs-4"></i>
                        </div>
                        <div>
                            <h6 class="fw-bold mb-1">${item.services.name}</h6>
                            <span class="badge bg-secondary bg-opacity-10 text-secondary">${item.services.category}</span>
                        </div>
                    </div>
                    <div class="row g-2 text-center mt-3">
                        <div class="col-6">
                            <div class="border rounded p-2">
                                <small class="text-muted d-block">Médecins</small>
                                <span class="fw-bold text-primary">${item.active_doctors || 0}/${item.doctor_count || 0}</span>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="border rounded p-2">
                                <small class="text-muted d-block">Attente</small>
                                <span class="fw-bold ${getWaitColor(item.waiting_time_minutes)}">${item.waiting_time_minutes || 0} min</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function getWaitColor(minutes) {
    if (!minutes) return 'text-success';
    if (minutes < 30) return 'text-success';
    if (minutes < 60) return 'text-warning';
    return 'text-danger';
}

// Exposer la fonction au scope global pour le onclick HTML
window.openServiceDetails = (serviceId) => {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;

    document.getElementById('editServiceId').value = service.id;
    document.getElementById('editDoctorCount').value = service.doctor_count || 0;
    document.getElementById('editActiveDoctors').value = service.active_doctors || 0;
    document.getElementById('editWaitingTime').value = service.waiting_time_minutes || 0;

    const modal = new bootstrap.Modal(document.getElementById('serviceDetailsModal'));
    modal.show();
};

window.saveServiceDetails = async () => {
    const id = document.getElementById('editServiceId').value;
    const updates = {
        doctor_count: parseInt(document.getElementById('editDoctorCount').value),
        active_doctors: parseInt(document.getElementById('editActiveDoctors').value),
        waiting_time_minutes: parseInt(document.getElementById('editWaitingTime').value)
    };

    const { error } = await supabase
        .from('hospital_services')
        .update(updates)
        .eq('id', id);

    if (!error) {
        // Fermer modal et recharger
        const el = document.getElementById('serviceDetailsModal');
        const modal = bootstrap.Modal.getInstance(el);
        modal.hide();
        loadServices(); // Recharger pour mettre à jour l'UI
    } else {
        alert('Erreur lors de la mise à jour');
    }
};

// ==============================================================================
// GESTION DES ÉQUIPEMENTS
// ==============================================================================
async function loadEquipments() {
    // Vérifier d'abord si la table existe (au cas où le script SQL n'a pas été joué)
    const { data, error } = await supabase
        .from('hospital_equipments')
        .select('*')
        .eq('hospital_id', state.hospital.id);

    if (error) {
        console.warn('Table équipements non trouvée ou vide', error);
        return;
    }

    state.equipments = data;
    renderEquipments();
    updateStats();
}

function renderEquipments() {
    const tbody = document.getElementById('equipmentsTableBody');
    tbody.innerHTML = '';

    if (state.equipments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Aucun équipement enregistré</td></tr>';
        return;
    }

    state.equipments.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4 fw-medium">${item.name}</td>
            <td><span class="badge bg-light text-dark border">${item.category || 'Général'}</span></td>
            <td class="text-center">${item.total_quantity}</td>
            <td class="text-center fw-bold">${item.available_quantity}</td>
            <td>${getStatusBadge(item.status)}</td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-light text-primary"><i class="bi bi-pencil"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getStatusBadge(status) {
    const map = {
        'operational': '<span class="badge bg-success-subtle text-success">Opérationnel</span>',
        'maintenance': '<span class="badge bg-warning-subtle text-warning">Maintenance</span>',
        'broken': '<span class="badge bg-danger-subtle text-danger">Hors service</span>'
    };
    return map[status] || status;
}

// ==============================================================================
// STATS
// ==============================================================================
function updateStats() {
    document.getElementById('statServices').textContent = state.services.length;
    
    // Calculer le total des médecins disponibles
    const totalDoctors = state.services.reduce((acc, curr) => acc + (curr.active_doctors || 0), 0);
    document.getElementById('statDoctors').textContent = totalDoctors;

    document.getElementById('statEquipments').textContent = state.equipments.length;
}

// ==============================================================================
// AJOUT DE SERVICES & ÉQUIPEMENTS
// ==============================================================================

// --- SERVICES ---
window.showAddServiceModal = async () => {
    const select = document.getElementById('newServiceSelect');
    select.innerHTML = '<option>Chargement...</option>';
    
    const modal = new bootstrap.Modal(document.getElementById('addServiceModal'));
    modal.show();

    // Charger tous les services disponibles dans le système
    const { data: allServices } = await supabase.from('services').select('*').eq('is_active', true);
    
    // Filtrer ceux déjà ajoutés
    const existingIds = state.services.map(s => s.service_id);
    const available = allServices.filter(s => !existingIds.includes(s.id));

    select.innerHTML = '';
    if (available.length === 0) {
        select.innerHTML = '<option value="">Tous les services sont déjà ajoutés</option>';
        return;
    }

    available.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.category})`;
        select.appendChild(opt);
    });
};

window.saveNewService = async () => {
    const serviceId = document.getElementById('newServiceSelect').value;
    const price = document.getElementById('newServicePrice').value;

    if (!serviceId) return;

    const { error } = await supabase.from('hospital_services').insert({
        hospital_id: state.hospital.id,
        service_id: serviceId,
        consultation_price: price,
        is_available: true
    });

    if (!error) {
        bootstrap.Modal.getInstance(document.getElementById('addServiceModal')).hide();
        loadServices();
    } else {
        alert('Erreur lors de l\'ajout du service');
    }
};

// --- ÉQUIPEMENTS ---
window.showAddEquipmentModal = () => {
    document.getElementById('addEquipmentForm').reset();
    const modal = new bootstrap.Modal(document.getElementById('addEquipmentModal'));
    modal.show();
};

window.saveNewEquipment = async () => {
    const data = {
        hospital_id: state.hospital.id,
        name: document.getElementById('newEquipName').value,
        category: document.getElementById('newEquipCategory').value,
        total_quantity: parseInt(document.getElementById('newEquipTotal').value),
        available_quantity: parseInt(document.getElementById('newEquipAvailable').value),
        status: document.getElementById('newEquipStatus').value
    };

    if (!data.name) {
        alert('Le nom est requis');
        return;
    }

    const { error } = await supabase.from('hospital_equipments').insert(data);

    if (!error) {
        bootstrap.Modal.getInstance(document.getElementById('addEquipmentModal')).hide();
        loadEquipments();
    } else {
        console.error(error);
        alert('Erreur lors de l\'ajout de l\'équipement');
    }
};
