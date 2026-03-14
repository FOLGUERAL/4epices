# Configuration de l'authentification Admin

## Vue d'ensemble

Le système d'authentification admin protège :
- La page `/creer-recette` (création de recettes)
- Le bouton "Publier sur Pinterest" sur les pages de détail de recette

## Configuration

### 1. Définir le secret admin

**En développement** : Ajoutez la variable dans `frontend/.env.local` :

```env
NEXT_PUBLIC_ADMIN_SECRET=votre_secret_ici
```

**En production** : Deux options selon votre méthode de déploiement :

#### Option A : Build manuel (sans Docker)

Ajoutez la variable dans `frontend/.env.production` :

```env
NEXT_PUBLIC_ADMIN_SECRET=votre_secret_ici
```

Next.js chargera automatiquement ce fichier lors du build en production (`NODE_ENV=production`).

#### Option B : Build avec Docker Compose (Recommandé pour la production)

⚠️ **IMPORTANT** : Avec Docker Compose, le fichier `frontend/.env.production` n'est **PAS** utilisé. Vous devez créer un fichier `.env` à la **racine du projet** (au même niveau que `docker-compose.yml`).

1. Créez un fichier `.env` à la racine du projet :

```bash
# À la racine du projet (même niveau que docker-compose.yml)
touch .env
```

2. Ajoutez la variable dans ce fichier `.env` :

```env
NEXT_PUBLIC_ADMIN_SECRET=votre_secret_ici
NEXT_PUBLIC_STRAPI_URL=https://api.4epices.fr
NEXT_PUBLIC_SITE_URL=https://4epices.fr
```

3. Rebuild l'image Docker pour intégrer la variable :

```bash
docker-compose build frontend
docker-compose up -d
```

**Pourquoi ?** : Docker Compose lit les variables depuis un fichier `.env` à la racine du projet (ligne 45 de `docker-compose.yml`). Les variables `NEXT_PUBLIC_*` sont intégrées au build Docker, donc elles doivent être disponibles lors de la construction de l'image.

#### Option C : Build Docker manuel (sans docker-compose)

Passez la variable via `--build-arg` lors du build :

```bash
docker build --build-arg NEXT_PUBLIC_ADMIN_SECRET=votre_secret_ici ...
```

**Important** : 
- Utilisez un secret fort et unique (minimum 16 caractères recommandé)
- Ne partagez jamais ce secret publiquement
- Les variables `NEXT_PUBLIC_*` sont intégrées dans le bundle JavaScript au moment du BUILD
- Si vous changez le secret, vous devez **rebuilder** l'application

### 2. Générer un secret sécurisé

**Sur Linux/Mac :**
```bash
openssl rand -base64 32
```

**Sur Windows (PowerShell) :**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Ou utilisez un générateur en ligne :**
- https://www.random.org/strings/
- Générez une chaîne aléatoire de 32 caractères

### 3. Redémarrer le serveur

Après avoir ajouté la variable d'environnement, redémarrez votre serveur Next.js :

**En développement :**
```bash
# Arrêtez le serveur (Ctrl+C)
# Puis relancez
npm run dev
```

**En production avec Docker Compose :**
```bash
# 1. Créez/modifiez le fichier .env à la racine du projet
# 2. Rebuild l'image frontend
docker-compose build frontend
# 3. Redémarrez les services
docker-compose up -d
```

**En production sans Docker :**
```bash
# Les variables de .env.production seront chargées automatiquement lors du build
npm run build
```

## Utilisation

### Accès à la page créer-recette

1. Accédez à `/creer-recette`
2. Une page de connexion s'affiche
3. Entrez le secret admin configuré dans `.env.local`
4. Vous êtes maintenant authentifié pour cette session

### Bouton Pinterest

Le bouton "Publier sur Pinterest" n'apparaît que si :
- Vous êtes authentifié en tant qu'admin
- La recette n'est pas déjà publiée sur Pinterest

## Sécurité

⚠️ **Note importante** : Cette implémentation utilise `sessionStorage` pour stocker le token. 

**Pour la production**, vous devriez :
- Utiliser des cookies HTTP-only sécurisés
- Implémenter une vraie session côté serveur
- Utiliser JWT avec expiration
- Ajouter une protection CSRF

Cette solution est adaptée pour un usage personnel/administratif simple.

## Déconnexion

Pour vous déconnecter, videz le `sessionStorage` de votre navigateur ou fermez l'onglet (le token est stocké en session, pas en localStorage).
