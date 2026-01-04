# Guide d'Installation - 4épices

## Prérequis

- Node.js 18+ 
- npm, yarn ou pnpm
- PostgreSQL (optionnel, SQLite par défaut pour le développement)

## Installation Locale

### 1. Backend (Strapi)

```bash
cd backend
npm install
```

Créer un fichier `.env` à partir de `config/env.example` :

```bash
cp config/env.example .env
```

Générer des clés sécurisées pour les variables d'environnement :

```bash
# Générer des clés aléatoires (sur Linux/Mac)
openssl rand -base64 32

# Ou utiliser un générateur en ligne pour APP_KEYS, API_TOKEN_SALT, ADMIN_JWT_SECRET, etc.
```

Modifier le fichier `.env` avec vos clés générées.

Lancer Strapi en mode développement :

```bash
npm run develop
```

Strapi sera accessible sur http://localhost:1337

**Première connexion** : Créer un compte administrateur.

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
```

Créer un fichier `.env.local` :

```env
NEXT_PUBLIC_STRAPI_URL=http://localhost:1337
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Lancer Next.js en mode développement :

```bash
npm run dev
```

Next.js sera accessible sur http://localhost:3000

## Configuration Pinterest

⚠️ **Note importante** : Pinterest peut refuser l'accès à l'API depuis `localhost`. Pour le développement local, vous pouvez :
- Utiliser un tunnel public (ngrok, localtunnel) pour exposer votre site
- Ou attendre le déploiement en production (recommandé)

### Étapes de Configuration

1. Créer une application sur [Pinterest Developers](https://developers.pinterest.com/)
2. Obtenir un Access Token
3. Obtenir l'ID de votre board Pinterest
4. Ajouter dans `backend/.env` :

```env
PINTEREST_ACCESS_TOKEN=votre_token
PINTEREST_BOARD_ID=votre_board_id
FRONTEND_URL=http://localhost:3000  # Ou votre URL publique en production
```

### Pour la Production

Une fois votre site déployé :
- Utilisez votre URL publique avec HTTPS : `FRONTEND_URL=https://4epices.fr`
- Assurez-vous que votre application Pinterest est approuvée
- Vérifiez que les URLs sont autorisées dans les paramètres de l'app Pinterest

Voir `NOTES_PINTEREST.md` pour plus de détails sur les restrictions et solutions.

## Structure des Content Types

Une fois Strapi lancé, les content types suivants sont disponibles :

- **Recette** : Contenu principal des recettes
- **Catégorie** : Catégories de recettes
- **Tag** : Tags pour organiser les recettes

## Configuration des Permissions (IMPORTANT)

**⚠️ Avant de pouvoir utiliser le frontend, vous DEVEZ configurer les permissions publiques dans Strapi :**

1. Connectez-vous à l'admin Strapi (http://localhost:1337/admin)
2. Allez dans **Settings** (⚙️) > **Users & Permissions Plugin** > **Roles**
3. Cliquez sur le rôle **Public**
4. Dans la section **Permissions**, trouvez chaque Content Type et cochez :
   - Pour **Recette** : ✅ `find` et ✅ `findOne`
   - Pour **Catégorie** : ✅ `find` et ✅ `findOne`
   - Pour **Tag** : ✅ `find` et ✅ `findOne`
5. Cliquez sur **Save** en haut à droite

**Sans cette configuration, vous obtiendrez une erreur "Forbidden access" lors de l'accès à l'API depuis le frontend.**

Voir le fichier `PERMISSIONS.md` pour plus de détails.

## Utilisation

1. Connectez-vous à l'admin Strapi (http://localhost:1337/admin)
2. **Configurez les permissions** (voir section ci-dessus)
3. Créez des catégories et tags si nécessaire
4. Créez une recette :
   - Remplissez tous les champs
   - Activez "Pinterest Auto Publish" si vous voulez publier automatiquement
   - Publiez la recette
4. Le cron job vérifiera toutes les heures les recettes à publier sur Pinterest

## Publication Manuelle sur Pinterest

Vous pouvez publier manuellement une recette sur Pinterest via l'API :

```bash
POST http://localhost:1337/api/recettes/:id/publish-pinterest
```

## Déploiement

Voir les fichiers Docker pour le déploiement sur VPS.

