# 🚨 GUIDE DE DÉMARRAGE - PulseAI Dashboard

## Problèmes Actuels & Solutions

### ❌ Erreur 406 sur `/hospitals`
**Cause** : Le script SQL `complete_setup.sql` n'a pas été exécuté dans Supabase.

**Solution** :
1. Ouvrez Supabase : https://app.supabase.com
2. Allez dans votre projet
3. Cliquez sur **SQL Editor** dans le menu latéral
4. Cliquez sur **New Query**
5. Copiez-collez **tout le contenu** de `sql/complete_setup.sql`
6. Cliquez sur **Run** (ou Ctrl+Enter)
7. Vérifiez qu'il n'y a pas d'erreur

### ✅ Vérification Post-Installation

Après l'exécution du script, testez dans le SQL Editor :

```sql
-- Vérifier que les tables existent
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Vérifier les services
SELECT * FROM public.services;

-- Vérifier les politiques RLS
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

### 🔧 Corrections Appliquées

1. **dashboard.js** :
   - ✅ Changé `.single()` → `.maybeSingle()` pour éviter l'erreur 406
   - ✅ Ajout de vérification `if (!currentHospital)`
   - ✅ Amélioration du listener de déconnexion

2. **Chemins de fichiers** :
   - ✅ CSS : `./styles.css` (correct)
   - ✅ JS : `../src/dashboard.js?v=9` (correct)

### 🧪 Test Complet

1. **Exécutez le script SQL** (étape ci-dessus)
2. **Inscrivez un hôpital** : http://localhost:8000/public/index.html
3. **Connectez-vous** : Vous serez redirigé vers le dashboard
4. **Vérifiez** :
   - Le statut "EN ATTENTE DE VALIDATION" s'affiche
   - Les services sélectionnés apparaissent
   - Vous pouvez modifier les stats (médecins, lits, files)
   - Le bouton de déconnexion fonctionne

### 📊 Structure des Données

```
auth.users (Supabase Auth)
    ↓
profiles (auto-créé par trigger)
    ↓
hospitals (1 par user)
    ↓
hospital_services (N services par hôpital)
    ↓
services (catalogue fixe)

ratings (notes des utilisateurs Flutter)
```

### 🐛 Debug Console

Si vous voyez encore des erreurs, ouvrez la console (F12) et vérifiez :

```javascript
// Dans la console du navigateur
supabase.from('hospitals').select('*').then(console.log)
supabase.from('services').select('*').then(console.log)
```

### 📱 Pour l'App Flutter

Une fois qu'un hôpital est **approuvé** (status = 'approved'), il sera visible via :

```dart
final hospitals = await supabase
  .from('hospitals')
  .select('*, hospital_services(*, services(*))')
  .eq('status', 'approved');
```

---

## 🎯 Prochaines Actions

1. [ ] Exécuter `sql/complete_setup.sql` dans Supabase
2. [ ] Tester l'inscription
3. [ ] Vérifier que les données arrivent dans Supabase
4. [ ] Tester le dashboard
5. [ ] Utiliser `public/admin.html` pour approuver les hôpitaux
