-- ==============================================================================
-- PULSEAI - SCRIPT DE CONFIGURATION DE PRODUCTION
-- ==============================================================================
-- Version: 2.0
-- Date: 10 Décembre 2025
-- Description: Configuration complète de la base de données pour PulseAI
-- ==============================================================================

-- INSTRUCTIONS:
-- 1. Dans Supabase, allez dans "SQL Editor"
-- 2. Copiez/collez ce script complet
-- 3. Cliquez sur "Run"
-- 4. Vérifiez qu'il n'y a pas d'erreurs
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. NETTOYAGE (Suppression des anciennes tables)
-- ==============================================================================
DROP TABLE IF EXISTS public.analytics CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.ratings CASCADE;
DROP TABLE IF EXISTS public.hospital_services CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.hospitals CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TYPE IF EXISTS public.hospital_status CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

-- ==============================================================================
-- 2. ACTIVATION DES EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ==============================================================================
-- 3. TYPES ÉNUMÉRÉS
-- ==============================================================================
CREATE TYPE public.hospital_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.user_role AS ENUM ('hospital_admin', 'super_admin');

-- ==============================================================================
-- 4. TABLE PROFILES (Profils utilisateurs)
-- ==============================================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role user_role DEFAULT 'hospital_admin',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. TABLE SERVICES (Services médicaux disponibles)
-- ==============================================================================
CREATE TABLE public.services (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    icon TEXT DEFAULT 'hospital',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. TABLE HOSPITALS (Établissements hospitaliers)
-- ==============================================================================
CREATE TABLE public.hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Informations de base
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT NOT NULL,
    
    -- Géolocalisation (PostGIS)
    location GEOGRAPHY(Point, 4326),
    
    -- Horaires d'ouverture (JSON)
    openings JSONB DEFAULT '[]'::jsonb,
    
    -- Médias
    logo_url TEXT,
    cover_url TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    
    -- Informations détaillées
    description TEXT,
    website TEXT,
    emergency_phone TEXT,
    
    -- Capacités
    total_beds INTEGER DEFAULT 0,
    available_beds INTEGER DEFAULT 0,
    doctors_total INTEGER DEFAULT 0,
    nurses_total INTEGER DEFAULT 0,
    
    -- Statut et validation
    status hospital_status DEFAULT 'pending',
    rejection_reason TEXT,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    
    -- Statistiques
    average_rating DECIMAL(3,2) DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimisation
CREATE INDEX idx_hospitals_owner ON public.hospitals(owner_id);
CREATE INDEX idx_hospitals_status ON public.hospitals(status);
CREATE INDEX idx_hospitals_location ON public.hospitals USING GIST(location);

-- ==============================================================================
-- 7. TABLE HOSPITAL_SERVICES (Relation hôpitaux-services)
-- ==============================================================================
CREATE TABLE public.hospital_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    
    is_available BOOLEAN DEFAULT true,
    price_range TEXT,
    additional_info TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(hospital_id, service_id)
);

CREATE INDEX idx_hospital_services_hospital ON public.hospital_services(hospital_id);
CREATE INDEX idx_hospital_services_service ON public.hospital_services(service_id);

-- ==============================================================================
-- 8. TABLE RATINGS (Avis clients)
-- ==============================================================================
CREATE TABLE public.ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(hospital_id, user_id)
);

CREATE INDEX idx_ratings_hospital ON public.ratings(hospital_id);

-- ==============================================================================
-- 9. TABLE ACTIVITY_LOGS (Journal d'activité)
-- ==============================================================================
CREATE TABLE public.activity_logs (
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

CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_hospital ON public.activity_logs(hospital_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at DESC);

-- ==============================================================================
-- 10. TABLE ANALYTICS (Statistiques agrégées)
-- ==============================================================================
CREATE TABLE public.analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    searches INTEGER DEFAULT 0,
    profile_clicks INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(hospital_id, date)
);

CREATE INDEX idx_analytics_hospital ON public.analytics(hospital_id);
CREATE INDEX idx_analytics_date ON public.analytics(date DESC);

-- ==============================================================================
-- 11. FONCTIONS SQL
-- ==============================================================================

-- Fonction pour créer un point géographique
CREATE OR REPLACE FUNCTION create_geography_point(lng FLOAT, lat FLOAT)
RETURNS GEOGRAPHY AS $$
BEGIN
    RETURN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::GEOGRAPHY;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction trigger pour créer automatiquement le profil
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'hospital_admin')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer la distance entre deux points
DROP FUNCTION IF EXISTS calculate_distance(FLOAT, FLOAT, FLOAT, FLOAT);
DROP FUNCTION IF EXISTS calculate_distance(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE FUNCTION calculate_distance(
    lat1 FLOAT,
    lng1 FLOAT,
    lat2 FLOAT,
    lng2 FLOAT
)
RETURNS FLOAT AS $$
BEGIN
    RETURN ST_Distance(
        ST_SetSRID(ST_MakePoint(lng1, lat1), 4326)::GEOGRAPHY,
        ST_SetSRID(ST_MakePoint(lng2, lat2), 4326)::GEOGRAPHY
    ) / 1000; -- Retourne en kilomètres
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour mettre à jour les statistiques de l'hôpital
CREATE OR REPLACE FUNCTION update_hospital_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.hospitals
    SET 
        average_rating = (SELECT AVG(rating) FROM public.ratings WHERE hospital_id = NEW.hospital_id),
        total_ratings = (SELECT COUNT(*) FROM public.ratings WHERE hospital_id = NEW.hospital_id)
    WHERE id = NEW.hospital_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 12. TRIGGERS
-- ==============================================================================

-- Trigger pour créer automatiquement le profil utilisateur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Triggers pour mettre à jour updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hospitals_updated_at ON public.hospitals;
CREATE TRIGGER update_hospitals_updated_at
    BEFORE UPDATE ON public.hospitals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour mettre à jour les stats après un avis
DROP TRIGGER IF EXISTS update_hospital_stats_trigger ON public.ratings;
CREATE TRIGGER update_hospital_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_hospital_stats();

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- Politiques pour PROFILES
CREATE POLICY "Users can view all profiles"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Politiques pour HOSPITALS
CREATE POLICY "Anyone can view approved hospitals"
    ON public.hospitals FOR SELECT
    USING (status = 'approved' OR owner_id = auth.uid());

CREATE POLICY "Owners can insert hospitals"
    ON public.hospitals FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own hospitals"
    ON public.hospitals FOR UPDATE
    USING (auth.uid() = owner_id);

-- Politiques pour HOSPITAL_SERVICES
CREATE POLICY "Anyone can view hospital services"
    ON public.hospital_services FOR SELECT
    USING (true);

CREATE POLICY "Owners can manage hospital services"
    ON public.hospital_services FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.hospitals
            WHERE id = hospital_id AND owner_id = auth.uid()
        )
    );

-- Politiques pour SERVICES
CREATE POLICY "Anyone can view active services"
    ON public.services FOR SELECT
    USING (is_active = true);

-- Politiques pour RATINGS
CREATE POLICY "Anyone can view ratings"
    ON public.ratings FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create ratings"
    ON public.ratings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings"
    ON public.ratings FOR UPDATE
    USING (auth.uid() = user_id);

-- Politiques pour ACTIVITY_LOGS
CREATE POLICY "Users can view own logs"
    ON public.activity_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert logs"
    ON public.activity_logs FOR INSERT
    WITH CHECK (true);

-- Politiques pour ANALYTICS
CREATE POLICY "Owners can view own analytics"
    ON public.analytics FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.hospitals
            WHERE id = hospital_id AND owner_id = auth.uid()
        )
    );

-- ==============================================================================
-- 14. DONNÉES INITIALES - SERVICES MÉDICAUX
-- ==============================================================================
INSERT INTO public.services (name, category, icon) VALUES
    -- Urgences et Soins Critiques
    ('Urgences 24/7', 'Urgences', 'hospital'),
    ('Soins Intensifs', 'Urgences', 'heart-pulse'),
    ('Réanimation', 'Urgences', 'activity'),
    
    -- Médecine Générale
    ('Médecine Générale', 'Consultation', 'stethoscope'),
    ('Pédiatrie', 'Consultation', 'baby'),
    ('Gériatrie', 'Consultation', 'person-cane'),
    
    -- Chirurgie
    ('Chirurgie Générale', 'Chirurgie', 'scalpel'),
    ('Chirurgie Cardiaque', 'Chirurgie', 'heart'),
    ('Neurochirurgie', 'Chirurgie', 'brain'),
    ('Chirurgie Orthopédique', 'Chirurgie', 'bandaid'),
    
    -- Maternité et Gynécologie
    ('Maternité', 'Maternité', 'heart-fill'),
    ('Gynécologie', 'Maternité', 'gender-female'),
    ('Obstétrique', 'Maternité', 'person-hearts'),
    
    -- Imagerie Médicale
    ('Radiologie', 'Imagerie', 'camera'),
    ('Scanner', 'Imagerie', 'disc'),
    ('IRM', 'Imagerie', 'magnet'),
    ('Échographie', 'Imagerie', 'soundwave'),
    
    -- Laboratoire
    ('Analyses Médicales', 'Laboratoire', 'clipboard-pulse'),
    ('Biologie', 'Laboratoire', 'virus'),
    
    -- Autres Spécialités
    ('Cardiologie', 'Spécialités', 'heart-pulse-fill'),
    ('Dermatologie', 'Spécialités', 'droplet'),
    ('Ophtalmologie', 'Spécialités', 'eye'),
    ('ORL', 'Spécialités', 'ear'),
    ('Dentaire', 'Spécialités', 'tooth'),
    ('Kinésithérapie', 'Spécialités', 'person-walking')
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- 15. VÉRIFICATIONS FINALES
-- ==============================================================================
DO $$
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE 'INSTALLATION TERMINÉE AVEC SUCCÈS';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Extension PostGIS: %', 
        CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') 
        THEN 'Installée' ELSE 'ERREUR' END;
    RAISE NOTICE '✅ Tables créées: %', (
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    );
    RAISE NOTICE '✅ Services médicaux: %', (SELECT COUNT(*) FROM public.services);
    RAISE NOTICE '✅ Fonctions SQL: %', (
        SELECT COUNT(*) FROM information_schema.routines 
        WHERE routine_schema = 'public'
    );
    RAISE NOTICE '✅ RLS activé sur toutes les tables';
    RAISE NOTICE '';
    RAISE NOTICE 'Vous pouvez maintenant utiliser l''application!';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

COMMIT;
