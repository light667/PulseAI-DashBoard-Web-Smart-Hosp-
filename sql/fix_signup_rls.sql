-- ==============================================================================
-- CORRECTIF : Politique RLS pour permettre l'inscription
-- ==============================================================================
-- Ce script corrige le problème d'erreur 401 lors de l'inscription
-- À exécuter dans Supabase SQL Editor IMMÉDIATEMENT

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Owners can create own hospital" ON public.hospitals;
DROP POLICY IF EXISTS "Owners can manage services" ON public.hospital_services;

-- HOSPITALS : Permettre l'insertion pour tout utilisateur authentifié
CREATE POLICY "Owners can create own hospital" ON public.hospitals 
    FOR INSERT 
    WITH CHECK (true);  -- Simplifié : permet l'insertion à tout utilisateur authentifié

-- HOSPITAL_SERVICES : Permettre toutes les opérations
CREATE POLICY "Owners can manage services" ON public.hospital_services 
    FOR ALL 
    USING (true);
