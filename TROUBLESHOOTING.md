# 🔧 Guide de Dépannage - Erreurs d'Inscription

## Erreur 401 lors de l'inscription

### Symptôme
```
Failed to load resource: the server responded with a status of 401
Erreur création hôpital: {...}
```

### Cause
Les politiques RLS (Row Level Security) de Supabase bloquent l'insertion.

### Solution

**Exécutez ce script dans Supabase SQL Editor** :

```sql
-- Politique corrigée pour permettre l'inscription
DROP POLICY IF EXISTS "Owners can create own hospital" ON public.hospitals;

CREATE POLICY "Owners can create own hospital" ON public.hospitals 
    FOR INSERT 
    WITH CHECK (auth.uid() = owner_id);

-- Politique pour hospital_services
DROP POLICY IF EXISTS "Owners can insert services" ON public.hospital_services;

CREATE POLICY "Owners can insert services" ON public.hospital_services 
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hospitals 
            WHERE id = hospital_services.hospital_id 
            AND owner_id = auth.uid()
        )
    );
```

---

## Erreur "Failed to fetch" ou "ERR_CONNECTION_CLOSED"

### Causes possibles
1. **Rate limiting** : Trop de tentatives de connexion
2. **Connexion internet instable**
3. **Multiples instances Supabase** (warning dans la console)

### Solutions

1. **Attendez 60 secondes** entre chaque tentative
2. Rechargez complètement la page (Ctrl+F5)
3. Vérifiez votre connexion internet
4. Vérifiez que Supabase est accessible : https://status.supabase.com

---

## Warning "Multiple GoTrueClient instances"

### Cause
Le client Supabase est initialisé plusieurs fois (auth.js + dashboard.js)

### Impact
Peut causer des comportements imprévisibles mais n'empêche pas le fonctionnement

### Solution (non critique)
C'est un warning, pas une erreur. Le système fonctionne malgré tout.

---

## Vérification Rapide

### 1. Tester la connexion Supabase
http://localhost:8000/public/test.html

Vous devez voir :
- ✅ Supabase connecté
- ✅ Services chargés: 15 services
- ✅ Table hospitals OK

### 2. Vérifier les politiques RLS

Dans Supabase SQL Editor :
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('hospitals', 'hospital_services');
```

Vous devez voir au minimum :
- `Owners can create own hospital`
- `Owners can view own hospital`
- `Owners can update own hospital`

### 3. Test d'inscription manuelle

Dans Supabase SQL Editor :
```sql
-- Remplacez USER_ID par votre ID utilisateur (visible dans auth.users)
INSERT INTO hospitals (owner_id, name, email, phone, address, status)
VALUES (
    'VOTRE_USER_ID',
    'Test Hospital',
    'test@test.com',
    '+225 XX XX XX XX',
    'Abidjan, Côte d''Ivoire',
    'pending'
);
```

Si ça fonctionne ici mais pas depuis l'app → Problème de RLS
Si ça échoue ici aussi → Problème de structure de table

---

## Contact Support

Si le problème persiste :
1. Copiez les erreurs de la console (F12)
2. Vérifiez l'onglet Network pour voir la requête exacte qui échoue
3. Partagez le code d'erreur complet
