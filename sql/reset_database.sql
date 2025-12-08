-- ==============================================================================
-- SCRIPT DE RÉINITIALISATION COMPLÈTE
-- ==============================================================================
-- ⚠️ ATTENTION : Ce script supprime TOUTES les données existantes !
-- À utiliser uniquement si vous voulez repartir de zéro.

-- 1. Supprimer les triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_rating_added ON public.ratings;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_hospitals_updated_at ON public.hospitals;
DROP TRIGGER IF EXISTS update_hospital_services_updated_at ON public.hospital_services;

-- 2. Supprimer les fonctions
DROP FUNCTION IF EXISTS public.create_profile_for_new_user();
DROP FUNCTION IF EXISTS public.update_hospital_rating();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- 3. Supprimer les tables dans l'ordre inverse des dépendances
DROP TABLE IF EXISTS public.ratings CASCADE;
DROP TABLE IF EXISTS public.hospital_services CASCADE;
DROP TABLE IF EXISTS public.hospitals CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 4. Supprimer les anciennes tables legacy (si elles existent)
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;

-- ==============================================================================
-- Maintenant exécutez le fichier complete_setup.sql
-- ==============================================================================
