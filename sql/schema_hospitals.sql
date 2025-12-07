-- =============================================
-- SCHÉMA COMPLET POUR PULSEAI - HÔPITAUX
-- =============================================

-- Extension pour géolocalisation (PostGIS)
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================
-- TABLE: services (liste des services médicaux)
-- =============================================
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT, -- Cardiologie, Chirurgie, Urgences, etc.
    description TEXT,
    icon TEXT, -- Nom d'icône pour l'app
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Données initiales des services
INSERT INTO services (name, category, description) VALUES
    ('Cardiologie', 'Spécialités', 'Maladies du cœur et des vaisseaux'),
    ('Chirurgie Générale', 'Chirurgie', 'Interventions chirurgicales générales'),
    ('Urgences', 'Services d''urgence', 'Prise en charge des urgences 24h/24'),
    ('Pédiatrie', 'Spécialités', 'Soins pour enfants'),
    ('Gynécologie', 'Spécialités', 'Santé de la femme'),
    ('Orthopédie', 'Chirurgie', 'Traumatologie et chirurgie osseuse'),
    ('Radiologie', 'Imagerie', 'Examens d''imagerie médicale'),
    ('Laboratoire', 'Analyses', 'Analyses médicales'),
    ('Maternité', 'Spécialités', 'Accouchement et soins néonataux'),
    ('Ophtalmologie', 'Spécialités', 'Soins des yeux'),
    ('ORL', 'Spécialités', 'Oreilles, Nez, Gorge'),
    ('Dermatologie', 'Spécialités', 'Maladies de la peau'),
    ('Neurologie', 'Spécialités', 'Maladies du système nerveux'),
    ('Psychiatrie', 'Spécialités', 'Santé mentale'),
    ('Oncologie', 'Spécialités', 'Traitement du cancer'),
    ('Néphrologie', 'Spécialités', 'Maladies des reins'),
    ('Pneumologie', 'Spécialités', 'Maladies respiratoires'),
    ('Gastro-entérologie', 'Spécialités', 'Système digestif'),
    ('Rhumatologie', 'Spécialités', 'Maladies articulaires'),
    ('Anesthésie', 'Services', 'Anesthésie et réanimation'),
    ('Pharmacie', 'Services', 'Pharmacie hospitalière'),
    ('Ambulance', 'Services', 'Transport médical d''urgence'),
    ('Dentisterie', 'Spécialités', 'Soins dentaires'),
    ('Kinésithérapie', 'Rééducation', 'Rééducation physique')
ON CONFLICT (name) DO NOTHING;


-- =============================================
-- TABLE: hospitals (informations des hôpitaux)
-- =============================================
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Informations de base
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    description TEXT,
    
    -- Géolocalisation (PostGIS Point)
    location GEOMETRY(Point, 4326), -- Format: POINT(longitude, latitude)
    
    -- Horaires d'ouverture (JSON Array)
    openings JSONB DEFAULT '[]'::jsonb,
    -- Format: [{"day": "Lundi", "range": "08:00-20:00"}, ...]
    
    -- Statut de validation
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT, -- Raison du rejet si status = rejected
    
    -- Note moyenne (calculée depuis ratings)
    average_rating NUMERIC(2,1) DEFAULT 0.0,
    total_ratings INTEGER DEFAULT 0,
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id),
    
    UNIQUE(owner_id)
);

-- Index pour les recherches géographiques
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_hospitals_status ON hospitals(status);
CREATE INDEX IF NOT EXISTS idx_hospitals_owner ON hospitals(owner_id);


-- =============================================
-- TABLE: hospital_services (relation many-to-many)
-- =============================================
CREATE TABLE IF NOT EXISTS hospital_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE NOT NULL,
    
    -- Disponibilité du service
    is_available BOOLEAN DEFAULT true,
    
    -- Ressources pour ce service
    total_doctors INTEGER DEFAULT 0,
    available_doctors INTEGER DEFAULT 0,
    total_beds INTEGER DEFAULT 0,
    available_beds INTEGER DEFAULT 0,
    queue_length INTEGER DEFAULT 0, -- File d'attente
    
    -- Détails additionnels
    notes TEXT,
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(hospital_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_hospital_services_hospital ON hospital_services(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_services_service ON hospital_services(service_id);


-- =============================================
-- TABLE: ratings (notes des utilisateurs)
-- =============================================
CREATE TABLE IF NOT EXISTS ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Note (1 à 5 étoiles)
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    
    -- Commentaire (optionnel)
    comment TEXT,
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Un utilisateur ne peut noter qu'une fois par hôpital
    UNIQUE(hospital_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_hospital ON ratings(hospital_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id);


-- =============================================
-- TRIGGERS & FONCTIONS
-- =============================================

-- Fonction: Mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur les tables
CREATE TRIGGER update_hospitals_updated_at
    BEFORE UPDATE ON hospitals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hospital_services_updated_at
    BEFORE UPDATE ON hospital_services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ratings_updated_at
    BEFORE UPDATE ON ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Fonction: Calculer la note moyenne d'un hôpital
CREATE OR REPLACE FUNCTION calculate_hospital_rating(p_hospital_id UUID)
RETURNS VOID AS $$
DECLARE
    v_avg NUMERIC(2,1);
    v_count INTEGER;
BEGIN
    SELECT 
        COALESCE(ROUND(AVG(rating)::numeric, 1), 0.0),
        COUNT(*)
    INTO v_avg, v_count
    FROM ratings
    WHERE hospital_id = p_hospital_id;
    
    UPDATE hospitals
    SET 
        average_rating = v_avg,
        total_ratings = v_count
    WHERE id = p_hospital_id;
END;
$$ LANGUAGE plpgsql;


-- Trigger: Recalculer la note après insert/update/delete d'un rating
CREATE OR REPLACE FUNCTION trigger_recalculate_rating()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM calculate_hospital_rating(OLD.hospital_id);
    ELSE
        PERFORM calculate_hospital_rating(NEW.hospital_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rating_changed
    AFTER INSERT OR UPDATE OR DELETE ON ratings
    FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_rating();


-- =============================================
-- VUES UTILES
-- =============================================

-- Vue: Hôpitaux avec leurs services
CREATE OR REPLACE VIEW hospital_complete_info AS
SELECT 
    h.*,
    COALESCE(
        json_agg(
            json_build_object(
                'service_id', hs.service_id,
                'service_name', s.name,
                'service_category', s.category,
                'total_doctors', hs.total_doctors,
                'available_doctors', hs.available_doctors,
                'total_beds', hs.total_beds,
                'available_beds', hs.available_beds,
                'queue_length', hs.queue_length,
                'is_available', hs.is_available
            ) ORDER BY s.name
        ) FILTER (WHERE hs.service_id IS NOT NULL),
        '[]'
    ) as services
FROM hospitals h
LEFT JOIN hospital_services hs ON h.id = hs.hospital_id
LEFT JOIN services s ON hs.service_id = s.id
GROUP BY h.id;


-- =============================================
-- FONCTION: Recherche d'hôpitaux par proximité
-- =============================================
CREATE OR REPLACE FUNCTION find_nearby_hospitals(
    p_latitude FLOAT,
    p_longitude FLOAT,
    p_service_id INTEGER DEFAULT NULL,
    p_max_distance_km FLOAT DEFAULT 50,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    distance_km FLOAT,
    average_rating NUMERIC,
    total_ratings INTEGER,
    services JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.name,
        h.email,
        h.phone,
        h.address,
        ST_Distance(
            h.location::geography,
            ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
        ) / 1000 AS distance_km,
        h.average_rating,
        h.total_ratings,
        COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'service_id', hs.service_id,
                    'service_name', s.name,
                    'available_doctors', hs.available_doctors,
                    'available_beds', hs.available_beds,
                    'queue_length', hs.queue_length
                )
            )
            FROM hospital_services hs
            JOIN services s ON hs.service_id = s.id
            WHERE hs.hospital_id = h.id AND hs.is_available = true),
            '[]'::json
        )::jsonb AS services
    FROM hospitals h
    WHERE 
        h.status = 'approved'
        AND h.location IS NOT NULL
        AND (p_service_id IS NULL OR EXISTS (
            SELECT 1 FROM hospital_services hs
            WHERE hs.hospital_id = h.id 
            AND hs.service_id = p_service_id
            AND hs.is_available = true
        ))
        AND ST_DWithin(
            h.location::geography,
            ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
            p_max_distance_km * 1000
        )
    ORDER BY 
        distance_km ASC,
        h.average_rating DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- COMMENTAIRES
-- =============================================
COMMENT ON TABLE services IS 'Liste des services médicaux disponibles';
COMMENT ON TABLE hospitals IS 'Informations des hôpitaux inscrits';
COMMENT ON TABLE hospital_services IS 'Services offerts par chaque hôpital avec disponibilités';
COMMENT ON TABLE ratings IS 'Notes et avis des utilisateurs sur les hôpitaux';
COMMENT ON FUNCTION find_nearby_hospitals IS 'Recherche d''hôpitaux par proximité géographique et service';
