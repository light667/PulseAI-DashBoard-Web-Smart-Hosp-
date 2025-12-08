// ==============================================================================
// PULSEAI - LISTE PUBLIQUE DES HÔPITAUX
// ==============================================================================

import { supabase } from './supabase.js';

let allHospitals = [];
let userLocation = null;

// ==============================================================================
// INITIALISATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadServices();
    await loadHospitals();
    setupEventListeners();
});

// ==============================================================================
// CHARGEMENT DES SERVICES POUR LE FILTRE
// ==============================================================================
async function loadServices() {
    try {
        const { data: services, error } = await supabase
            .from('services')
            .select('*')
            .order('name');

        if (error) throw error;

        const serviceFilter = document.getElementById('serviceFilter');
        services.forEach(service => {
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = service.name;
            serviceFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur chargement services:', error);
    }
}

// ==============================================================================
// CHARGEMENT DES HÔPITAUX APPROUVÉS
// ==============================================================================
async function loadHospitals() {
    try {
        const { data: hospitals, error } = await supabase
            .from('hospitals')
            .select(`
                *,
                hospital_services(
                    service_id,
                    total_doctors,
                    available_doctors,
                    total_beds,
                    available_beds,
                    queue_length,
                    is_active,
                    services(name, icon)
                )
            `)
            .eq('status', 'approved')
            .order('name');

        if (error) throw error;

        allHospitals = hospitals || [];
        displayHospitals(allHospitals);
    } catch (error) {
        console.error('Erreur chargement hôpitaux:', error);
        showError('Impossible de charger les hôpitaux. Veuillez réessayer.');
    }
}

// ==============================================================================
// AFFICHAGE DES HÔPITAUX
// ==============================================================================
function displayHospitals(hospitals) {
    const loadingState = document.getElementById('loadingState');
    const hospitalsList = document.getElementById('hospitalsList');
    const emptyState = document.getElementById('emptyState');

    loadingState.style.display = 'none';

    if (hospitals.length === 0) {
        hospitalsList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    hospitalsList.style.display = 'flex';
    hospitalsList.innerHTML = '';

    hospitals.forEach(hospital => {
        const card = createHospitalCard(hospital);
        hospitalsList.appendChild(card);
    });
}

// ==============================================================================
// CRÉATION D'UNE CARTE D'HÔPITAL
// ==============================================================================
function createHospitalCard(hospital) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4 mb-4';

    // Calculer la distance si localisation disponible
    let distanceHTML = '';
    if (userLocation && hospital.location) {
        const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            hospital.location.coordinates[1],
            hospital.location.coordinates[0]
        );
        distanceHTML = `
            <div class="hospital-info-item">
                <i class="bi bi-geo-fill"></i>
                <span>${distance.toFixed(1)} km</span>
            </div>
        `;
    }

    // Services actifs
    const activeServices = hospital.hospital_services?.filter(hs => hs.is_active) || [];
    const servicesHTML = activeServices.map(hs => `
        <span class="service-badge">
            <i class="bi bi-${hs.services?.icon || 'heart-pulse'}"></i>
            ${hs.services?.name || 'Service'}
        </span>
    `).join('');

    // Stats rapides
    const totalDoctors = activeServices.reduce((sum, hs) => sum + (hs.total_doctors || 0), 0);
    const availableBeds = activeServices.reduce((sum, hs) => sum + (hs.available_beds || 0), 0);

    col.innerHTML = `
        <div class="hospital-card-public">
            <div class="hospital-card-header">
                <h3>${hospital.name}</h3>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="hospital-rating">
                        <i class="bi bi-star-fill"></i>
                        ${hospital.average_rating ? hospital.average_rating.toFixed(1) : 'N/A'}
                    </span>
                    <small class="text-muted">${hospital.total_ratings || 0} avis</small>
                </div>
            </div>
            <div class="hospital-card-body">
                <div class="hospital-info-item">
                    <i class="bi bi-telephone-fill"></i>
                    <span>${hospital.phone || 'Non renseigné'}</span>
                </div>
                <div class="hospital-info-item">
                    <i class="bi bi-geo-alt-fill"></i>
                    <span>${hospital.address || 'Adresse non disponible'}</span>
                </div>
                ${distanceHTML}
                
                <hr class="my-3">
                
                <div class="row text-center mb-3">
                    <div class="col-6">
                        <div class="fw-bold text-primary">${totalDoctors}</div>
                        <small class="text-muted">Médecins</small>
                    </div>
                    <div class="col-6">
                        <div class="fw-bold text-success">${availableBeds}</div>
                        <small class="text-muted">Lits disponibles</small>
                    </div>
                </div>

                <div class="hospital-services-list">
                    ${servicesHTML || '<small class="text-muted">Aucun service actif</small>'}
                </div>

                <button class="btn btn-outline-primary w-100 mt-3" onclick="viewHospitalDetails('${hospital.id}')">
                    <i class="bi bi-info-circle me-2"></i>Voir les détails
                </button>
            </div>
        </div>
    `;

    return col;
}

// ==============================================================================
// CALCUL DE DISTANCE (Formule de Haversine)
// ==============================================================================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ==============================================================================
// GÉOLOCALISATION
// ==============================================================================
document.getElementById('btnGetLocation')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnGetLocation');
    const originalHTML = btn.innerHTML;
    
    if (!navigator.geolocation) {
        alert('La géolocalisation n\'est pas supportée par votre navigateur');
        return;
    }

    btn.innerHTML = '<span class="loading-spinner"></span>';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };

            // Trier par distance
            const hospitalsWithDistance = allHospitals
                .map(hospital => {
                    if (hospital.location) {
                        const distance = calculateDistance(
                            userLocation.latitude,
                            userLocation.longitude,
                            hospital.location.coordinates[1],
                            hospital.location.coordinates[0]
                        );
                        return { ...hospital, distance };
                    }
                    return { ...hospital, distance: Infinity };
                })
                .sort((a, b) => a.distance - b.distance);

            displayHospitals(hospitalsWithDistance);
            btn.innerHTML = '<i class="bi bi-geo-alt-fill"></i>';
            btn.disabled = false;
        },
        (error) => {
            console.error('Erreur géolocalisation:', error);
            alert('Impossible d\'obtenir votre position');
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    );
});

// ==============================================================================
// RECHERCHE ET FILTRES
// ==============================================================================
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const serviceFilter = document.getElementById('serviceFilter');

    searchInput?.addEventListener('input', filterHospitals);
    serviceFilter?.addEventListener('change', filterHospitals);
}

function filterHospitals() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedService = document.getElementById('serviceFilter').value;

    let filtered = allHospitals;

    // Filtre par recherche textuelle
    if (searchTerm) {
        filtered = filtered.filter(hospital => 
            hospital.name.toLowerCase().includes(searchTerm) ||
            hospital.address?.toLowerCase().includes(searchTerm)
        );
    }

    // Filtre par service
    if (selectedService) {
        filtered = filtered.filter(hospital => 
            hospital.hospital_services?.some(hs => 
                hs.service_id == selectedService && hs.is_active
            )
        );
    }

    displayHospitals(filtered);
}

// ==============================================================================
// VOIR DÉTAILS (Fonction globale)
// ==============================================================================
window.viewHospitalDetails = function(hospitalId) {
    // TODO: Créer une page de détails ou ouvrir un modal
    alert(`Détails de l'hôpital ${hospitalId}\n\nCette fonctionnalité sera bientôt disponible !`);
};

// ==============================================================================
// GESTION DES ERREURS
// ==============================================================================
function showError(message) {
    const loadingState = document.getElementById('loadingState');
    loadingState.innerHTML = `
        <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            ${message}
        </div>
    `;
}
