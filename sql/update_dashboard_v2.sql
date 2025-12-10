-- ==============================================================================
-- SCRIPT DE MISE À JOUR - DASHBOARD V2
-- ==============================================================================
-- Ce script ajoute les tables et colonnes nécessaires pour la nouvelle version
-- du dashboard (gestion des équipements, détails des services, etc.)
-- ==============================================================================

BEGIN;

-- 1. Amélioration de la table HOSPITAL_SERVICES
-- Ajout de colonnes pour gérer les ressources humaines par service
ALTER TABLE public.hospital_services 
ADD COLUMN IF NOT EXISTS doctor_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_doctors INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS consultation_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS waiting_time_minutes INTEGER DEFAULT 0;

-- 2. Création de la table EQUIPMENTS (Ressources matérielles)
CREATE TABLE IF NOT EXISTS public.hospital_equipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL, -- ex: "Lits Réanimation", "Respirateurs", "Scanner"
    category TEXT, -- ex: "Lits", "Imagerie", "Urgence"
    
    total_quantity INTEGER DEFAULT 0,
    available_quantity INTEGER DEFAULT 0,
    
    status TEXT DEFAULT 'operational', -- operational, maintenance, broken
    last_maintenance DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index et RLS pour EQUIPMENTS
CREATE INDEX IF NOT EXISTS idx_equipments_hospital ON public.hospital_equipments(hospital_id);

ALTER TABLE public.hospital_equipments ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour EQUIPMENTS
DROP POLICY IF EXISTS "Anyone can view hospital equipments" ON public.hospital_equipments;
CREATE POLICY "Anyone can view hospital equipments"
    ON public.hospital_equipments FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Owners can manage hospital equipments" ON public.hospital_equipments;
CREATE POLICY "Owners can manage hospital equipments"
    ON public.hospital_equipments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.hospitals
            WHERE id = hospital_id AND owner_id = auth.uid()
        )
    );

-- 3. Trigger pour updated_at sur EQUIPMENTS
DROP TRIGGER IF EXISTS update_equipments_updated_at ON public.hospital_equipments;
CREATE TRIGGER update_equipments_updated_at
    BEFORE UPDATE ON public.hospital_equipments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Données initiales pour les équipements (Optionnel, pour test)
-- Pas d'insertion automatique ici pour ne pas polluer les vrais hôpitaux

COMMIT;
