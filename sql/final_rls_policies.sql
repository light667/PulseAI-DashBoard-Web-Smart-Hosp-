-- ==============================================================================
-- PULSEAI - POLITIQUES RLS FINALES ET SIMPLIFIÉES
-- ==============================================================================
-- Exécutez ce script dans l'éditeur SQL Supabase pour corriger tous les problèmes RLS

-- ==============================================================================
-- 1. PROFILES - Politiques simplifiées
-- ==============================================================================
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
    FOR UPDATE USING (auth.uid() = user_id);

-- ==============================================================================
-- 2. HOSPITALS - Politiques pour inscription et gestion
-- ==============================================================================
-- Lecture publique des hôpitaux approuvés
DROP POLICY IF EXISTS "Public can view approved hospitals" ON public.hospitals;
CREATE POLICY "Public can view approved hospitals" ON public.hospitals 
    FOR SELECT USING (status = 'approved' OR auth.uid() = owner_id);

-- Insertion : tout utilisateur authentifié peut créer son hôpital
DROP POLICY IF EXISTS "Authenticated users can create hospital" ON public.hospitals;
CREATE POLICY "Authenticated users can create hospital" ON public.hospitals 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Mise à jour : seul le propriétaire
DROP POLICY IF EXISTS "Owners can update own hospital" ON public.hospitals;
CREATE POLICY "Owners can update own hospital" ON public.hospitals 
    FOR UPDATE USING (auth.uid() = owner_id);

-- Suppression : seul le propriétaire
DROP POLICY IF EXISTS "Owners can delete own hospital" ON public.hospitals;
CREATE POLICY "Owners can delete own hospital" ON public.hospitals 
    FOR DELETE USING (auth.uid() = owner_id);

-- ==============================================================================
-- 3. HOSPITAL_SERVICES - Gestion complète des services
-- ==============================================================================
-- Lecture publique des services actifs d'hôpitaux approuvés
DROP POLICY IF EXISTS "Public can view active services" ON public.hospital_services;
CREATE POLICY "Public can view active services" ON public.hospital_services 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.hospitals 
            WHERE id = hospital_services.hospital_id 
            AND (status = 'approved' OR owner_id = auth.uid())
        )
    );

-- Insertion : propriétaires d'hôpitaux authentifiés
DROP POLICY IF EXISTS "Hospital owners can add services" ON public.hospital_services;
CREATE POLICY "Hospital owners can add services" ON public.hospital_services 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hospitals 
            WHERE id = hospital_services.hospital_id 
            AND owner_id = auth.uid()
        )
    );

-- Mise à jour : propriétaires seulement
DROP POLICY IF EXISTS "Hospital owners can update services" ON public.hospital_services;
CREATE POLICY "Hospital owners can update services" ON public.hospital_services 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.hospitals 
            WHERE id = hospital_services.hospital_id 
            AND owner_id = auth.uid()
        )
    );

-- Suppression : propriétaires seulement
DROP POLICY IF EXISTS "Hospital owners can delete services" ON public.hospital_services;
CREATE POLICY "Hospital owners can delete services" ON public.hospital_services 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.hospitals 
            WHERE id = hospital_services.hospital_id 
            AND owner_id = auth.uid()
        )
    );

-- ==============================================================================
-- 4. SERVICES - Lecture publique du catalogue
-- ==============================================================================
DROP POLICY IF EXISTS "Anyone can view services" ON public.services;
CREATE POLICY "Anyone can view services" ON public.services 
    FOR SELECT USING (true);

-- ==============================================================================
-- 5. RATINGS - Système de notation complet
-- ==============================================================================
-- Lecture publique de tous les avis
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
CREATE POLICY "Anyone can view ratings" ON public.ratings 
    FOR SELECT USING (true);

-- Insertion : utilisateurs authentifiés uniquement
DROP POLICY IF EXISTS "Authenticated users can create ratings" ON public.ratings;
CREATE POLICY "Authenticated users can create ratings" ON public.ratings 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Mise à jour : seul l'auteur
DROP POLICY IF EXISTS "Users can update own ratings" ON public.ratings;
CREATE POLICY "Users can update own ratings" ON public.ratings 
    FOR UPDATE USING (auth.uid() = user_id);

-- Suppression : seul l'auteur
DROP POLICY IF EXISTS "Users can delete own ratings" ON public.ratings;
CREATE POLICY "Users can delete own ratings" ON public.ratings 
    FOR DELETE USING (auth.uid() = user_id);

-- ==============================================================================
-- 6. VÉRIFICATION
-- ==============================================================================
-- Vérifier les politiques actives
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- ==============================================================================
-- FIN - Les politiques RLS sont maintenant configurées correctement
-- ==============================================================================
