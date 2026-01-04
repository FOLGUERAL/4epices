# Guide de Déploiement - 4épices

## Déploiement sur VPS OVH

### Prérequis

- VPS OVH avec Ubuntu 20.04+ ou Debian 11+
- 8GB RAM (conforme à votre configuration)
- 75GO de stockage (conforme à votre configuration)
- Accès SSH root ou sudo

### 1. Préparation du Serveur

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des dépendances
sudo apt install -y curl git build-essential

# Installation de Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Installation de PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Installation de Docker (optionnel, mais recommandé)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Installation de Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Configuration PostgreSQL

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Dans PostgreSQL, créer la base de données et l'utilisateur
CREATE DATABASE "4epices";
CREATE USER "4epices_user" WITH PASSWORD 'votre_mot_de_passe_securise';
GRANT ALL PRIVILEGES ON DATABASE "4epices" TO "4epices_user";
\q
```

### 3. Déploiement avec Docker (Recommandé)

```bash
# Cloner ou transférer le projet
git clone <votre-repo> /opt/4epices
cd /opt/4epices

# Créer les fichiers .env
cp backend/config/env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Éditer backend/.env avec vos configurations
nano backend/.env

# Configurer les variables importantes :
# - APP_KEYS (générer avec: openssl rand -base64 32)
# - DATABASE_CLIENT=postgres
# - DATABASE_HOST=postgres (nom du service Docker)
# - DATABASE_NAME=4epices
# - DATABASE_USERNAME=4epices_user
# - DATABASE_PASSWORD=votre_mot_de_passe
# - PINTEREST_ACCESS_TOKEN
# - PINTEREST_BOARD_ID
# - FRONTEND_URL=https://4epices.fr

# Éditer frontend/.env.local
nano frontend/.env.local

# Configurer :
# - NEXT_PUBLIC_STRAPI_URL=https://api.4epices.fr (ou votre domaine backend)
# - NEXT_PUBLIC_SITE_URL=https://4epices.fr

# Modifier docker-compose.yml pour PostgreSQL
# Changer DATABASE_HOST dans backend/.env pour "postgres"

# Lancer les services
docker-compose up -d

# Voir les logs
docker-compose logs -f
```

### 4. Déploiement Manuel (Sans Docker)

#### Backend Strapi

```bash
cd /opt/4epices/backend

# Installer les dépendances
npm install --production

# Créer le fichier .env
cp config/env.example .env
nano .env

# Configurer .env (voir ci-dessus)

# Build Strapi
npm run build

# Installer PM2 pour la gestion des processus
sudo npm install -g pm2

# Lancer Strapi avec PM2
pm2 start npm --name "4epices-backend" -- start
pm2 save
pm2 startup
```

#### Frontend Next.js

```bash
cd /opt/4epices/frontend

# Installer les dépendances
npm install

# Créer le fichier .env.local
cp .env.example .env.local
nano .env.local

# Build Next.js
npm run build

# Lancer Next.js avec PM2
pm2 start npm --name "4epices-frontend" -- start
pm2 save
```

### 5. Configuration Nginx (Reverse Proxy)

```bash
# Installer Nginx
sudo apt install -y nginx

# Créer la configuration
sudo nano /etc/nginx/sites-available/4epices
```

Contenu de `/etc/nginx/sites-available/4epices` :

```nginx
# Backend Strapi
server {
    listen 80;
    server_name api.4epices.fr;

    location / {
        proxy_pass http://localhost:1337;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 100M;
}

# Frontend Next.js
server {
    listen 80;
    server_name 4epices.fr www.4epices.fr;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Activer le site
sudo ln -s /etc/nginx/sites-available/4epices /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Configuration SSL avec Let's Encrypt

```bash
# Installer Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtenir les certificats SSL
sudo certbot --nginx -d 4epices.fr -d www.4epices.fr -d api.4epices.fr

# Le certificat sera renouvelé automatiquement
```

### 7. Création du Premier Admin

```bash
# Accéder à l'interface Strapi
# https://api.4epices.fr/admin

# Créer le compte administrateur
```

### 8. Maintenance

```bash
# Voir les logs PM2
pm2 logs

# Redémarrer les services
pm2 restart all

# Ou avec Docker
docker-compose restart

# Sauvegarder la base de données
pg_dump -U "4epices_user" "4epices" > backup_$(date +%Y%m%d).sql

# Restaurer la base de données
psql -U "4epices_user" "4epices" < backup_YYYYMMDD.sql
```

### 9. Monitoring

```bash
# Installer un monitoring basique
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Variables d'Environnement Importantes

**Backend (.env) :**
- `APP_KEYS` : Clés de sécurité (générer 4 clés uniques)
- `API_TOKEN_SALT` : Salt pour les tokens API
- `ADMIN_JWT_SECRET` : Secret JWT admin
- `JWT_SECRET` : Secret JWT général
- `DATABASE_CLIENT=postgres`
- `DATABASE_*` : Configuration PostgreSQL
- `PINTEREST_ACCESS_TOKEN` : Token Pinterest API
- `PINTEREST_BOARD_ID` : ID du board Pinterest
- `FRONTEND_URL` : URL du frontend (https://4epices.fr)

**Frontend (.env.local) :**
- `NEXT_PUBLIC_STRAPI_URL` : URL du backend (https://api.4epices.fr)
- `NEXT_PUBLIC_SITE_URL` : URL du site (https://4epices.fr)

