-- ==============================================================================
-- PULSEAI - SCRIPT SQL DE PRODUCTION
-- ==============================================================================
-- Version: 2.1
-- Date: 2025-12-09
-- Description: Base de données complète optimisée pour la production
-- 
-- INSTRUCTIONS:
-- 1. Exécuter ce script INTÉGRALEMENT dans Supabase SQL Editor
-- 2. Attendre la fin complète de l'exécution (peut prendre 30-60 secondes)
-- 3. Vérifier les messages de succès à la fin
-- 4. Ne PAS exécuter ce script plusieurs fois (il reset tout)
-- 
-- IMPORTANT: Ce script supprime TOUTES les données existantes avant de recréer
-- ==============================================================================

-- ==============================================================================
-- 0. NETTOYAGE COMPLET (RESET)
-- ==============================================================================
-- ⚠️ ATTENTION : Cette section supprime toutes les données existantes !
-- Nous supprimons les tables dans l'ordre inverse des dépendances (CASCADE gère aussi les liens)

DROP TABLE IF EXISTS public.analytics CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.ratings CASCADE;
DROP TABLE IF EXISTS public.hospital_services CASCADE;
DROP TABLE IF EXISTS public.hospitals CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Suppression des types énumérés
DROP TYPE IF EXISTS hospital_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Suppression des fonctions (pour éviter les conflits de signature)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_hospital_rating() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_distance(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;
DROP FUNCTION IF EXISTS public.search_hospitals_nearby(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) CASCADE;

-- ==============================================================================
-- 1. EXTENSIONS (PostGIS requis pour géolocalisation)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements; -- Monitoring performances

-- Vérification PostGIS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        RAISE EXCEPTION 'PostGIS n''est pas installé. Contactez le support Supabase.';
    END IF;
    RAISE NOTICE '✓ PostGIS activé et fonctionnel';
END $$;

-- ==============================================================================
-- 2. TYPES ENUM PERSONNALISÉS
-- ==============================================================================
DO $$ BEGIN
    CREATE TYPE hospital_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('hospital_admin', 'admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. TABLE PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role DEFAULT 'hospital_admin',
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ==============================================================================
-- 4. TABLE SERVICES (Catalogue médical)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.services (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    icon TEXT DEFAULT 'hospital-fill',
    category TEXT DEFAULT 'Général',
    description TEXT,
    color TEXT DEFAULT '#3b82f6',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);

-- ==============================================================================
-- 5. TABLE HOSPITALS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Informations de base
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Afrique',
    postal_code TEXT,
    website TEXT,
    description TEXT,
    logo_url TEXT,
    
    -- Géolocalisation (PostGIS)
    location GEOGRAPHY(Point, 4326),
    
    -- Horaires d'ouverture
    openings JSONB DEFAULT '[]'::jsonb,
    emergency_24h BOOLEAN DEFAULT false,
    
    -- Capacité globale
    total_capacity INTEGER DEFAULT 0,
    emergency_capacity INTEGER DEFAULT 0,
    
    -- Statut et validation
    status hospital_status DEFAULT 'pending',
    rejection_reason TEXT,
    validated_at TIMESTAMPTZ,
    validated_by UUID REFERENCES auth.users(id),
    
    -- Statistiques
    average_rating DECIMAL(3,2) DEFAULT 0.0 CHECK (average_rating >= 0 AND average_rating <= 5),
    total_ratings INTEGER DEFAULT 0,
    total_visits INTEGER DEFAULT 0,
    
    -- Certification
    is_certified BOOLEAN DEFAULT false,
    certification_level TEXT,
    certifications JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT valid_rating CHECK (average_rating >= 0 AND average_rating <= 5),
    CONSTRAINT valid_location CHECK (location IS NULL OR ST_X(location::geometry) BETWEEN -180 AND 180 AND ST_Y(location::geometry) BETWEEN -90 AND 90)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_hospitals_owner ON public.hospitals(owner_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_status ON public.hospitals(status);
CREATE INDEX IF NOT EXISTS idx_hospitals_name ON public.hospitals(name);
CREATE INDEX IF NOT EXISTS idx_hospitals_rating ON public.hospitals(average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_hospitals_created ON public.hospitals(created_at DESC);

-- Index spatial pour géolocalisation
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON public.hospitals USING GIST(location);

-- ==============================================================================
-- 6. TABLE HOSPITAL_SERVICES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.hospital_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    
    -- Disponibilité
    is_active BOOLEAN DEFAULT true,
    
    -- Ressources humaines
    doctors_total INTEGER DEFAULT 0 CHECK (doctors_total >= 0),
    doctors_available INTEGER DEFAULT 0 CHECK (doctors_available >= 0),
    nurses_total INTEGER DEFAULT 0 CHECK (nurses_total >= 0),
    nurses_available INTEGER DEFAULT 0 CHECK (nurses_available >= 0),
    
    -- Ressources matérielles
    beds_total INTEGER DEFAULT 0 CHECK (beds_total >= 0),
    beds_available INTEGER DEFAULT 0 CHECK (beds_available >= 0),
    equipment_level TEXT DEFAULT 'basic', -- basic, intermediate, advanced
    
    -- File d'attente
    queue_length INTEGER DEFAULT 0 CHECK (queue_length >= 0),
    avg_wait_time INTEGER DEFAULT 0, -- en minutes
    
    -- Statistiques
    total_patients_today INTEGER DEFAULT 0,
    total_patients_month INTEGER DEFAULT 0,
    
    -- Tarification (optionnel)
    consultation_price DECIMAL(10,2),
    currency TEXT DEFAULT 'XOF',
    accepts_insurance BOOLEAN DEFAULT false,
    
    -- Horaires spécifiques au service
    service_hours JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_update_by UUID REFERENCES auth.users(id),
    
    -- Contraintes
    UNIQUE(hospital_id, service_id),
    CONSTRAINT valid_doctors CHECK (doctors_available <= doctors_total),
    CONSTRAINT valid_nurses CHECK (nurses_available <= nurses_total),
    CONSTRAINT valid_beds CHECK (beds_available <= beds_total)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_hospital_services_hospital ON public.hospital_services(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_services_service ON public.hospital_services(service_id);
CREATE INDEX IF NOT EXISTS idx_hospital_services_active ON public.hospital_services(is_active);
CREATE INDEX IF NOT EXISTS idx_hospital_services_availability ON public.hospital_services(hospital_id, is_active, beds_available);

-- ==============================================================================
-- 7. TABLE RATINGS (Avis et notes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Note et commentaire
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    -- Critères détaillés (optionnel)
    cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
    staff_rating INTEGER CHECK (staff_rating >= 1 AND staff_rating <= 5),
    wait_time_rating INTEGER CHECK (wait_time_rating >= 1 AND wait_time_rating <= 5),
    equipment_rating INTEGER CHECK (equipment_rating >= 1 AND equipment_rating <= 5),
    
    -- Modération
    is_verified BOOLEAN DEFAULT false,
    is_flagged BOOLEAN DEFAULT false,
    admin_response TEXT,
    
    -- Métadonnées
    visit_date DATE,
    service_used TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un utilisateur ne peut noter qu'une fois par hôpital
    UNIQUE(hospital_id, user_id)
);

-- Ajouter la colonne is_verified si elle manque (migration)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'is_verified') THEN
        ALTER TABLE public.ratings ADD COLUMN is_verified BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_ratings_hospital ON public.ratings(hospital_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON public.ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created ON public.ratings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_verified ON public.ratings(is_verified);

-- ==============================================================================
-- 8. TABLE ACTIVITY_LOGS (Audit trail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
    
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_hospital ON public.activity_logs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);

-- ==============================================================================
-- 9. TABLE ANALYTICS (Statistiques agrégées)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    
    -- Métriques quotidiennes
    total_visitors INTEGER DEFAULT 0,
    total_consultations INTEGER DEFAULT 0,
    total_emergencies INTEGER DEFAULT 0,
    avg_wait_time INTEGER DEFAULT 0,
    bed_occupancy_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Revenus (optionnel)
    revenue DECIMAL(12,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(hospital_id, date)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_analytics_hospital_date ON public.analytics(hospital_id, date DESC);

-- ==============================================================================
-- 10. TRIGGERS
-- ==============================================================================

-- Trigger: Créer un profil automatiquement à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur toutes les tables
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_hospitals_updated_at ON public.hospitals;
CREATE TRIGGER update_hospitals_updated_at
    BEFORE UPDATE ON public.hospitals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_hospital_services_updated_at ON public.hospital_services;
CREATE TRIGGER update_hospital_services_updated_at
    BEFORE UPDATE ON public.hospital_services
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger: Recalculer la note moyenne d'un hôpital
CREATE OR REPLACE FUNCTION public.update_hospital_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.hospitals
    SET 
        average_rating = (
            SELECT COALESCE(AVG(rating), 0)::DECIMAL(3,2)
            FROM public.ratings
            WHERE hospital_id = COALESCE(NEW.hospital_id, OLD.hospital_id)
            AND is_verified = true
        ),
        total_ratings = (
            SELECT COUNT(*)
            FROM public.ratings
            WHERE hospital_id = COALESCE(NEW.hospital_id, OLD.hospital_id)
            AND is_verified = true
        )
    WHERE id = COALESCE(NEW.hospital_id, OLD.hospital_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_rating_change ON public.ratings;
CREATE TRIGGER on_rating_change
    AFTER INSERT OR UPDATE OR DELETE ON public.ratings
    FOR EACH ROW EXECUTE FUNCTION public.update_hospital_rating();

-- ==============================================================================
-- 11. FONCTIONS UTILITAIRES
-- ==============================================================================

-- Fonction helper: Créer un point géographique depuis coordonnées JSON
-- Utilisée par le frontend pour insérer la localisation
CREATE OR REPLACE FUNCTION public.create_geography_point(lng DOUBLE PRECISION, lat DOUBLE PRECISION)
RETURNS GEOGRAPHY AS $$
BEGIN
    -- Validation des coordonnées
    IF lat < -90 OR lat > 90 THEN
        RAISE EXCEPTION 'Latitude invalide: % (doit être entre -90 et 90)', lat;
    END IF;
    IF lng < -180 OR lng > 180 THEN
        RAISE EXCEPTION 'Longitude invalide: % (doit être entre -180 et 180)', lng;
    END IF;
    
    -- Créer le point géographique au format WKT (Well-Known Text)
    RETURN ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction: Calculer la distance entre deux points (Haversine)
CREATE OR REPLACE FUNCTION public.calculate_distance(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    r DOUBLE PRECISION := 6371; -- Rayon de la Terre en km
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    
    a := sin(dlat/2) * sin(dlat/2) +
         cos(radians(lat1)) * cos(radians(lat2)) *
         sin(dlon/2) * sin(dlon/2);
    
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    
    RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction: Rechercher hôpitaux par proximité
CREATE OR REPLACE FUNCTION public.search_hospitals_nearby(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
    max_distance_km DOUBLE PRECISION DEFAULT 50,
    service_filter INTEGER DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    address TEXT,
    distance_km DOUBLE PRECISION,
    average_rating DECIMAL,
    total_ratings INTEGER,
    available_services INTEGER,
    emergency_24h BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.name,
        h.address,
        public.calculate_distance(
            user_lat, user_lon,
            ST_Y(h.location::geometry), ST_X(h.location::geometry)
        ) AS distance_km,
        h.average_rating,
        h.total_ratings,
        (
            SELECT COUNT(*)::INTEGER
            FROM public.hospital_services hs
            WHERE hs.hospital_id = h.id AND hs.is_active = true
        ) AS available_services,
        h.emergency_24h
    FROM public.hospitals h
    WHERE 
        h.status = 'approved'
        AND h.location IS NOT NULL
        AND (service_filter IS NULL OR EXISTS (
            SELECT 1 FROM public.hospital_services hs
            WHERE hs.hospital_id = h.id
            AND hs.service_id = service_filter
            AND hs.is_active = true
        ))
    HAVING public.calculate_distance(
        user_lat, user_lon,
        ST_Y(h.location::geometry), ST_X(h.location::geometry)
    ) <= max_distance_km
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- HOSPITALS
DROP POLICY IF EXISTS "Approved hospitals are viewable by everyone" ON public.hospitals;
CREATE POLICY "Approved hospitals are viewable by everyone" ON public.hospitals
    FOR SELECT USING (status = 'approved' OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "Authenticated users can create hospital" ON public.hospitals;
CREATE POLICY "Authenticated users can create hospital" ON public.hospitals
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update own hospital" ON public.hospitals;
CREATE POLICY "Owners can update own hospital" ON public.hospitals
    FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete own hospital" ON public.hospitals;
CREATE POLICY "Owners can delete own hospital" ON public.hospitals
    FOR DELETE USING (auth.uid() = owner_id);

-- HOSPITAL_SERVICES
DROP POLICY IF EXISTS "Active services are viewable by everyone" ON public.hospital_services;
CREATE POLICY "Active services are viewable by everyone" ON public.hospital_services
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.hospitals
            WHERE id = hospital_services.hospital_id
            AND (status = 'approved' OR owner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Hospital owners can manage services" ON public.hospital_services;
CREATE POLICY "Hospital owners can manage services" ON public.hospital_services
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.hospitals
            WHERE id = hospital_services.hospital_id
            AND owner_id = auth.uid()
        )
    );

-- SERVICES
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;
CREATE POLICY "Services are viewable by everyone" ON public.services
    FOR SELECT USING (true);

-- RATINGS
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON public.ratings;
CREATE POLICY "Ratings are viewable by everyone" ON public.ratings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create ratings" ON public.ratings;
CREATE POLICY "Authenticated users can create ratings" ON public.ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own ratings" ON public.ratings;
CREATE POLICY "Users can update own ratings" ON public.ratings
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own ratings" ON public.ratings;
CREATE POLICY "Users can delete own ratings" ON public.ratings
    FOR DELETE USING (auth.uid() = user_id);

-- ACTIVITY_LOGS
DROP POLICY IF EXISTS "Users can view own logs" ON public.activity_logs;
CREATE POLICY "Users can view own logs" ON public.activity_logs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;
CREATE POLICY "System can insert logs" ON public.activity_logs
    FOR INSERT WITH CHECK (true);

-- ANALYTICS
DROP POLICY IF EXISTS "Hospital owners can view own analytics" ON public.analytics;
CREATE POLICY "Hospital owners can view own analytics" ON public.analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.hospitals
            WHERE id = analytics.hospital_id
            AND owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Hospital owners can insert analytics" ON public.analytics;
CREATE POLICY "Hospital owners can insert analytics" ON public.analytics
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hospitals
            WHERE id = analytics.hospital_id
            AND owner_id = auth.uid()
        )
    );

-- ==============================================================================
-- 13. DONNÉES INITIALES (SEED)
-- ==============================================================================

INSERT INTO public.services (name, icon, category, description, color, sort_order) VALUES
('Urgences', 'hospital-fill', 'Urgence', 'Service d''urgences 24h/24', '#ef4444', 1),
('Cardiologie', 'heart-pulse-fill', 'Spécialité', 'Maladies cardiovasculaires', '#f97316', 2),
('Chirurgie Générale', 'scissors', 'Spécialité', 'Interventions chirurgicales', '#3b82f6', 3),
('Pédiatrie', 'emoji-smile-fill', 'Spécialité', 'Soins pour enfants', '#a855f7', 4),
('Gynécologie-Obstétrique', 'person-fill', 'Spécialité', 'Santé de la femme et grossesse', '#ec4899', 5),
('Ophtalmologie', 'eye-fill', 'Spécialité', 'Soins des yeux', '#06b6d4', 6),
('Neurologie', 'brain', 'Spécialité', 'Troubles neurologiques', '#8b5cf6', 7),
('Orthopédie', 'bandaid-fill', 'Spécialité', 'Os et articulations', '#14b8a6', 8),
('Dermatologie', 'moisture', 'Spécialité', 'Maladies de la peau', '#f59e0b', 9),
('Psychiatrie', 'chat-heart-fill', 'Spécialité', 'Santé mentale', '#10b981', 10),
('Radiologie', 'x-ray', 'Diagnostic', 'Imagerie médicale', '#6366f1', 11),
('Laboratoire', 'droplet-fill', 'Diagnostic', 'Analyses médicales', '#ef4444', 12),
('Dentisterie', 'tooth-fill', 'Spécialité', 'Soins dentaires', '#0ea5e9', 13),
('ORL', 'mic-fill', 'Spécialité', 'Oreille, nez, gorge', '#f43f5e', 14),
('Médecine Générale', 'file-medical-fill', 'Général', 'Consultations générales', '#22c55e', 15),
('Réanimation', 'heartbeat', 'Urgence', 'Soins intensifs', '#dc2626', 16),
('Oncologie', 'activity', 'Spécialité', 'Traitement du cancer', '#7c3aed', 17),
('Néphrologie', 'droplet', 'Spécialité', 'Maladies rénales', '#0891b2', 18),
('Pneumologie', 'lungs', 'Spécialité', 'Maladies respiratoires', '#059669', 19),
('Rhumatologie', 'bone', 'Spécialité', 'Maladies articulaires', '#ea580c', 20)
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- 14. VÉRIFICATIONS ET TESTS
-- ==============================================================================

-- Vérifier les tables créées
DO $$
DECLARE
    table_count INTEGER;
    missing_tables TEXT[];
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('profiles', 'hospitals', 'hospital_services', 'services', 'ratings', 'activity_logs', 'analytics');
    
    RAISE NOTICE '✓ Tables créées: % sur 7', table_count;
    
    IF table_count < 7 THEN
        SELECT ARRAY_AGG(t) INTO missing_tables
        FROM (VALUES ('profiles'), ('hospitals'), ('hospital_services'), ('services'), ('ratings'), ('activity_logs'), ('analytics')) AS expected(t)
        WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = expected.t
        );
        RAISE EXCEPTION 'Tables manquantes: %', missing_tables;
    END IF;
END $$;

-- Vérifier les services insérés
DO $$
DECLARE
    service_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO service_count FROM public.services;
    RAISE NOTICE '✓ Services médicaux insérés: %', service_count;
    
    IF service_count < 20 THEN
        RAISE WARNING 'Seulement % services insérés sur 20 attendus', service_count;
    END IF;
END $$;

-- Vérifier les index
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'hospitals', 'hospital_services', 'services', 'ratings');
    
    RAISE NOTICE '✓ Index créés: %', index_count;
END $$;

-- Vérifier les politiques RLS
DO $$
DECLARE
    policy_count INTEGER;
    tables_with_rls INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';
    
    SELECT COUNT(*) INTO tables_with_rls
    FROM pg_tables
    WHERE schemaname = 'public'
    AND rowsecurity = true;
    
    RAISE NOTICE '✓ Politiques RLS créées: %', policy_count;
    RAISE NOTICE '✓ Tables avec RLS activé: % sur 7', tables_with_rls;
    
    IF tables_with_rls < 7 THEN
        RAISE WARNING 'RLS non activé sur toutes les tables!';
    END IF;
END $$;

-- Vérifier les triggers
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_schema = 'public';
    
    RAISE NOTICE '✓ Triggers créés: %', trigger_count;
END $$;

-- Vérifier les fonctions
DO $$
DECLARE
    function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN ('handle_new_user', 'update_updated_at', 'update_hospital_rating', 'calculate_distance', 'search_hospitals_nearby', 'create_geography_point');
    
    RAISE NOTICE '✓ Fonctions créées: % sur 6', function_count;
    
    IF function_count < 6 THEN
        RAISE WARNING 'Toutes les fonctions n''ont pas été créées';
    END IF;
END $$;

-- Test d'insertion géolocalisation (simulation)
DO $$
DECLARE
    test_point GEOGRAPHY;
BEGIN
    -- Test de création d'un point géographique
    test_point := public.create_geography_point(5.3599517, -4.0082563); -- Coordonnées d'Abidjan
    
    IF test_point IS NOT NULL THEN
        RAISE NOTICE '✓ Fonction de géolocalisation fonctionnelle';
        RAISE NOTICE '  Coordonnées test: Abidjan (5.36, -4.01)';
    ELSE
        RAISE EXCEPTION 'La fonction create_geography_point a échoué';
    END IF;
END $$;

-- ==============================================================================
-- FIN DU SCRIPT - RÉSUMÉ
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '  ✅ BASE DE DONNÉES PULSEAI CONFIGURÉE AVEC SUCCÈS!';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PROCHAINES ÉTAPES:';
    RAISE NOTICE '';
    RAISE NOTICE '1️⃣  CRÉER UN COMPTE ADMIN:';
    RAISE NOTICE '   - Allez sur votre interface web (public/index.html)';
    RAISE NOTICE '   - Inscrivez-vous normalement';
    RAISE NOTICE '   - Allez dans Supabase > Table Editor > profiles';
    RAISE NOTICE '   - Changez le role de "hospital_admin" à "admin"';
    RAISE NOTICE '';
    RAISE NOTICE '2️⃣  TESTER L''INSCRIPTION D''UN HÔPITAL:';
    RAISE NOTICE '   - Créez un nouveau compte sur public/index.html';
    RAISE NOTICE '   - Remplissez tous les champs requis';
    RAISE NOTICE '   - Autorisez la géolocalisation';
    RAISE NOTICE '   - Sélectionnez des services médicaux';
    RAISE NOTICE '';
    RAISE NOTICE '3️⃣  VALIDER L''HÔPITAL (avec compte admin):';
    RAISE NOTICE '   - Connectez-vous en tant qu''admin';
    RAISE NOTICE '   - Accédez au panel admin (public/admin.html)';
    RAISE NOTICE '   - Approuvez le nouvel hôpital';
    RAISE NOTICE '';
    RAISE NOTICE '4️⃣  CONFIGURER SUPABASE AUTH:';
    RAISE NOTICE '   - Dashboard Supabase > Authentication > URL Configuration';
    RAISE NOTICE '   - Ajoutez vos URLs de production dans "Redirect URLs"';
    RAISE NOTICE '';
    RAISE NOTICE '5️⃣  DÉPLOYER L''APPLICATION:';
    RAISE NOTICE '   - Suivez le guide DEPLOIEMENT.md';
    RAISE NOTICE '   - Netlify, Vercel ou GitHub Pages recommandés';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '  📊 STATISTIQUES:';
    RAISE NOTICE '     • 7 tables créées';
    RAISE NOTICE '     • 20 services médicaux pré-configurés';
    RAISE NOTICE '     • 6 fonctions utilitaires';
    RAISE NOTICE '     • Row Level Security (RLS) activé';
    RAISE NOTICE '     • Géolocalisation PostGIS configurée';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT:';
    RAISE NOTICE '   - Ne ré-exécutez PAS ce script (il supprime tout)';
    RAISE NOTICE '   - Gardez vos clés Supabase secrètes';
    RAISE NOTICE '   - Testez AVANT de partager aux clients';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Votre base de données est prête pour la production!';
    RAISE NOTICE '';
END $$;
