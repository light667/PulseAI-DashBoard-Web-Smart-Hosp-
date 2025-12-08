# 🚀 PulseAI - Dashboard Hospitalier

Plateforme web de gestion et découverte d'hôpitaux partenaires en Afrique.

## 📋 Fonctionnalités

### Pour les Hôpitaux
- ✅ Inscription et création de profil complet
- ✅ Gestion des services médicaux proposés
- ✅ Mise à jour en temps réel des statistiques (médecins, lits, files d'attente)
- ✅ Système d'horaires d'ouverture personnalisables
- ✅ Géolocalisation automatique (PostGIS)
- ✅ Dashboard de gestion avec graphiques
- ✅ Profil public avec informations détaillées

### Pour les Utilisateurs
- ✅ Liste publique des hôpitaux approuvés
- ✅ Recherche par nom ou adresse
- ✅ Filtrage par service médical (Urgences, Pédiatrie, etc.)
- ✅ Calcul de distance depuis position actuelle (Haversine)
- ✅ Affichage des disponibilités en temps réel
- ✅ Consultation des horaires d'ouverture
- 🚧 Système de notation avec commentaires (en cours)

### Pour les Administrateurs
- ✅ Validation des nouveaux hôpitaux (pending → approved/rejected)
- ✅ Gestion centralisée de tous les établissements
- ✅ Statistiques globales du système
- ✅ Contrôle qualité des profils

## 🛠️ Technologies

- **Frontend**: HTML5, CSS3 (Bootstrap 5), JavaScript ES6+
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Géolocalisation**: PostGIS extension
- **Déploiement**: Netlify (CI/CD automatique)
- **Sécurité**: Row Level Security (RLS), HTTPS, CSP headers

## 📦 Structure du Projet

```
DASHBOARD WEB PULSEAI/
├── public/
│   ├── index.html          # Page d'accueil / Login / Inscription
│   ├── dashboard.html      # Dashboard hôpital partenaire
│   ├── admin.html          # Panneau admin (validation)
│   ├── profile.html        # Profil et paramètres hôpital
│   ├── hospitals.html      # Liste publique des hôpitaux
│   ├── test.html           # Page de test connexion Supabase
│   ├── install.html        # Guide d'installation DB
│   ├── styles.css          # Styles globaux avec design system
│   └── _redirects          # Configuration redirections Netlify
├── src/
│   ├── supabase.js         # Client Supabase initialisé
│   ├── config.js           # Configuration (URL, clés - gitignored)
│   ├── auth.js             # Authentification et inscription
│   ├── dashboard.js        # Logique dashboard hôpital
│   ├── admin_panel.js      # Logique panneau admin
│   ├── profile.js          # Gestion profil hôpital
│   └── hospitals_public.js # Liste publique avec géolocalisation
├── sql/
│   ├── complete_setup.sql      # Script SQL complet (tables + triggers)
│   ├── final_rls_policies.sql  # Politiques RLS corrigées (FINAL)
│   ├── fix_signup_rls.sql      # Correctif inscription urgente
│   └── diagnostic.sql          # Diagnostic et vérifications
├── netlify.toml            # Configuration build Netlify
└── README.md               # Ce fichier
```

## 🚀 Déploiement sur Netlify

### Prérequis
1. Compte [Netlify](https://netlify.com) (gratuit)
2. Compte [Supabase](https://supabase.com) avec projet créé
3. Repository Git (GitHub, GitLab, Bitbucket)

### Étapes de Déploiement

#### 1️⃣ Configuration Supabase

**a) Créer les tables**
```bash
# Dans Supabase SQL Editor, exécutez dans l'ordre :
1. sql/complete_setup.sql          # Tables, triggers, fonctions
2. sql/final_rls_policies.sql      # Politiques RLS (VERSION FINALE)
```

**b) Activer PostGIS**
```sql
-- Dans SQL Editor
CREATE EXTENSION IF NOT EXISTS postgis;
```

**c) Créer le premier admin**
```sql
-- Après inscription d'un utilisateur, dans SQL Editor :
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'votre-email@example.com';
```

#### 2️⃣ Configuration du Projet

**Créer `src/config.js`** (fichier ignoré par Git) :
```javascript
export const SUPABASE_CONFIG = {
    url: 'https://votre-projet.supabase.co',
    anonKey: 'votre-cle-publique-anon-key-ici'
};
```

> 🔑 Trouvez vos clés : Supabase Dashboard → Settings → API

#### 3️⃣ Déploiement Netlify

**Option A - Via GitHub (Recommandé)**
```bash
# 1. Créer repo GitHub
git init
git add .
git commit -m "🚀 Initial commit - PulseAI Dashboard"
git branch -M main
git remote add origin https://github.com/votre-username/pulseai-dashboard.git
git push -u origin main
```

```bash
# 2. Dans Netlify Dashboard
- Cliquer "New site from Git"
- Connecter GitHub
- Sélectionner le repo
- Build settings :
  * Build command: echo "Static site - no build needed"
  * Publish directory: public
  * Auto-deploy: ✅ Activé
- Cliquer "Deploy site"
```

**Option B - Via Netlify CLI**
```bash
# Installation
npm install -g netlify-cli

# Connexion
netlify login

# Initialisation
netlify init

# Déploiement
netlify deploy --prod --dir=public
```

#### 4️⃣ Configuration Post-Déploiement

**a) Variables d'environnement (optionnel)**
```bash
# Netlify Dashboard → Site settings → Environment variables
# Ajouter (si vous voulez externaliser la config) :
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre-anon-key
```

**b) Domaine personnalisé (optionnel)**
```bash
# Netlify Dashboard → Domain settings
# Ajouter domaine : pulseai.votredomaine.com
```

**c) HTTPS et sécurité**
- ✅ HTTPS automatique (Let's Encrypt)
- ✅ Headers de sécurité (définis dans netlify.toml)
- ✅ Force HTTPS activé dans _redirects

## 📱 Utilisation

### Pour les Hôpitaux Partenaires

**1. Inscription**
1. Visitez `/` ou `/index.html`
2. Cliquez sur "Inscription"
3. Remplissez les 4 étapes :
   - Compte (email, mot de passe)
   - Informations hôpital (nom, adresse, téléphone)
   - Localisation (coordonnées GPS)
   - Services proposés (sélection multiple)
4. Attendez la validation par un admin

**2. Gestion du Dashboard**
1. Connectez-vous avec votre email/mot de passe
2. Accédez au dashboard (`/dashboard.html`)
3. Gérez vos services :
   - Nombre de médecins disponibles
   - Nombre de lits disponibles
   - Temps d'attente estimé
4. Mettez à jour votre profil (`/profile.html`)

### Pour les Administrateurs

**1. Accès Admin**
1. Connectez-vous avec un compte admin
2. Accédez à `/admin.html`

**2. Validation des Hôpitaux**
1. Consultez l'onglet "En attente"
2. Vérifiez les informations
3. Approuvez (✅) ou Rejetez (❌)

### Pour les Utilisateurs Publics

**Trouver un Hôpital**
1. Visitez `/hospitals.html` (accessible sans connexion)
2. Recherchez par nom ou adresse
3. Filtrez par service médical
4. Cliquez "Localiser" pour trier par distance
5. Consultez les détails (horaires, disponibilités)

## 🔐 Sécurité

### Politiques RLS Appliquées

**Profiles** - `profiles`
- ✅ Lecture : Tous les utilisateurs authentifiés
- ✅ Insertion : Lors de l'inscription uniquement
- ✅ Mise à jour : Propriétaire ou admin

**Hôpitaux** - `hospitals`
- ✅ Lecture publique : Seulement les hôpitaux approuvés (`status = 'approved'`)
- ✅ Lecture propriétaire : Tous les statuts pour le propriétaire
- ✅ Insertion : Utilisateurs authentifiés uniquement
- ✅ Mise à jour : Propriétaire uniquement
- ✅ Suppression : Propriétaire uniquement

**Services** - `hospital_services`
- ✅ Lecture : Utilisateurs authentifiés
- ✅ Insertion/Mise à jour/Suppression : Propriétaire de l'hôpital

**Ratings** - `ratings`
- ✅ Lecture : Utilisateurs authentifiés
- ✅ Insertion : Utilisateurs authentifiés (1 note par utilisateur/hôpital)
- ✅ Mise à jour : Auteur uniquement

### Mesures de Sécurité Additionnelles
- ✅ Headers de sécurité HTTP (CSP, X-Frame-Options, etc.)
- ✅ HTTPS forcé sur production
- ✅ Validation côté serveur (triggers PostgreSQL)
- ✅ Mots de passe hashés (Supabase Auth)
- ✅ Protection CSRF automatique

## 🐛 Dépannage

### ❌ Erreur "Failed to fetch" ou connexion échoue
**Cause**: Tables non créées ou clés Supabase incorrectes
```bash
# Solution :
1. Vérifier src/config.js (URL et clé correctes)
2. Exécuter sql/complete_setup.sql dans Supabase
3. Tester avec /test.html
```

### ❌ Erreur 401 "Row Level Security policy violation"
**Cause**: Politiques RLS trop restrictives
```bash
# Solution :
# Exécuter dans Supabase SQL Editor :
sql/final_rls_policies.sql  # Version corrigée
```

### ❌ Erreur 406 lors du chargement du dashboard
**Cause**: Aucun hôpital trouvé pour l'utilisateur
```bash
# Solution :
# Vérifier dans Supabase Table Editor → hospitals
# S'assurer que owner_id correspond à l'user ID
```

### ❌ "new row violates row-level security policy for table 'hospitals'"
**Cause**: Politiques INSERT trop restrictives lors de l'inscription
```bash
# Solution rapide (correctif d'urgence) :
sql/fix_signup_rls.sql

# Solution complète :
sql/final_rls_policies.sql
```

### ✅ Page de Test
Visitez `/test.html` pour diagnostiquer :
- Connexion Supabase
- Chargement des services
- Accès aux tables
- Console JavaScript pour erreurs détaillées

## 📊 Base de Données

### Schéma

**`profiles`**
```sql
id UUID (FK → auth.users.id)
email TEXT UNIQUE
role TEXT (user, hospital_admin, admin)
created_at TIMESTAMP
```

**`hospitals`**
```sql
id UUID PRIMARY KEY
owner_id UUID (FK → profiles.id)
name TEXT
address TEXT
phone TEXT
location GEOGRAPHY(Point, 4326)  -- PostGIS
description TEXT
openings JSONB  -- {"monday": {"open": "08:00", "close": "18:00"}, ...}
status TEXT (pending, approved, rejected)
average_rating DECIMAL
total_reviews INTEGER
created_at TIMESTAMP
```

**`services`**
```sql
id UUID PRIMARY KEY
name TEXT UNIQUE
icon TEXT
description TEXT
```

**`hospital_services`**
```sql
id UUID PRIMARY KEY
hospital_id UUID (FK → hospitals.id)
service_id UUID (FK → services.id)
available_doctors INTEGER DEFAULT 0
available_beds INTEGER DEFAULT 0
wait_time_minutes INTEGER DEFAULT 0
last_updated TIMESTAMP
```

**`ratings`**
```sql
id UUID PRIMARY KEY
hospital_id UUID (FK → hospitals.id)
user_id UUID (FK → profiles.id)
rating INTEGER (1-5)
comment TEXT
created_at TIMESTAMP
UNIQUE(hospital_id, user_id)  -- 1 note par utilisateur
```

### Triggers Automatiques

**`update_hospital_rating_on_insert`** - Recalcul moyenne après notation
```sql
-- Déclenché sur INSERT/UPDATE/DELETE dans ratings
-- Met à jour average_rating et total_reviews dans hospitals
```

**`update_service_timestamp`** - Horodatage automatique
```sql
-- Déclenché sur UPDATE dans hospital_services
-- Met à jour last_updated automatiquement
```

## 🎨 Design System

### Variables CSS Personnalisées

```css
:root {
    --pulse-primary: #0d6efd;
    --pulse-secondary: #6366f1;
    --pulse-success: #10b981;
    --pulse-warning: #f59e0b;
    --pulse-danger: #ef4444;
    --pulse-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --pulse-gradient-success: linear-gradient(135deg, #10b981 0%, #059669 100%);
    --pulse-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}
```

### Animations Disponibles

**`fade-in`** - Apparition douce
```css
animation: fade-in 0.6s ease-out;
```

**`slide-in-left`** - Glissement depuis la gauche
```css
animation: slide-in-left 0.5s ease-out;
```

**`pulse`** - Pulsation continue
```css
animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
```

**`shimmer`** - Effet de brillance
```css
animation: shimmer 2s linear infinite;
```

### Composants Prêts à l'Emploi

- `.stat-card` - Carte statistique avec icône
- `.gradient-badge` - Badge avec dégradé
- `.modern-card` - Carte moderne avec hover
- `.hero-section` - Section héroïque avec overlay
- `.auth-card` - Carte d'authentification glassmorphism

## 🔄 Mises à Jour Futures

### TODO - Fonctionnalités Planifiées
- [ ] **Système de notation complet**
  - Interface utilisateur pour noter
  - Affichage des avis sur profils
  - Modération des commentaires
  
- [ ] **Page détails hôpital**
  - Modal ou page dédiée
  - Galerie photos
  - Avis détaillés
  
- [ ] **Recherche avancée**
  - Filtrage par rayon (10km, 50km, 100km)
  - Filtrage par horaires d'ouverture
  - Tri par disponibilité
  
- [ ] **Notifications**
  - Notifications push pour admins (nouveaux hôpitaux)
  - Emails de confirmation inscription
  - Alertes disponibilité services
  
- [ ] **Analytics**
  - Export PDF des statistiques
  - Graphiques temps réel
  - Rapport mensuel automatique
  
- [ ] **Mode sombre**
  - Toggle light/dark
  - Préférence sauvegardée
  
- [ ] **PWA (Progressive Web App)**
  - Service Worker
  - Installation sur mobile
  - Mode offline

### TODO - Technique
- [ ] Tests unitaires (Jest)
- [ ] Tests E2E (Playwright)
- [ ] CI/CD GitHub Actions
- [ ] Compression images
- [ ] Lazy loading
- [ ] Code splitting

## 👥 Contribution

Ce projet est développé pour améliorer l'accès aux soins de santé en Afrique avec ❤️.

### Comment Contribuer
1. Fork le projet
2. Créer une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

## 📄 Licence

MIT License - Utilisation libre pour projets éducatifs et commerciaux.

Copyright (c) 2024 PulseAI

## 🔗 Liens Utiles

- [Documentation Supabase](https://supabase.com/docs)
- [Bootstrap 5 Docs](https://getbootstrap.com/docs/5.3/)
- [Netlify Docs](https://docs.netlify.com/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [MDN Web Docs](https://developer.mozilla.org/)

## 📞 Support

Pour toute question ou problème :
- 📧 Email: support@pulseai.africa
- 💬 Issues GitHub: [Créer une issue](https://github.com/votre-username/pulseai-dashboard/issues)

---

**✨ Déployé avec succès sur Netlify** | **🔒 Sécurisé par Supabase RLS** | **🌍 Fait pour l'Afrique**


## 🚦 Utilisation

### Développement local

Utilisez un serveur web local pour servir les fichiers :

```bash
# Avec Python
python -m http.server 8000

# Avec Node.js (http-server)
npx http-server

# Avec PHP
php -S localhost:8000
```

Puis ouvrez `http://localhost:8000/public/index.html`

### Création du premier admin

Après avoir créé votre premier utilisateur, vous devrez lui attribuer le rôle admin manuellement dans Supabase :

1. Allez dans l'éditeur SQL de Supabase
2. Exécutez :
   ```sql
   UPDATE profiles 
   SET role = 'admin' 
   WHERE email = 'votre@email.com';
   ```

## 📚 API

### Authentification

```javascript
import { login, logout } from './src/auth.js';

// Connexion
await login('email@example.com', 'password');

// Déconnexion
await logout();
```

### Gestion des utilisateurs

```javascript
import { 
    getAllUsers, 
    getUserById, 
    updateUser, 
    deleteUser 
} from './src/manage.js';

// Récupérer tous les utilisateurs
const users = await getAllUsers();

// Mettre à jour un utilisateur
await updateUser(userId, { full_name: 'Nouveau nom' });

// Supprimer un utilisateur
await deleteUser(userId);
```

### Inscription

```javascript
import { registerComplete } from './src/register.js';

await registerComplete(
    'email@example.com',
    'password',
    { full_name: 'John Doe' }
);
```

## 🔒 Sécurité

- **Row Level Security (RLS)** : Activé sur toutes les tables
- **Policies** : Contrôle d'accès granulaire basé sur les rôles
- **Validation** : Validation des données côté client et serveur
- **Authentification** : Gestion sécurisée via Supabase Auth

## 🎨 Personnalisation

### Thème

Modifiez les variables CSS dans `public/styles.css` :

```css
:root {
    --primary-color: #6366f1;
    --secondary-color: #8b5cf6;
    --background: #0f172a;
    /* ... */
}
```

### Base de données

Ajoutez vos propres tables et colonnes dans `sql/init.sql`

## 📝 Structure de la base de données

### Table `profiles`
- `id` : UUID (clé primaire)
- `user_id` : UUID (référence à auth.users)
- `email` : TEXT
- `full_name` : TEXT
- `role` : TEXT (user/admin)
- `is_active` : BOOLEAN
- `created_at` : TIMESTAMP
- `updated_at` : TIMESTAMP

### Table `sessions`
- Gestion des sessions utilisateurs
- Tracking IP et user agent

### Table `activity_logs`
- Logs d'activité pour audit
- Actions et détails en JSONB

### Table `settings`
- Paramètres globaux de l'application

## 🐛 Débogage

- Ouvrez la console du navigateur (F12)
- Vérifiez les erreurs dans l'onglet Console
- Utilisez l'onglet Network pour les requêtes API
- Consultez les logs Supabase dans le dashboard

## 📄 Licence

MIT

## 👤 Auteur

PulseAI Dashboard

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou un pull request.

## 📞 Support

Pour toute question ou problème, ouvrez une issue sur GitHub.
