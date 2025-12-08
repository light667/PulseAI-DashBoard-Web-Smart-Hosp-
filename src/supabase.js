// supabase.js — centralise la config Supabase
import { SUPABASE_CONFIG } from './config.js'

// On utilise la version globale chargée via le script CDN dans le HTML
// Cela évite les problèmes d'import ES Module avec certaines versions de navigateurs/CDN
if (!window.supabase) {
    console.error('CRITICAL: window.supabase is not defined. The CDN script failed to load.');
    alert('Erreur critique : La librairie Supabase ne s\'est pas chargée. Vérifiez votre connexion internet.');
}
const { createClient } = window.supabase || {};

export const supabase = createClient ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey) : null;

// Export par défaut pour compatibilité maximale
export default supabase

console.log('Supabase client initialized via UMD:', supabase);