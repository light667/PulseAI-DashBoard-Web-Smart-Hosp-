# 🏥 PulseAI - Dashboard Web pour Hôpitaux

Système complet de gestion d'hôpitaux avec inscription, validation administrative et API pour application mobile Flutter.

---

## 📋 APERÇU DU SYSTÈME

### **Fonctionnalités principales:**

1. **Inscription des hôpitaux** (index.html)
   - Création de compte
   - Renseignement des informations (nom, email, téléphone, adresse)
   - Sélection des horaires d'ouverture
   - Géolocalisation automatique
   - Sélection des services médicaux offerts

2. **Dashboard de gestion** (dashboard.html)
   - Mise à jour en temps réel des disponibilités
   - Gestion des médecins disponibles/totaux par service
   - Gestion des lits disponibles/totaux par service
   - Gestion de la file d'attente
   - Activation/Désactivation des services
   - Visualisation des notes et avis

3. **Panel d'administration** (admin.html)
   - Validation des inscriptions (Approuver/Rejeter)
   - Gestion des états: Pending → Approved/Rejected
   - Suppression d'hôpitaux
   - Vue d'ensemble des statistiques

4. **API pour app Flutter**
   - Recherche d'hôpitaux par proximité géographique
   - Filtrage par service
   - Tri par distance et note
   - Système de notation (1-5 étoiles)

---

## 🗂️ STRUCTURE DU PROJET

```
/home/light667/Téléchargements/DASHBOARD WEB PULSEAI/
├── public/
│   ├── index.html           # Inscription des hôpitaux
│   ├── dashboard.html       # Gestion temps réel
│   ├── admin.html           # Validation admin
│   └── styles.css           # Styles globaux
│
├── src/
│   ├── config.js            # Configuration Supabase (NE PAS PUSHER)
│   ├── config.example.js    # Template de configuration
│   ├── supabase.js          # Client Supabase
│   ├── auth.js              # Authentification
│   ├── register.js          # Inscription hôpitaux
│   ├── dashboard.js         # Gestion dashboard
│   └── admin_hospitals.js   # Validation admin
│
└── sql/
    ├── init.sql                # Tables profiles, sessions, logs
    ├── schema_hospitals.sql    # Tables hôpitaux complètes
    ├── enable_rls.sql          # Activation RLS
    └── rls_policies.sql        # Politiques de sécurité
```

---

## ⚙️ INSTALLATION

### **1. Créer le projet Supabase**

1. Aller sur https://supabase.com
2. Créer un nouveau projet
3. Noter l'URL et l'Anon Key

### **2. Configurer la base de données**

Dans l'éditeur SQL de Supabase, exécuter les scripts **DANS CET ORDRE** :

```sql
-- 1. Tables de base (profiles, sessions, etc.)
-- Copier/coller le contenu de: sql/init.sql
-- ▶️ RUN

-- 2. Extension PostGIS + Tables hôpitaux
-- Copier/coller le contenu de: sql/schema_hospitals.sql
-- ▶️ RUN

-- 3. Politiques RLS pour profiles
-- Copier/coller le contenu de: sql/rls_policies.sql
-- ▶️ RUN

-- 4. Activation RLS pour hôpitaux
-- Copier/coller le contenu de: sql/enable_rls.sql
-- ▶️ RUN
```

### **3. Configurer l'application**

```bash
cd "/home/light667/Téléchargements/DASHBOARD WEB PULSEAI"

# Le fichier src/config.js existe déjà avec tes clés
# Si tu dois le recréer:
cp src/config.example.js src/config.js
# Puis éditer src/config.js avec tes vraies clés
```

### **4. Créer un compte admin**

```sql
-- Dans Supabase SQL Editor:

-- 1. Créer un compte via l'interface web (index.html)
-- 2. Puis exécuter:
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'ton@email.com';
```

### **5. Tester l'application**

```bash
# Lancer un serveur local
python -m http.server 8000

# Ou avec Node.js
npx http-server

# Puis ouvrir: http://localhost:8000/public/index.html
```

---

## 📊 STRUCTURE DE LA BASE DE DONNÉES

### **Tables principales:**

#### **1. hospitals**
```sql
- id (UUID)
- owner_id (UUID) → auth.users
- name, email, phone, address, description
- location (GEOMETRY Point) → Géolocalisation PostGIS
- openings (JSONB) → Horaires d'ouverture
- status ('pending', 'approved', 'rejected')
- rejection_reason (TEXT)
- average_rating (NUMERIC 0.0-5.0)
- total_ratings (INTEGER)
- created_at, updated_at, approved_at, approved_by
```

#### **2. services**
```sql
- id (SERIAL)
- name (TEXT) → "Cardiologie", "Chirurgie"...
- category (TEXT) → "Spécialités", "Urgences"...
- description, icon
```

24 services pré-remplis: Cardiologie, Chirurgie, Urgences, Pédiatrie, Gynécologie, Orthopédie, Radiologie, Laboratoire, Maternité, Ophtalmologie, ORL, Dermatologie, Neurologie, Psychiatrie, Oncologie, Néphrologie, Pneumologie, Gastro-entérologie, Rhumatologie, Anesthésie, Pharmacie, Ambulance, Dentisterie, Kinésithérapie

#### **3. hospital_services** (Relation many-to-many)
```sql
- id (UUID)
- hospital_id (UUID) → hospitals
- service_id (INTEGER) → services
- is_available (BOOLEAN)
- total_doctors, available_doctors
- total_beds, available_beds
- queue_length (INTEGER)
- notes (TEXT)
```

#### **4. ratings**
```sql
- id (UUID)
- hospital_id (UUID) → hospitals
- user_id (UUID) → auth.users
- rating (INTEGER 1-5)
- comment (TEXT)
- created_at, updated_at
```

---

## 🔐 SÉCURITÉ (RLS)

### **Politiques activées:**

#### **hospitals:**
- ✅ Lecture publique (status = 'approved')
- ✅ Propriétaires gèrent leur hôpital
- ✅ Admins gèrent tout

#### **hospital_services:**
- ✅ Lecture publique (hôpitaux approuvés)
- ✅ Propriétaires gèrent leurs services
- ✅ Admins gèrent tout

#### **ratings:**
- ✅ Lecture publique
- ✅ Utilisateurs créent/modifient leurs propres notes
- ✅ Admins gèrent tout

---

## 🚀 UTILISATION

### **Pour les hôpitaux:**

1. **S'inscrire** sur `index.html`
   - Créer un compte avec email/mot de passe
   - Remplir les informations de l'hôpital
   - Cocher les services offerts
   - Autoriser la géolocalisation

2. **Attendre validation** (status = 'pending')
   - Un admin doit approuver

3. **Gérer le dashboard** sur `dashboard.html`
   - Mettre à jour les disponibilités en temps réel
   - Médecins disponibles/totaux
   - Lits disponibles/totaux
   - File d'attente
   - Activer/désactiver des services

### **Pour les admins:**

1. **Se connecter** avec un compte admin
2. **Aller sur** `admin.html`
3. **Valider les inscriptions:**
   - ✅ Approuver → status = 'approved'
   - ❌ Rejeter → status = 'rejected' + raison
   - 🗑️ Supprimer si nécessaire

---

## 📱 INTÉGRATION FLUTTER

### **Fonction SQL pour recherche:**

```sql
-- Recherche d'hôpitaux par proximité
SELECT * FROM find_nearby_hospitals(
    p_latitude := 5.3600,      -- Position utilisateur
    p_longitude := -4.0083,
    p_service_id := 1,         -- ID du service (optionnel)
    p_max_distance_km := 50,   -- Rayon de recherche
    p_limit := 20              -- Nombre de résultats
);
```

### **Retourne:**
```json
{
  "id": "uuid",
  "name": "Hôpital Central",
  "email": "contact@hopital.com",
  "phone": "+225...",
  "address": "Abidjan, Cocody",
  "distance_km": 2.5,
  "average_rating": 4.3,
  "total_ratings": 45,
  "services": [
    {
      "service_id": 1,
      "service_name": "Cardiologie",
      "available_doctors": 3,
      "available_beds": 10,
      "queue_length": 5
    }
  ]
}
```

### **Endpoints Supabase pour Flutter:**

```dart
// 1. Recherche d'hôpitaux
final hospitals = await supabase.rpc('find_nearby_hospitals', params: {
  'p_latitude': userLat,
  'p_longitude': userLng,
  'p_service_id': selectedServiceId,
  'p_max_distance_km': 50,
  'p_limit': 20
});

// 2. Noter un hôpital
await supabase.from('ratings').insert({
  'hospital_id': hospitalId,
  'user_id': userId,
  'rating': 5,
  'comment': 'Excellent service !'
});

// 3. Détails d'un hôpital
final hospital = await supabase
  .from('hospitals')
  .select('''
    *,
    hospital_services (
      *,
      services (*)
    )
  ''')
  .eq('id', hospitalId)
  .single();
```

---

## 🔄 WORKFLOW COMPLET

```
┌─────────────────────┐
│ 1. HÔPITAL          │
│ S'inscrit           │
│ (status: pending)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. ADMIN            │
│ Valide/Rejette      │
│ (approved/rejected) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. HÔPITAL          │
│ Gère disponibilités │
│ (dashboard)         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 4. APP FLUTTER      │
│ Recherche hôpitaux  │
│ Tri par distance    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 5. UTILISATEUR      │
│ Consulte & Note     │
│ (1-5 étoiles)       │
└─────────────────────┘
```

---

## ✅ CHECKLIST FINALE

- [x] Tables créées (hospitals, services, hospital_services, ratings)
- [x] 24 services pré-remplis
- [x] RLS activé sur toutes les tables
- [x] Fonction de recherche géographique (PostGIS)
- [x] Système de notation avec calcul automatique
- [x] Interface d'inscription
- [x] Dashboard de gestion temps réel
- [x] Panel admin de validation
- [ ] Créer un compte admin
- [ ] Tester une inscription complète
- [ ] Intégrer avec Flutter

---

## 🛠️ COMMANDES GIT

```bash
cd "/home/light667/Téléchargements/DASHBOARD WEB PULSEAI"

# Ajouter les nouveaux fichiers
git add .

# Commit
git commit -m "Système complet: Dashboard + Admin + API Flutter"

# Push
git push origin main
```

---

## 📞 SUPPORT

Repo GitHub: https://github.com/light667/PulseAI-DashBoard-Web-Smart-Hosp-.git

---

**Créé le:** 7 décembre 2025  
**Version:** 1.0.0  
**Auteur:** light667
