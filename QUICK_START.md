# Démarrage Rapide - 4épices

## Installation en 5 minutes

### 1. Backend Strapi

```bash
cd backend
npm install
cp config/env.example .env
```

**Générer les clés de sécurité :**

Sur Linux/Mac :
```bash
openssl rand -base64 32  # Répéter 4 fois pour APP_KEYS
openssl rand -base64 32  # Pour API_TOKEN_SALT
openssl rand -base64 32  # Pour ADMIN_JWT_SECRET
openssl rand -base64 32  # Pour JWT_SECRET
openssl rand -base64 32  # Pour TRANSFER_TOKEN_SALT
```

Sur Windows (PowerShell) :
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Copiez les valeurs générées dans `backend/.env`.

**Lancer Strapi :**
```bash
npm run develop
```

Accédez à http://localhost:1337/admin et créez votre compte admin.

### 2. Frontend Next.js

```bash
cd frontend
npm install
```

Créer `frontend/.env.local` :
```env
NEXT_PUBLIC_STRAPI_URL=http://localhost:1337
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Lancer Next.js :**
```bash
npm run dev
```

Accédez à http://localhost:3000

### 3. Configuration Pinterest (Optionnel)

⚠️ **Note** : Pinterest peut refuser l'accès depuis `localhost`. Pour tester en local, utilisez un tunnel (ngrok) ou attendez le déploiement.

1. Aller sur https://developers.pinterest.com/
2. Créer une application
3. Obtenir un Access Token
4. Trouver l'ID de votre board Pinterest
5. Ajouter dans `backend/.env` :
```env
PINTEREST_ACCESS_TOKEN=votre_token
PINTEREST_BOARD_ID=votre_board_id
FRONTEND_URL=http://localhost:3000  # En production : https://4epices.fr
```

**Pour tester en local** : Utilisez ngrok pour exposer votre localhost publiquement.

### 4. Créer votre première recette

1. Connectez-vous à Strapi Admin (http://localhost:1337/admin)
2. Allez dans "Content Manager" > "Recette"
3. Créez une nouvelle recette
4. Remplissez les champs
5. Uploadez une image principale
6. (Optionnel) Activez "Pinterest Auto Publish"
7. Publiez la recette

La recette apparaîtra automatiquement sur votre site Next.js !

## Commandes Utiles

```bash
# Backend
cd backend
npm run develop    # Mode développement
npm run build      # Build pour production
npm run start      # Mode production

# Frontend
cd frontend
npm run dev        # Mode développement
npm run build      # Build pour production
npm run start      # Mode production
npm run lint       # Vérifier le code
```

## Dépannage

### Strapi ne démarre pas
- Vérifiez que Node.js 18+ est installé : `node --version`
- Vérifiez que le fichier `.env` existe et est bien configuré
- Vérifiez les logs : `npm run develop`

### Next.js ne peut pas se connecter à Strapi
- Vérifiez que Strapi est lancé sur le port 1337
- Vérifiez la variable `NEXT_PUBLIC_STRAPI_URL` dans `.env.local`
- Vérifiez les CORS dans Strapi (`backend/config/middlewares.js`)

### Pinterest ne fonctionne pas
- Vérifiez que les tokens sont corrects dans `.env`
- Vérifiez les logs Strapi pour les erreurs
- Testez manuellement avec l'endpoint `/api/recettes/:id/publish-pinterest`

## Prochaines Étapes

1. ✅ Configurer votre domaine pour la production
2. ✅ Configurer PostgreSQL pour la production
3. ✅ Déployer sur votre VPS (voir DEPLOYMENT.md)
4. ✅ Configurer SSL/HTTPS
5. ✅ Configurer les sauvegardes automatiques

