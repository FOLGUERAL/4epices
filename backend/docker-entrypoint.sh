#!/bin/sh
set -e

# Le volume mount ./backend:/opt/app écrase le .strapi buildé
# Donc on rebuild l'admin au démarrage si nécessaire
if [ ! -d "/opt/app/.strapi/build" ] || [ -z "$(ls -A /opt/app/.strapi/build 2>/dev/null)" ]; then
  echo "Building Strapi admin panel (volume mount may have overwritten it)..."
  export NODE_ENV=production
  npm run build
  echo "Admin panel built successfully"
fi

# Créer un favicon.ico vide si il n'existe pas
if [ ! -f "/opt/app/favicon.ico" ]; then
  touch /opt/app/favicon.ico
fi

# Exécuter la commande passée en argument
exec "$@"

