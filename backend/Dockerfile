FROM node:18-alpine

# Installer les dépendances système pour better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /opt/app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
# Utiliser npm install si package-lock.json n'est pas synchronisé
RUN npm install --omit=dev --legacy-peer-deps

# Copier le reste de l'application
COPY . .

# Build l'admin panel Strapi
RUN npm run build

# Exposer le port
EXPOSE 1337

# Commande par défaut
CMD ["npm", "run", "start"]

