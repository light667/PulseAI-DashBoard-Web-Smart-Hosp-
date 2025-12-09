-- ==============================================================================
-- GUIDE D'UTILISATION - BASE DE DONNÉES PULSEAI
-- ==============================================================================
-- Ce fichier contient des requêtes SQL utiles pour gérer votre base de données
-- ==============================================================================

-- ==============================================================================
-- 1. VÉRIFICATIONS DE SANTÉ (HEALTH CHECKS)
-- ==============================================================================

-- Vérifier toutes les tables
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Vérifier le nombre d'enregistrements dans chaque table
SELECT 'profiles' AS table_name, COUNT(*) AS count FROM public.profiles
UNION ALL
SELECT 'hospitals', COUNT(*) FROM public.hospitals
UNION ALL
SELECT 'services', COUNT(*) FROM public.services
UNION ALL
SELECT 'hospital_services', COUNT(*) FROM public.hospital_services
UNION ALL
SELECT 'ratings', COUNT(*) FROM public.ratings
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM public.activity_logs
UNION ALL
SELECT 'analytics', COUNT(*) FROM public.analytics;

-- Vérifier les politiques RLS actives
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

-- ==============================================================================
-- 2. GESTION DES UTILISATEURS
-- ==============================================================================

-- Lister tous les utilisateurs avec leur rôle
SELECT 
    p.email,
    p.full_name,
    p.role,
    p.created_at,
    p.last_login,
    p.is_active
FROM public.profiles p
ORDER BY p.created_at DESC;

-- Promouvoir un utilisateur en administrateur
-- Remplacez 'EMAIL_ICI' par l'email de l'utilisateur
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'EMAIL_ICI';

-- Désactiver un utilisateur
UPDATE public.profiles
SET is_active = false
WHERE email = 'EMAIL_ICI';

-- ==============================================================================
-- 3. GESTION DES HÔPITAUX
-- ==============================================================================

-- Lister tous les hôpitaux avec leur statut
SELECT 
    h.id,
    h.name,
    h.email,
    h.status,
    h.average_rating,
    h.total_ratings,
    h.created_at,
    p.email AS owner_email
FROM public.hospitals h
LEFT JOIN public.profiles p ON h.owner_id = p.user_id
ORDER BY h.created_at DESC;

-- Hôpitaux en attente de validation
SELECT 
    h.id,
    h.name,
    h.email,
    h.phone,
    h.address,
    h.created_at,
    COUNT(hs.id) AS services_count
FROM public.hospitals h
LEFT JOIN public.hospital_services hs ON h.id = hs.hospital_id
WHERE h.status = 'pending'
GROUP BY h.id
ORDER BY h.created_at DESC;

-- Approuver un hôpital
-- Remplacez 'HOSPITAL_ID' par l'UUID de l'hôpital
UPDATE public.hospitals
SET 
    status = 'approved',
    validated_at = NOW(),
    rejection_reason = NULL
WHERE id = 'HOSPITAL_ID';

-- Rejeter un hôpital avec raison
UPDATE public.hospitals
SET 
    status = 'rejected',
    rejection_reason = 'Raison du rejet ici',
    validated_at = NOW()
WHERE id = 'HOSPITAL_ID';

-- Statistiques des hôpitaux par statut
SELECT 
    status,
    COUNT(*) AS total,
    ROUND(AVG(average_rating), 2) AS avg_rating
FROM public.hospitals
GROUP BY status;

-- ==============================================================================
-- 4. GESTION DES SERVICES
-- ==============================================================================

-- Lister tous les services médicaux disponibles
SELECT 
    id,
    name,
    category,
    icon,
    color,
    is_active,
    (SELECT COUNT(*) FROM public.hospital_services WHERE service_id = s.id) AS hospitals_offering
FROM public.services s
ORDER BY category, name;

-- Ajouter un nouveau service médical
INSERT INTO public.services (name, icon, category, description, color, sort_order)
VALUES 
    ('Nouveau Service', 'icon-name', 'Catégorie', 'Description du service', '#000000', 100);

-- Services les plus populaires
SELECT 
    s.name,
    s.category,
    COUNT(hs.id) AS hospitals_count,
    SUM(hs.doctors_total) AS total_doctors
FROM public.services s
LEFT JOIN public.hospital_services hs ON s.id = hs.service_id
WHERE hs.is_active = true
GROUP BY s.id, s.name, s.category
ORDER BY hospitals_count DESC
LIMIT 10;

-- ==============================================================================
-- 5. STATISTIQUES ET ANALYTICS
-- ==============================================================================

-- Vue d'ensemble globale
SELECT 
    (SELECT COUNT(*) FROM public.hospitals WHERE status = 'approved') AS approved_hospitals,
    (SELECT COUNT(*) FROM public.hospitals WHERE status = 'pending') AS pending_hospitals,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'hospital_admin') AS hospital_admins,
    (SELECT COUNT(*) FROM public.services) AS total_services,
    (SELECT SUM(doctors_total) FROM public.hospital_services) AS total_doctors,
    (SELECT SUM(beds_total) FROM public.hospital_services) AS total_beds,
    (SELECT COUNT(*) FROM public.ratings) AS total_ratings;

-- Top 10 hôpitaux les mieux notés
SELECT 
    h.name,
    h.city,
    h.average_rating,
    h.total_ratings,
    COUNT(DISTINCT hs.service_id) AS services_count
FROM public.hospitals h
LEFT JOIN public.hospital_services hs ON h.id = hs.hospital_id
WHERE h.status = 'approved'
GROUP BY h.id
ORDER BY h.average_rating DESC, h.total_ratings DESC
LIMIT 10;

-- Disponibilité en temps réel (agrégé)
SELECT 
    h.name,
    SUM(hs.doctors_available) AS doctors_available,
    SUM(hs.beds_available) AS beds_available,
    SUM(hs.queue_length) AS total_queue
FROM public.hospitals h
JOIN public.hospital_services hs ON h.id = hs.hospital_id
WHERE h.status = 'approved' AND hs.is_active = true
GROUP BY h.id, h.name
ORDER BY doctors_available DESC;

-- ==============================================================================
-- 6. GÉOLOCALISATION
-- ==============================================================================

-- Trouver les hôpitaux proches d'une position
-- Remplacez les coordonnées par votre position
SELECT * FROM public.search_hospitals_nearby(
    5.3599517,  -- Latitude (Abidjan)
    -4.0082563, -- Longitude
    50,         -- Distance max en km
    NULL        -- Service filter (NULL = tous)
);

-- Hôpitaux avec localisation manquante
SELECT 
    id,
    name,
    email,
    address
FROM public.hospitals
WHERE location IS NULL;

-- Ajouter manuellement une localisation à un hôpital
-- Remplacez les valeurs
UPDATE public.hospitals
SET location = public.create_geography_point(
    -4.0082563,  -- Longitude
    5.3599517    -- Latitude
)
WHERE id = 'HOSPITAL_ID';

-- Distance entre deux hôpitaux
SELECT 
    h1.name AS hospital_1,
    h2.name AS hospital_2,
    ROUND(public.calculate_distance(
        ST_Y(h1.location::geometry), ST_X(h1.location::geometry),
        ST_Y(h2.location::geometry), ST_X(h2.location::geometry)
    )::numeric, 2) AS distance_km
FROM public.hospitals h1
CROSS JOIN public.hospitals h2
WHERE h1.id < h2.id
AND h1.location IS NOT NULL
AND h2.location IS NOT NULL
ORDER BY distance_km
LIMIT 10;

-- ==============================================================================
-- 7. NETTOYAGE ET MAINTENANCE
-- ==============================================================================

-- Supprimer les profils sans hôpital associé (orphelins)
-- ATTENTION: Cette requête supprime des données!
DELETE FROM public.profiles
WHERE role = 'hospital_admin'
AND user_id NOT IN (SELECT owner_id FROM public.hospitals);

-- Supprimer les anciens logs (garder 3 mois)
DELETE FROM public.activity_logs
WHERE created_at < NOW() - INTERVAL '3 months';

-- Recalculer la note moyenne d'un hôpital
SELECT public.update_hospital_rating()
FROM public.ratings
WHERE hospital_id = 'HOSPITAL_ID'
LIMIT 1;

-- Réinitialiser les statistiques d'un service
UPDATE public.hospital_services
SET 
    doctors_total = 0,
    doctors_available = 0,
    beds_total = 0,
    beds_available = 0,
    queue_length = 0
WHERE hospital_id = 'HOSPITAL_ID';

-- ==============================================================================
-- 8. DÉPANNAGE
-- ==============================================================================

-- Vérifier les contraintes violées
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
AND contype = 'c'; -- Check constraints

-- Voir les requêtes lentes (nécessite pg_stat_statements)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
WHERE query LIKE '%hospitals%'
ORDER BY mean_time DESC
LIMIT 10;

-- Analyser l'utilisation des index
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ==============================================================================
-- 9. BACKUP SÉLECTIF (Export de données)
-- ==============================================================================

-- Exporter tous les services (pour réimport)
SELECT json_agg(row_to_json(s))
FROM (
    SELECT name, icon, category, description, color, sort_order
    FROM public.services
    ORDER BY sort_order
) s;

-- Exporter la configuration d'un hôpital
SELECT row_to_json(h)
FROM public.hospitals h
WHERE id = 'HOSPITAL_ID';

-- ==============================================================================
-- FIN DU GUIDE
-- ==============================================================================

-- Pour plus d'informations, consultez:
-- - Documentation Supabase: https://supabase.com/docs
-- - Documentation PostGIS: https://postgis.net/docs/
