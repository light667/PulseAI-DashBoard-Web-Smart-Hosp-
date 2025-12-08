-- ==============================================================================
-- SCRIPT DE DIAGNOSTIC - À EXÉCUTER DANS SUPABASE SQL EDITOR
-- ==============================================================================
-- Copier-coller ce script pour voir l'état actuel de votre base de données

-- 1. Lister toutes les tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Voir la structure de la table hospitals (si elle existe)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'hospitals'
ORDER BY ordinal_position;

-- 3. Compter les hôpitaux existants
SELECT COUNT(*) as total_hospitals FROM public.hospitals;

-- 4. Voir un exemple d'hôpital
SELECT * FROM public.hospitals LIMIT 1;

-- 5. Vérifier les politiques RLS
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'hospitals';

-- 6. Vérifier les services
SELECT COUNT(*) as total_services FROM public.services;
SELECT * FROM public.services LIMIT 5;
