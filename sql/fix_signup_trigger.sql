-- ==============================================================================
-- SCRIPT DE CORRECTION - ERREUR 500 SIGNUP
-- ==============================================================================
-- Ce script corrige la fonction handle_new_user qui provoquait une erreur
-- lors de la création du compte (problème de conversion du rôle).
-- ==============================================================================

BEGIN;

-- 1. Supprimer le trigger existant pour éviter les conflits
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Remplacer la fonction avec une version plus robuste
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role_val public.user_role;
    user_full_name text;
BEGIN
    -- Récupération sécurisée du nom complet
    user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

    -- Tentative de conversion du rôle avec gestion d'erreur
    BEGIN
        -- On essaie de caster la valeur
        IF (NEW.raw_user_meta_data->>'role') IS NULL THEN
            user_role_val := 'hospital_admin'::public.user_role;
        ELSE
            user_role_val := (NEW.raw_user_meta_data->>'role')::public.user_role;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- En cas d'erreur (valeur invalide), on force le rôle par défaut
        RAISE WARNING 'Rôle invalide détecté: %, utilisation de hospital_admin par défaut', NEW.raw_user_meta_data->>'role';
        user_role_val := 'hospital_admin'::public.user_role;
    END;

    -- Insertion dans la table profiles
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        user_role_val
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recréer le trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. S'assurer que les permissions sont correctes
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

COMMIT;
