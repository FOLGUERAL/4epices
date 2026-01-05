FROM node:18-alpine

# Installer les dépendances système pour better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /opt/app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances (production + dev pour le build)
RUN npm install --legacy-peer-deps

# Copier le reste de l'application
COPY . .

# Copier le script d'entrée
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Exposer le port
EXPOSE 1337

# Script d'entrée qui rebuild l'admin si le volume mount l'a écrasé
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]

