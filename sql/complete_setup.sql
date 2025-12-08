-- ==============================================================================
-- PULSEAI - SCRIPT SQL COMPLET
-- ==============================================================================
-- À exécuter dans l'éditeur SQL de Supabase (copier-coller tout le contenu)

-- 1. EXTENSIONS NÉCESSAIRES
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABLE PROFILES (Profils utilisateurs connectés)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'hospital_admin', -- 'hospital_admin' | 'admin' | 'user'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ==============================================================================
-- 3. TABLE SERVICES (Catalogue des services médicaux)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.services (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    icon TEXT, -- Optionnel : nom d'icône Bootstrap
    category TEXT, -- Ex: "Urgence", "Spécialité", etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 4. TABLE HOSPITALS (Informations des hôpitaux)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Informations de base
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    description TEXT,
    
    -- Géolocalisation (PostGIS Point)
    location GEOGRAPHY(Point, 4326),
    
    -- Horaires d'ouverture (JSON array)
    -- Format: [{"day": "Lundi", "range": "08:00-16:00"}, ...]
    openings JSONB DEFAULT '[]'::jsonb,
    
    -- Statut de validation
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    
    -- Note moyenne (calculée automatiquement)
    average_rating DECIMAL(2,1) DEFAULT 0.0,
    total_ratings INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(owner_id)
);

-- ==============================================================================
-- 5. TABLE HOSPITAL_SERVICES (Relation Hôpital ↔ Services + Stats temps réel)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.hospital_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES public.services(id) ON DELETE CASCADE,
    
    -- Disponibilité du service
    is_active BOOLEAN DEFAULT true,
    
    -- STATS TEMPS RÉEL (mis à jour par le dashboard)
    doctors_total INTEGER DEFAULT 0,
    doctors_available INTEGER DEFAULT 0,
    beds_total INTEGER DEFAULT 0,
    beds_available INTEGER DEFAULT 0,
    queue_length INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(hospital_id, service_id)
);

-- ==============================================================================
-- 6. TABLE RATINGS (Notes des utilisateurs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(hospital_id, user_id) -- Un utilisateur = 1 note par hôpital
);

-- ==============================================================================
-- 7. TRIGGERS : Mise à jour automatique de `updated_at`
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hospitals_updated_at ON public.hospitals;
CREATE TRIGGER update_hospitals_updated_at 
    BEFORE UPDATE ON public.hospitals 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hospital_services_updated_at ON public.hospital_services;
CREATE TRIGGER update_hospital_services_updated_at 
    BEFORE UPDATE ON public.hospital_services 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 8. TRIGGER : Création automatique du profil lors de l'inscription
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name, role)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'hospital_admin')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_new_user();

-- ==============================================================================
-- 9. TRIGGER : Mettre à jour la note moyenne d'un hôpital après un rating
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_hospital_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.hospitals
    SET 
        average_rating = (
            SELECT ROUND(AVG(rating)::numeric, 1)
            FROM public.ratings
            WHERE hospital_id = NEW.hospital_id
        ),
        total_ratings = (
            SELECT COUNT(*)
            FROM public.ratings
            WHERE hospital_id = NEW.hospital_id
        )
    WHERE id = NEW.hospital_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_rating_added ON public.ratings;
CREATE TRIGGER on_rating_added
    AFTER INSERT OR UPDATE ON public.ratings
    FOR EACH ROW EXECUTE FUNCTION public.update_hospital_rating();

-- ==============================================================================
-- 10. SÉCURITÉ (RLS - Row Level Security)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- PROFILES : Chacun peut voir son profil
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
    FOR UPDATE USING (auth.uid() = user_id);

-- HOSPITALS : Lecture publique des hôpitaux approuvés, modification par le propriétaire
DROP POLICY IF EXISTS "Public can view approved hospitals" ON public.hospitals;
CREATE POLICY "Public can view approved hospitals" ON public.hospitals 
    FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS "Owners can view own hospital" ON public.hospitals;
CREATE POLICY "Owners can view own hospital" ON public.hospitals 
    FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can create own hospital" ON public.hospitals;
CREATE POLICY "Owners can create own hospital" ON public.hospitals 
    FOR INSERT WITH CHECK (true);  -- Permet l'insertion pour tout utilisateur authentifié

DROP POLICY IF EXISTS "Owners can update own hospital" ON public.hospitals;
CREATE POLICY "Owners can update own hospital" ON public.hospitals 
    FOR UPDATE USING (auth.uid() = owner_id);

-- HOSPITAL_SERVICES : Propriétaire peut gérer ses services
DROP POLICY IF EXISTS "Public can view active services" ON public.hospital_services;
CREATE POLICY "Public can view active services" ON public.hospital_services 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.hospitals 
            WHERE id = hospital_services.hospital_id 
            AND status = 'approved'
        )
    );

DROP POLICY IF EXISTS "Owners can manage services" ON public.hospital_services;
CREATE POLICY "Owners can manage services" ON public.hospital_services 
    FOR ALL USING (true);  -- Permet toutes les opérations pour les utilisateurs authentifiés

-- SERVICES : Lecture publique
DROP POLICY IF EXISTS "Anyone can view services" ON public.services;
CREATE POLICY "Anyone can view services" ON public.services 
    FOR SELECT USING (true);

-- RATINGS : Tout le monde peut lire, seul l'auteur peut modifier
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
CREATE POLICY "Anyone can view ratings" ON public.ratings 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create ratings" ON public.ratings;
CREATE POLICY "Users can create ratings" ON public.ratings 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own ratings" ON public.ratings;
CREATE POLICY "Users can update own ratings" ON public.ratings 
    FOR UPDATE USING (auth.uid() = user_id);

-- ==============================================================================
-- 11. SEED : Insérer les services médicaux de base
-- ==============================================================================
INSERT INTO public.services (name, icon, category) VALUES
('Urgences', 'hospital-fill', 'Urgence'),
('Cardiologie', 'heart-pulse-fill', 'Spécialité'),
('Chirurgie Générale', 'scissors', 'Spécialité'),
('Pédiatrie', 'emoji-smile-fill', 'Spécialité'),
('Gynécologie & Obstétrique', 'person-fill', 'Spécialité'),
('Ophtalmologie', 'eye-fill', 'Spécialité'),
('Neurologie', 'brain', 'Spécialité'),
('Orthopédie', 'bandaid-fill', 'Spécialité'),
('Dermatologie', 'moisture', 'Spécialité'),
('Psychiatrie', 'chat-heart-fill', 'Spécialité'),
('Radiologie', 'x-ray', 'Diagnostic'),
('Laboratoire d''analyses', 'droplet-fill', 'Diagnostic'),
('Dentisterie', 'tooth-fill', 'Spécialité'),
('ORL', 'mic-fill', 'Spécialité'),
('Médecine Générale', 'file-medical-fill', 'Général')
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- FIN DU SCRIPT
-- ==============================================================================
-- Après l'exécution, vous pouvez vérifier :
-- SELECT * FROM services;
-- SELECT * FROM hospitals;
