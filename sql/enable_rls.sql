-- Script d'activation RLS pour PulseAI Dashboard
-- Exécuter ce script dans l'éditeur SQL de Supabase

-- =============================================
-- ÉTAPE A : ACTIVER RLS SUR LES TABLES
-- =============================================

-- Activer RLS sur la table hospitals
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;

-- Activer RLS sur la table hospital_services
ALTER TABLE hospital_services ENABLE ROW LEVEL SECURITY;

-- Activer RLS sur la table ratings
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Note: La table services reste publique (pas de RLS car données statiques)

-- =============================================
-- POLICIES POUR LA TABLE HOSPITALS
-- =============================================

-- Tout le monde peut lire les hôpitaux approuvés
CREATE POLICY "Public can view approved hospitals"
    ON hospitals
    FOR SELECT
    USING (status = 'approved');

-- Les propriétaires peuvent voir leur propre hôpital
CREATE POLICY "Owners can view own hospital"
    ON hospitals
    FOR SELECT
    USING (auth.uid() = owner_id);

-- Les propriétaires peuvent créer leur hôpital
CREATE POLICY "Owners can create own hospital"
    ON hospitals
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Les propriétaires peuvent modifier leur propre hôpital
CREATE POLICY "Owners can update own hospital"
    ON hospitals
    FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Les propriétaires peuvent supprimer leur propre hôpital
CREATE POLICY "Owners can delete own hospital"
    ON hospitals
    FOR DELETE
    USING (auth.uid() = owner_id);

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all hospitals"
    ON hospitals
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Les admins peuvent tout modifier
CREATE POLICY "Admins can update all hospitals"
    ON hospitals
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- =============================================
-- POLICIES POUR LA TABLE HOSPITAL_SERVICES
-- =============================================

-- Tout le monde peut lire les services des hôpitaux approuvés
CREATE POLICY "Public can view services of approved hospitals"
    ON hospital_services
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM hospitals
            WHERE hospitals.id = hospital_services.hospital_id
            AND hospitals.status = 'approved'
        )
    );

-- Les propriétaires peuvent voir les services de leur hôpital
CREATE POLICY "Owners can view own hospital services"
    ON hospital_services
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM hospitals
            WHERE hospitals.id = hospital_services.hospital_id
            AND hospitals.owner_id = auth.uid()
        )
    );

-- Les propriétaires peuvent ajouter des services à leur hôpital
CREATE POLICY "Owners can insert own hospital services"
    ON hospital_services
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM hospitals
            WHERE hospitals.id = hospital_services.hospital_id
            AND hospitals.owner_id = auth.uid()
        )
    );

-- Les propriétaires peuvent supprimer les services de leur hôpital
CREATE POLICY "Owners can delete own hospital services"
    ON hospital_services
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM hospitals
            WHERE hospitals.id = hospital_services.hospital_id
            AND hospitals.owner_id = auth.uid()
        )
    );

-- Les admins peuvent tout gérer
CREATE POLICY "Admins can manage all hospital services"
    ON hospital_services
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- =============================================
-- POLICIES POUR LA TABLE RATINGS
-- =============================================

-- Tout le monde peut lire les notes des hôpitaux approuvés
CREATE POLICY "Public can view ratings of approved hospitals"
    ON ratings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM hospitals
            WHERE hospitals.id = ratings.hospital_id
            AND hospitals.status = 'approved'
        )
    );

-- Les utilisateurs connectés peuvent créer des notes
CREATE POLICY "Authenticated users can create ratings"
    ON ratings
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM hospitals
            WHERE hospitals.id = ratings.hospital_id
            AND hospitals.status = 'approved'
        )
    );

-- Les utilisateurs peuvent modifier leurs propres notes
CREATE POLICY "Users can update own ratings"
    ON ratings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent supprimer leurs propres notes
CREATE POLICY "Users can delete own ratings"
    ON ratings
    FOR DELETE
    USING (auth.uid() = user_id);

-- Les admins peuvent gérer toutes les notes
CREATE POLICY "Admins can manage all ratings"
    ON ratings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- =============================================
-- FONCTIONS HELPER (OPTIONNEL)
-- =============================================

-- Fonction pour vérifier si un utilisateur est admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si un utilisateur possède un hôpital
CREATE OR REPLACE FUNCTION owns_hospital(hospital_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM hospitals
        WHERE id = hospital_id
        AND owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- VÉRIFICATION
-- =============================================

-- Vérifier que RLS est activé
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('hospitals', 'hospital_services', 'ratings', 'services')
ORDER BY tablename;

-- Lister toutes les policies créées
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
