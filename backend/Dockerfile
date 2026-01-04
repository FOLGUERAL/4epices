FROM node:18-alpine

# Installer les dépendances système pour better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /opt/app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le reste de l'application
COPY . .

# Exposer le port
EXPOSE 1337

# Commande par défaut
CMD ["npm", "run", "start"]

