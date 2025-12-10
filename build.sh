#!/bin/bash
# Script de préparation pour le déploiement Netlify
# Copie tous les fichiers JS nécessaires dans public/

echo "🔧 Préparation du déploiement..."

# Créer les dossiers nécessaires
mkdir -p public/src/utils

# Copier les fichiers JS
echo "📦 Copie des fichiers JavaScript..."
cp -r src/*.js public/src/
cp -r src/utils/*.js public/src/utils/

echo "✅ Fichiers copiés avec succès!"
echo ""
echo "Structure créée:"
ls -la public/src/
echo ""
ls -la public/src/utils/
echo ""
echo "🚀 Prêt pour le déploiement Netlify!"
