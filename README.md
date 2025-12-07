# Dashboard Web PulseAI

Dashboard web moderne avec authentification et gestion des utilisateurs basé sur Supabase.

## 🚀 Fonctionnalités

- ✅ Authentification utilisateur (connexion/déconnexion)
- ✅ Inscription de nouveaux utilisateurs
- ✅ Gestion des profils utilisateurs
- ✅ Panel d'administration
- ✅ Gestion des rôles (user/admin)
- ✅ Statistiques et analytics
- ✅ Logs d'activité
- ✅ Row Level Security (RLS)

## 📁 Structure du projet

```
├── public/
│   ├── index.html          # Page de connexion/dashboard
│   ├── admin.html          # Panel d'administration
│   └── styles.css          # Styles CSS
├── src/
│   ├── supabase.js         # Configuration Supabase
│   ├── auth.js             # Gestion de l'authentification
│   ├── register.js         # Inscription utilisateurs
│   ├── manage.js           # Gestion CRUD utilisateurs
│   └── admin.js            # Fonctionnalités admin
├── sql/
│   ├── init.sql            # Schéma de base de données
│   ├── rls_policies.sql    # Politiques de sécurité
│   └── enable_rls.sql      # Activation RLS pour hospitals, services, ratings
└── README.md
```

## 🛠️ Installation

### Prérequis

- Un compte [Supabase](https://supabase.com)
- Un navigateur web moderne
- (Optionnel) Un serveur web local pour le développement

### Configuration

1. **Créer un projet Supabase**
   - Allez sur [supabase.com](https://supabase.com)
   - Créez un nouveau projet
   - Notez votre `URL` et `anon key`

2. **Configurer la base de données**
   - Dans l'éditeur SQL de Supabase, exécutez les scripts dans cet ordre :
     1. `sql/init.sql` - Créer le schéma de base de données
     2. `sql/rls_policies.sql` - Politiques de sécurité pour les profils
     3. `sql/enable_rls.sql` - Activer RLS sur hospitals, hospital_services, ratings

3. **Configurer l'application**
   - Ouvrez `src/supabase.js`
   - Remplacez les valeurs suivantes :
     ```javascript
     const SUPABASE_URL = 'votre_url_supabase';
     const SUPABASE_ANON_KEY = 'votre_anon_key';
     ```

4. **Installer le client Supabase**
   
   Ajoutez le script CDN dans vos fichiers HTML (ou utilisez npm) :
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ```

   Ou via npm :
   ```bash
   npm install @supabase/supabase-js
   ```

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
