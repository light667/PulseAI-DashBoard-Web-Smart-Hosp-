# 🚀 Guide de Démarrage - PulseAI Dashboard

Ce guide vous explique comment configurer et lancer le projet, même sans connaissances techniques.

## Étape 1 : Configuration de la Base de Données (Supabase)

1.  Connectez-vous à [Supabase](https://supabase.com/).
2.  Créez un nouveau projet (New Project).
3.  Une fois le projet créé, allez dans le menu de gauche sur **SQL Editor**.
4.  Cliquez sur **New Query**.
5.  Ouvrez le fichier `sql/full_setup.sql` qui se trouve dans ce projet.
6.  Copiez tout son contenu et collez-le dans l'éditeur SQL de Supabase.
7.  Cliquez sur **Run** (en bas à droite).
    *   *Si tout se passe bien, vous verrez "Success" dans les résultats.*

## Étape 2 : Connexion du Code à Supabase

1.  Dans Supabase, allez dans **Project Settings** (icône d'engrenage en bas à gauche).
2.  Allez dans **API**.
3.  Vous verrez deux informations importantes :
    *   **Project URL** (ex: `https://xyz.supabase.co`)
    *   **anon public key** (une longue chaîne de caractères)
4.  Ouvrez le fichier `src/config.js` dans ce projet.
5.  Remplacez les valeurs par les vôtres :
    ```javascript
    export const SUPABASE_CONFIG = {
        url: 'VOTRE_PROJECT_URL_ICI',
        anonKey: 'VOTRE_ANON_KEY_ICI'
    };
    ```

## Étape 3 : Lancer le Site

1.  Ouvrez un terminal dans le dossier du projet.
2.  Lancez un serveur local. Si vous avez `npm` installé :
    ```bash
    npx serve public
    ```
    *Ou ouvrez simplement le fichier `public/index.html` dans votre navigateur (mais certaines fonctionnalités peuvent être bloquées).*
3.  Ouvrez l'adresse affichée (généralement `http://localhost:3000`).

## Étape 4 : Utilisation

1.  **Inscription** : Créez un compte sur la page d'accueil.
2.  **Remplissage** : Remplissez les infos de l'hôpital et choisissez vos services.
3.  **Dashboard** : Une fois inscrit, vous accédez au dashboard pour gérer vos lits et médecins.
4.  **Admin** : Pour valider les hôpitaux, il faut un compte administrateur.
    *   *Astuce : Pour devenir admin, allez dans Supabase > Table Editor > profiles, et changez le rôle de votre utilisateur de 'user' à 'admin'.*
