# 🎯 TODO - ÉTAPES À SUIVRE

## ✅ CE QUI EST FAIT

- [x] Structure complète du projet
- [x] Fichiers HTML (index, dashboard, admin)
- [x] Fichiers JavaScript (auth, register, dashboard, admin)
- [x] Scripts SQL complets
- [x] Configuration Supabase sécurisée
- [x] Documentation complète

---

## 🔴 CE QU'IL TE RESTE À FAIRE

### **ÉTAPE 1: Configurer Supabase (15 min)**

1. Va sur https://supabase.com/dashboard/project/nDwMSsNKvjk3

2. Clique sur **SQL Editor** → **New query**

3. Copie-colle et exécute **DANS CET ORDRE** :

#### Script 1: `sql/init.sql`
```
▶️ RUN
✅ Vérifier: Tables profiles, sessions, activity_logs, settings créées
```

#### Script 2: `sql/schema_hospitals.sql`
```
▶️ RUN
✅ Vérifier: 
   - Tables hospitals, services, hospital_services, ratings créées
   - 24 services insérés
   - Extension PostGIS activée
```

#### Script 3: `sql/rls_policies.sql`
```
▶️ RUN
✅ Vérifier: RLS activé sur profiles, sessions, activity_logs, settings
```

#### Script 4: `sql/enable_rls.sql`
```
▶️ RUN  
✅ Vérifier: RLS activé sur hospitals, hospital_services, ratings
```

---

### **ÉTAPE 2: Créer un compte admin (5 min)**

1. Ouvre `http://localhost:8000/public/index.html`
2. Crée un compte avec ton email
3. Retourne dans **Supabase SQL Editor**
4. Exécute:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'TON_EMAIL_ICI@example.com';
```

---

### **ÉTAPE 3: Tester l'inscription d'un hôpital (10 min)**

1. **Déconnecte-toi** du compte admin
2. **Crée un nouveau compte** pour un hôpital
3. **Remplis le formulaire:**
   - Nom de l'hôpital
   - Email, téléphone
   - Adresse
   - Horaires (sélectionne des jours et heures)
   - Clique "Récupérer position" (autoriser géolocalisation)
   - Coche des services médicaux
   - Ajoute une description
4. **Clique "Envoyer l'inscription"**

✅ Tu devrais voir: "Profil mis à jour avec succès!"

---

### **ÉTAPE 4: Valider l'inscription (Admin) (5 min)**

1. **Reconnecte-toi** avec ton compte admin
2. **Ouvre** `admin.html`
3. **Tu devrais voir** l'hôpital dans "En attente"
4. **Clique "✅ Approuver"**

✅ L'hôpital passe dans l'onglet "Approuvés"

---

### **ÉTAPE 5: Tester le dashboard (5 min)**

1. **Reconnecte-toi** avec le compte hôpital
2. **Ouvre** `dashboard.html`
3. **Tu devrais voir:**
   - Nom de l'hôpital
   - Badge "✅ Approuvé"
   - Liste des services cochés
4. **Teste la mise à jour:**
   - Change "Médecins disponibles"
   - Change "Lits disponibles"
   - Change "File d'attente"
   - Clique "⚙️ Config totaux"

✅ Les valeurs se sauvegardent en temps réel

---

### **ÉTAPE 6: Tester l'API Flutter (5 min)**

Dans **Supabase SQL Editor**, exécute:

```sql
-- Remplace les coordonnées par ta position
SELECT * FROM find_nearby_hospitals(
    p_latitude := 5.3600,
    p_longitude := -4.0083,
    p_service_id := NULL,
    p_max_distance_km := 50,
    p_limit := 20
);
```

✅ Tu devrais voir l'hôpital approuvé avec distance calculée

---

### **ÉTAPE 7: Push sur GitHub (2 min)**

```bash
cd "/home/light667/Téléchargements/DASHBOARD WEB PULSEAI"
git add .
git commit -m "Système complet: Dashboard + Admin + API Flutter ready"
git push origin main
```

---

## 🐛 DÉPANNAGE

### Erreur: "relation X does not exist"
→ Tu as oublié d'exécuter un script SQL

### Erreur: "permission denied"
→ RLS n'est pas configuré correctement

### L'hôpital n'apparaît pas dans l'app Flutter
→ Vérifie que status = 'approved'

### Géolocalisation ne fonctionne pas
→ Utilise HTTPS ou localhost (pas HTTP sur IP)

---

## 📋 VÉRIFICATION FINALE

```sql
-- Dans Supabase SQL Editor, vérifie:

-- 1. Tables créées
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
-- ✅ Doit afficher: hospitals, services, hospital_services, ratings, profiles...

-- 2. Services insérés
SELECT COUNT(*) FROM services;
-- ✅ Doit retourner: 24

-- 3. RLS activé
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';
-- ✅ rowsecurity = true pour hospitals, hospital_services, ratings

-- 4. Hôpitaux inscrits
SELECT name, status FROM hospitals;
-- ✅ Doit afficher ton hôpital test

-- 5. Admin créé
SELECT email, role FROM profiles WHERE role = 'admin';
-- ✅ Doit afficher ton email
```

---

## 🎉 PROCHAINES ÉTAPES

Une fois tout testé:

1. **Créer plus d'hôpitaux de test**
2. **Tester les notes** (ratings)
3. **Intégrer avec Flutter:**
   - Installer `supabase_flutter`
   - Utiliser `find_nearby_hospitals()`
   - Créer UI de recherche
   - Implémenter système de notation

---

## 🚀 COMMENCE MAINTENANT !

**Temps estimé total: 45 minutes**

Suis les étapes dans l'ordre et tu auras un système 100% fonctionnel ! 🔥
