-- Politiques de sécurité Row Level Security (RLS)
-- À exécuter après init.sql

-- Activer RLS sur toutes les tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ====================================
-- POLICIES POUR LA TABLE PROFILES
-- ====================================

-- Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view own profile"
    ON profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Les admins peuvent voir tous les profils
CREATE POLICY "Admins can view all profiles"
    ON profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Les utilisateurs peuvent mettre à jour leur propre profil
CREATE POLICY "Users can update own profile"
    ON profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Les admins peuvent mettre à jour tous les profils
CREATE POLICY "Admins can update all profiles"
    ON profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Les admins peuvent supprimer des profils
CREATE POLICY "Admins can delete profiles"
    ON profiles
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Insertion automatique via trigger
CREATE POLICY "Service role can insert profiles"
    ON profiles
    FOR INSERT
    WITH CHECK (true);

-- ====================================
-- POLICIES POUR LA TABLE SESSIONS
-- ====================================

-- Les utilisateurs peuvent voir leurs propres sessions
CREATE POLICY "Users can view own sessions"
    ON sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Les admins peuvent voir toutes les sessions
CREATE POLICY "Admins can view all sessions"
    ON sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Les utilisateurs peuvent créer leurs propres sessions
CREATE POLICY "Users can create own sessions"
    ON sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent supprimer leurs propres sessions
CREATE POLICY "Users can delete own sessions"
    ON sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- ====================================
-- POLICIES POUR LA TABLE ACTIVITY_LOGS
-- ====================================

-- Les utilisateurs peuvent voir leurs propres logs
CREATE POLICY "Users can view own activity logs"
    ON activity_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Les admins peuvent voir tous les logs
CREATE POLICY "Admins can view all activity logs"
    ON activity_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Tout le monde peut créer des logs (via fonction sécurisée)
CREATE POLICY "Anyone can insert activity logs"
    ON activity_logs
    FOR INSERT
    WITH CHECK (true);

-- Seuls les admins peuvent supprimer les logs
CREATE POLICY "Admins can delete activity logs"
    ON activity_logs
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- ====================================
-- POLICIES POUR LA TABLE SETTINGS
-- ====================================

-- Tout le monde peut lire les paramètres
CREATE POLICY "Anyone can view settings"
    ON settings
    FOR SELECT
    USING (true);

-- Seuls les admins peuvent modifier les paramètres
CREATE POLICY "Admins can update settings"
    ON settings
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Seuls les admins peuvent créer des paramètres
CREATE POLICY "Admins can insert settings"
    ON settings
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Seuls les admins peuvent supprimer des paramètres
CREATE POLICY "Admins can delete settings"
    ON settings
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- ====================================
-- FONCTIONS HELPER POUR RLS
-- ====================================

-- Vérifier si l'utilisateur est admin
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

-- Vérifier si l'utilisateur a accès à un profil
CREATE OR REPLACE FUNCTION can_access_profile(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.uid() = p_user_id OR is_admin()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- GRANTS
-- ====================================

-- Donner les permissions nécessaires
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Note: Ajuster les permissions selon vos besoins de sécurité
