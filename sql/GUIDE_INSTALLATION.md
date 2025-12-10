# 🚀 GUIDE D'INSTALLATION - PULSEAI

## 📋 ÉTAPES D'INSTALLATION

### 1️⃣ Dans Supabase

1. **Connectez-vous** à votre projet Supabase
2. **Allez dans** "SQL Editor" (icône base de données à gauche)
3. **Cliquez** sur "+ New query"
4. **Ouvrez** le fichier `sql/production_setup.sql`
5. **Copiez** tout le contenu
6. **Collez** dans l'éditeur SQL de Supabase
7. **Cliquez** sur "Run" (bouton en bas à droite)
8. **Vérifiez** dans l'onglet "Messages" que vous voyez :
   ```
   ✅ Extension PostGIS: Installée
   ✅ Tables créées: 7
   ✅ Services médicaux: 25
   ✅ Fonctions SQL: 5
   ✅ RLS activé sur toutes les tables
   ```

### 2️⃣ Vérification

Dans Supabase, allez dans "Table Editor" et vérifiez que vous voyez ces tables :
- ✅ profiles
- ✅ hospitals
- ✅ services (avec 25 services pré-configurés)
- ✅ hospital_services
- ✅ ratings
- ✅ activity_logs
- ✅ analytics

### 3️⃣ Test de l'Application

1. **Ouvrez** : https://pulseai-hospitals.netlify.app/public/index.html
2. **Inscrivez-vous** avec un nouveau compte
3. **Remplissez** les 4 étapes :
   - Étape 1 : Email + Mot de passe
   - Étape 2 : Nom hôpital, téléphone, adresse
   - Étape 3 : **Cliquez "Détecter ma position"** ← IMPORTANT
   - Étape 4 : Sélectionnez les services et validez
4. **Cliquez** sur "Créer mon compte"
5. **Ouvrez F12** et regardez la console

## 🐛 POURQUOI LE BOUTON NE FONCTIONNAIT PAS

### Problème Identifié
Le bouton "Créer mon compte" avait un mauvais event listener.

### Code Problématique (AVANT)
```javascript
// ❌ Écouteur sur le bouton
const btnSignup = document.getElementById('btnSignup')
btnSignup.addEventListener('click', handleSignup)
```

**Pourquoi ça ne marchait pas :**
- Le bouton est `type="submit"` dans un `<form>`
- Le navigateur empêche le comportement par défaut du click
- L'événement n'est jamais déclenché

### Code Corrigé (APRÈS)
```javascript
// ✅ Écouteur sur le formulaire
const signupForm = document.getElementById('signupForm')
signupForm.addEventListener('submit', (e) => {
    e.preventDefault()
    handleSignup()
})
```

**Pourquoi ça marche maintenant :**
- On écoute l'événement `submit` du formulaire
- `e.preventDefault()` empêche le rechargement de la page
- La fonction `handleSignup()` s'exécute correctement

## ✅ CE QUI A ÉTÉ CORRIGÉ

### Dans `src/auth.js`
1. ✅ Event listener changé de `click` → `submit`
2. ✅ Logs de debug ajoutés à chaque étape
3. ✅ Validation de la création de l'hôpital
4. ✅ Gestion d'erreurs améliorée

### Logs Visibles dans la Console
```javascript
📝 Formulaire d'inscription soumis!
🚀 Début de l'inscription...
📧 Email: test@example.com
🏥 Hôpital: Centre Hospitalier Test
📍 Location: {lat: 5.36, lng: -4.01}
1️⃣ Création du compte Auth...
✅ Compte Auth créé: uuid-xxx
2️⃣ Création de l'hôpital...
✅ Hôpital créé: uuid-yyy
3️⃣ Ajout des services...
✅ Tous les services ajoutés
```

## 🔍 VÉRIFICATION DANS SUPABASE

### Pour voir votre compte créé :
```sql
SELECT * FROM profiles;
```

### Pour voir votre hôpital :
```sql
SELECT 
    name, 
    email, 
    status, 
    ST_AsText(location::geometry) as coordinates 
FROM hospitals;
```

### Pour voir les services associés :
```sql
SELECT 
    h.name as hospital,
    s.name as service
FROM hospital_services hs
JOIN hospitals h ON hs.hospital_id = h.id
JOIN services s ON hs.service_id = s.id;
```

## 📊 STRUCTURE DE LA BASE DE DONNÉES

```
auth.users (Supabase Auth)
    ↓
profiles (1-1 avec users)
    ↓
hospitals (1-N, un user = un hôpital)
    ↓
hospital_services (N-N avec services)
    ↓
services (table de référence)
```

## 🎯 PROCHAINES ÉTAPES

1. **Testez l'inscription** avec un nouveau compte
2. **Vérifiez dans Supabase** que l'hôpital est créé
3. **Connectez-vous au dashboard** pour gérer votre profil
4. **L'hôpital sera en statut "pending"** jusqu'à validation admin

## 📝 NOTES IMPORTANTES

- ⚠️ La géolocalisation est **OBLIGATOIRE** à l'étape 3
- ⚠️ Sélectionnez **au moins 1 service** à l'étape 4
- ⚠️ Vérifiez la console (F12) pour voir les logs
- ✅ Version actuelle des fichiers : **v11**

## 🆘 EN CAS DE PROBLÈME

### Le bouton ne répond toujours pas ?
1. Videz le cache (Ctrl+Shift+R)
2. Vérifiez que vous êtes bien sur la version v11
3. Ouvrez F12 → Console et cherchez les erreurs

### L'hôpital n'est pas créé ?
1. Vérifiez dans la console les logs
2. Regardez s'il y a une erreur dans `2️⃣ Création de l'hôpital`
3. Vérifiez que la géolocalisation a bien fonctionné

### Erreur de géolocalisation ?
1. Autorisez la géolocalisation dans votre navigateur
2. Utilisez HTTPS (pas HTTP)
3. Vérifiez que le bouton affiche "Position enregistrée"

---

**Tout est prêt ! Lancez le script SQL et testez l'inscription. 🚀**
