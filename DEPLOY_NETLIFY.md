# Guide de Déploiement Netlify - PulseAI

## 🎯 Objectif
Déployer le Dashboard PulseAI sur Netlify avec configuration complète.

## ✅ Checklist Avant Déploiement

### 1. Configuration Supabase
- [ ] Projet Supabase créé
- [ ] Script `sql/complete_setup.sql` exécuté
- [ ] Script `sql/final_rls_policies.sql` exécuté
- [ ] Extension PostGIS activée (`CREATE EXTENSION postgis;`)
- [ ] Au moins 1 admin créé (mettre `role='admin'` dans `profiles`)
- [ ] URL et anon_key récupérées (Settings → API)

### 2. Configuration Locale
- [ ] Fichier `src/config.js` créé avec vraies clés
- [ ] Test local réussi avec `/test.html`
- [ ] Connexion/inscription testée
- [ ] Dashboard testé
- [ ] Admin panel testé

### 3. Fichiers de Déploiement
- [x] `netlify.toml` créé
- [x] `public/_redirects` créé
- [x] Structure `public/` correcte
- [x] Tous les fichiers HTML présents

## 🚀 Méthode 1 : Déploiement via GitHub (Recommandé)

### Étape 1 : Préparer le Repository

```bash
# Dans le terminal
cd "/home/light667/Téléchargements/DASHBOARD WEB PULSEAI"

# Initialiser Git (si pas déjà fait)
git init

# Créer .gitignore
cat > .gitignore << EOF
# Fichiers de configuration sensibles
src/config.js

# Node modules (si vous utilisez npm)
node_modules/

# Fichiers système
.DS_Store
Thumbs.db

# Fichiers IDE
.vscode/
.idea/

# Logs
*.log
EOF

# Ajouter tous les fichiers
git add .

# Premier commit
git commit -m "🚀 Initial commit - PulseAI Dashboard prêt pour Netlify"
```

### Étape 2 : Créer Repository GitHub

```bash
# Option 1 : Via GitHub CLI (si installé)
gh repo create pulseai-dashboard --public --source=. --remote=origin
git push -u origin main

# Option 2 : Manuellement
# 1. Aller sur github.com
# 2. Cliquer "New repository"
# 3. Nom : pulseai-dashboard
# 4. Public ou Private
# 5. Ne PAS initialiser avec README
# 6. Créer le repository
# 7. Copier l'URL HTTPS

# Puis dans le terminal :
git remote add origin https://github.com/votre-username/pulseai-dashboard.git
git branch -M main
git push -u origin main
```

### Étape 3 : Déployer sur Netlify

1. **Connexion Netlify**
   - Aller sur https://app.netlify.com
   - Se connecter (avec GitHub recommandé)

2. **Nouveau Site**
   - Cliquer "Add new site" → "Import an existing project"
   - Choisir "Deploy with GitHub"
   - Autoriser Netlify à accéder à GitHub
   - Sélectionner le repository `pulseai-dashboard`

3. **Configuration Build**
   ```
   Site name: pulseai-dashboard (ou personnalisé)
   Branch to deploy: main
   Build command: echo "Static site - no build"
   Publish directory: public
   ```

4. **Variables d'Environnement** (OPTIONNEL)
   - Cliquer "Show advanced" → "New variable"
   - Ajouter (si vous voulez externaliser la config) :
     ```
     SUPABASE_URL = https://votre-projet.supabase.co
     SUPABASE_ANON_KEY = votre-anon-key
     ```
   - Note : Pour un site statique, mieux vaut garder `config.js`

5. **Déployer**
   - Cliquer "Deploy site"
   - Attendre 1-2 minutes
   - Site disponible sur : `https://nom-site.netlify.app`

## 🚀 Méthode 2 : Déploiement via Netlify CLI

### Installation

```bash
# Installer Netlify CLI
npm install -g netlify-cli

# Vérifier l'installation
netlify --version
```

### Connexion

```bash
# Se connecter à Netlify
netlify login
# Une fenêtre de navigateur s'ouvre pour autoriser
```

### Déploiement

```bash
# Aller dans le répertoire du projet
cd "/home/light667/Téléchargements/DASHBOARD WEB PULSEAI"

# Initialiser le site Netlify
netlify init

# Répondre aux questions :
# - Create & configure a new site
# - Team: Votre équipe
# - Site name: pulseai-dashboard (ou laisser vide pour auto)
# - Build command: (laisser vide)
# - Directory to deploy: public

# Déployer en production
netlify deploy --prod

# OU déployer en preview d'abord
netlify deploy
# Puis si OK :
netlify deploy --prod
```

### Commandes Utiles

```bash
# Voir le statut du site
netlify status

# Ouvrir le site dans le navigateur
netlify open:site

# Ouvrir le dashboard Netlify
netlify open:admin

# Voir les logs de build
netlify build

# Rollback vers version précédente
netlify rollback
```

## 🚀 Méthode 3 : Déploiement par Drag & Drop

### Préparation

```bash
# Créer une archive du dossier public
cd "/home/light667/Téléchargements/DASHBOARD WEB PULSEAI"
zip -r pulseai-public.zip public/

# OU copier juste le dossier public
cp -r public /tmp/pulseai-deploy
```

### Déploiement

1. Aller sur https://app.netlify.com/drop
2. Glisser-déposer le dossier `public/` ou le fichier `pulseai-public.zip`
3. Attendre le déploiement (30 secondes - 1 minute)
4. Site disponible avec URL aléatoire

**Note** : Cette méthode est parfaite pour test rapide, mais pas pour production (pas de CI/CD automatique).

## 🔧 Configuration Post-Déploiement

### 1. Domaine Personnalisé

```bash
# Via CLI
netlify domains:add pulseai.votredomaine.com

# Via Dashboard
# Site settings → Domain management → Add custom domain
# Suivre les instructions DNS
```

### 2. HTTPS (Automatique)

Netlify active automatiquement HTTPS avec Let's Encrypt.
Attendre 1-2 minutes après déploiement.

### 3. Redirections HTTPS

Déjà configuré dans `public/_redirects` :
```
http://pulseai-dashboard.netlify.app/* https://pulseai-dashboard.netlify.app/:splat 301!
```

Mettre à jour avec votre vrai domaine si besoin.

### 4. Headers de Sécurité

Déjà configurés dans `netlify.toml` :
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

### 5. Configuration `src/config.js` sur Netlify

**IMPORTANT** : Le fichier `src/config.js` n'est PAS commité (dans .gitignore).

**Option A - Créer directement sur Netlify (Recommandé)**

Via l'UI Netlify :
1. Deploys → Trigger deploy → Clear cache and deploy site
2. Ou utiliser une fonction Edge pour injecter les variables

**Option B - Commit temporaire pour déploiement**

```bash
# ATTENTION : Exposer les clés publiques Supabase est OK
# (ce sont des clés publiques, pas secrètes)

# Retirer config.js du .gitignore temporairement
git add -f src/config.js
git commit -m "Add config for deployment"
git push origin main

# Après déploiement, le remettre
git rm --cached src/config.js
git commit -m "Remove config from tracking"
git push origin main
```

**Option C - Environnement Variables + Build Script**

Créer `public/env.js` généré au build :
```javascript
// netlify.toml
[build]
  command = "echo \"export const SUPABASE_CONFIG = {url: '$SUPABASE_URL', anonKey: '$SUPABASE_ANON_KEY'}\" > public/env.js"
```

## ✅ Vérification Post-Déploiement

### Checklist Fonctionnelle

Visiter votre site : `https://votre-site.netlify.app`

- [ ] `/` - Page d'accueil charge correctement
- [ ] `/test.html` - Connexion Supabase ✅ verte
- [ ] `/index.html` - Inscription fonctionne
- [ ] `/dashboard.html` - Dashboard accessible après login
- [ ] `/admin.html` - Panel admin accessible (compte admin)
- [ ] `/hospitals.html` - Liste publique visible (sans login)
- [ ] `/profile.html` - Profil éditable (après login)
- [ ] Console navigateur - Aucune erreur 404
- [ ] HTTPS - Cadenas vert dans navigateur

### Tests Rapides

```bash
# Test 1 : Site accessible
curl -I https://votre-site.netlify.app
# Devrait retourner : HTTP/2 200

# Test 2 : Redirections fonctionnent
curl -I https://votre-site.netlify.app/admin
# Devrait retourner : HTTP/2 200 (page admin.html)

# Test 3 : Headers de sécurité
curl -I https://votre-site.netlify.app | grep X-Frame-Options
# Devrait afficher : X-Frame-Options: DENY
```

## 🐛 Dépannage Netlify

### Erreur : "Page not found" sur /dashboard

**Cause** : Redirections SPA mal configurées

**Solution** :
```bash
# Vérifier que public/_redirects existe et contient :
/* /index.html 200
```

### Erreur : "Failed to fetch" dans console

**Cause** : `src/config.js` manquant ou mauvaises clés

**Solution** :
1. Vérifier dans Netlify Deploys → Deploy log
2. S'assurer que `config.js` est commité OU variables d'env configurées
3. Tester avec `/test.html`

### Build échoue

**Cause** : Configuration `netlify.toml` incorrecte

**Solution** :
```toml
# Vérifier netlify.toml
[build]
  publish = "public"
  command = "echo 'Static site'"
```

### Déploiement lent

**Cause** : Fichiers volumineux ou nombreux

**Solution** :
```bash
# Nettoyer les fichiers inutiles
rm -rf node_modules/
rm -rf .git/objects/pack/*.pack (si trop gros)

# Redéployer
netlify deploy --prod
```

## 📊 Monitoring Post-Déploiement

### Analytics Netlify (Gratuit)

```bash
# Activer dans Dashboard
Site settings → Analytics → Enable analytics
```

### Google Analytics (Optionnel)

Ajouter dans toutes les pages HTML avant `</head>` :
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Uptime Monitoring (Optionnel)

- UptimeRobot : https://uptimerobot.com (gratuit)
- Pingdom : https://pingdom.com (payant)
- StatusCake : https://www.statuscake.com (gratuit)

## 🔄 Workflow CI/CD

Une fois GitHub connecté, chaque `git push` déclenche automatiquement :

1. Build sur Netlify
2. Déploiement automatique
3. URL de preview pour branches non-main
4. Rollback automatique si erreur

```bash
# Workflow type :
git checkout -b feature/new-feature
# ... développement ...
git commit -m "✨ New feature"
git push origin feature/new-feature
# → Netlify crée un preview : https://deploy-preview-123.netlify.app

# Review, test, puis merge
git checkout main
git merge feature/new-feature
git push origin main
# → Déploiement automatique en production
```

## 🎉 Félicitations !

Votre Dashboard PulseAI est maintenant en production sur Netlify ! 🚀

URL finale : `https://votre-site.netlify.app`

---

**Prochaines Étapes :**
- Configurer domaine personnalisé
- Ajouter Google Analytics
- Inviter des hôpitaux partenaires
- Créer des comptes admin additionnels
- Monitorer les performances

**Support :**
- Documentation Netlify : https://docs.netlify.com
- Support Netlify : https://answers.netlify.com
- Issues GitHub : https://github.com/votre-username/pulseai-dashboard/issues
