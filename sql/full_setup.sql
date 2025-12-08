-- ==============================================================================
-- SCRIPT D'INSTALLATION COMPLET - PULSEAI DASHBOARD
-- ==============================================================================
-- Ce script combine la création des tables, les fonctions, et la sécurité (RLS).
-- Copiez tout ce contenu et exécutez-le dans l'éditeur SQL de Supabase.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES DE BASE (UTILISATEURS & SYSTÈME)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT true,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLES MÉTIER (HÔPITAUX)
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    description TEXT,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    description TEXT,
    location GEOMETRY(Point, 4326),
    openings JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    average_rating NUMERIC(2,1) DEFAULT 0.0,
    total_ratings INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id),
    UNIQUE(owner_id)
);

CREATE TABLE IF NOT EXISTS hospital_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE NOT NULL,
    is_available BOOLEAN DEFAULT true,
    total_doctors INTEGER DEFAULT 0,
    available_doctors INTEGER DEFAULT 0,
    total_beds INTEGER DEFAULT 0,
    available_beds INTEGER DEFAULT 0,
    queue_length INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(hospital_id, service_id)
);

CREATE TABLE IF NOT EXISTS ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(hospital_id, user_id)
);

-- 4. TRIGGERS & FONCTIONS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON hospitals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hospital_services_updated_at BEFORE UPDATE ON hospital_services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Création automatique de profil
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_profile_for_new_user();

-- 5. SÉCURITÉ (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Policies Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Policies Hospitals
CREATE POLICY "Public can view approved hospitals" ON hospitals FOR SELECT USING (status = 'approved');
CREATE POLICY "Owners can view own hospital" ON hospitals FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners can create own hospital" ON hospitals FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update own hospital" ON hospitals FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Admins can view all hospitals" ON hospitals FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update all hospitals" ON hospitals FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies Hospital Services
CREATE POLICY "Public can view services" ON hospital_services FOR SELECT USING (EXISTS (SELECT 1 FROM hospitals WHERE hospitals.id = hospital_services.hospital_id AND hospitals.status = 'approved'));
CREATE POLICY "Owners can manage services" ON hospital_services FOR ALL USING (EXISTS (SELECT 1 FROM hospitals WHERE hospitals.id = hospital_services.hospital_id AND hospitals.owner_id = auth.uid()));

-- 6. DONNÉES INITIALES (SEED)
INSERT INTO services (name, category) VALUES
('Cardiologie', 'Spécialités'),
('Chirurgie Générale', 'Chirurgie'),
('Urgences', 'Services d''urgence'),
('Pédiatrie', 'Spécialités'),
('Gynécologie', 'Spécialités'),
('Orthopédie', 'Chirurgie'),
('Radiologie', 'Imagerie'),
('Laboratoire', 'Analyses'),
('Maternité', 'Spécialités'),
('Ophtalmologie', 'Spécialités'),
('Neurologie', 'Spécialités'),
('Dentisterie', 'Spécialités'),
('Médecine Générale', 'Général')
ON CONFLICT (name) DO NOTHING;
