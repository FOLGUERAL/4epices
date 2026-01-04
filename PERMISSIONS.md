# Configuration des Permissions Strapi

## Problème : Forbidden Access

Si vous obtenez une erreur "Forbidden access" lors de l'accès à l'API depuis le frontend, c'est que les permissions publiques ne sont pas configurées.

## Solution Automatique

Le fichier `backend/src/index.js` contient un script de bootstrap qui configure automatiquement les permissions publiques au démarrage de Strapi. Si cela ne fonctionne pas, suivez la méthode manuelle ci-dessous.

## Solution Manuelle (Recommandée)

1. **Accédez à l'admin Strapi** : http://localhost:1337/admin

2. **Allez dans Settings > Users & Permissions Plugin > Roles**

3. **Cliquez sur "Public"**

4. **Cochez les permissions suivantes pour chaque Content Type** :

### Pour "Recette" :
- ✅ `find` (GET /api/recettes)
- ✅ `findOne` (GET /api/recettes/:id)

### Pour "Catégorie" :
- ✅ `find` (GET /api/categories)
- ✅ `findOne` (GET /api/categories/:id)

### Pour "Tag" :
- ✅ `find` (GET /api/tags)
- ✅ `findOne` (GET /api/tags/:id)

5. **Cliquez sur "Save"**

## Permissions à NE PAS activer pour Public

Pour des raisons de sécurité, ne donnez **JAMAIS** les permissions suivantes au rôle Public :
- ❌ `create` (POST)
- ❌ `update` (PUT)
- ❌ `delete` (DELETE)

Ces permissions doivent rester réservées aux utilisateurs authentifiés (rôle Authenticated) ou aux administrateurs.

## Vérification

Après avoir configuré les permissions, testez l'API :

```bash
curl http://localhost:1337/api/recettes
```

Vous devriez recevoir une réponse JSON avec les recettes (ou un tableau vide si aucune recette n'est créée).

