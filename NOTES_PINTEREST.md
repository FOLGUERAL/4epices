# Notes sur la Publication Pinterest

## ⚠️ Restrictions de l'API Pinterest

### Problème : "Accès à Trial refusé" ou "Forbidden"

Pinterest a des restrictions strictes sur l'accès à leur API :

1. **Développement local** : L'API Pinterest peut refuser les requêtes depuis `localhost` ou des URLs non publiques
2. **Trial/Production** : Pour accéder à l'API en production, votre site doit être :
   - ✅ Accessible publiquement (pas en localhost)
   - ✅ En HTTPS (obligatoire pour la production)
   - ✅ Approuvé par Pinterest (processus de review)
   - ✅ Avoir une politique de confidentialité accessible

### Solutions pour le Développement Local

#### Option 1 : Utiliser un tunnel public (Recommandé pour tester)

Utilisez un service comme **ngrok** ou **localtunnel** pour exposer votre localhost publiquement :

```bash
# Installer ngrok
# Windows : Télécharger depuis https://ngrok.com/download
# Ou via npm : npm install -g ngrok

# Exposer le frontend
ngrok http 3000

# Cela créera une URL publique comme : https://abc123.ngrok.io
```

Puis dans `backend/.env` :
```env
FRONTEND_URL=https://abc123.ngrok.io
```

**Note** : Les URLs ngrok changent à chaque redémarrage (sauf avec un compte payant).

#### Option 2 : Désactiver temporairement Pinterest

Pour le développement, vous pouvez :
- Ne pas configurer les variables Pinterest dans `.env`
- Les recettes seront créées normalement
- Les pins Pinterest ne seront pas créés (mais le reste fonctionne)

Le système gérera gracieusement l'absence de configuration Pinterest.

#### Option 3 : Attendre le déploiement en production (Recommandé)

Une fois votre site déployé sur votre VPS avec un domaine et HTTPS, l'API Pinterest devrait fonctionner correctement.

### Configuration pour la Production

Pour que Pinterest fonctionne en production :

1. **Votre site doit être en ligne** avec un domaine (ex: https://4epices.fr)
2. **HTTPS obligatoire** (Pinterest exige HTTPS)
3. **Vérifier votre application Pinterest** :
   - Aller sur https://developers.pinterest.com/
   - Vérifier que votre application est approuvée
   - Vérifier les URLs autorisées dans les paramètres de l'app
   - Ajouter votre domaine dans les URLs autorisées

4. **Configurer les variables d'environnement** :
```env
FRONTEND_URL=https://4epices.fr
PINTEREST_ACCESS_TOKEN=votre_token_production
PINTEREST_BOARD_ID=votre_board_id
```

5. **Politique de confidentialité** : Assurez-vous d'avoir une page de politique de confidentialité accessible publiquement sur votre site.

## Publication Automatique

La publication automatique sur Pinterest fonctionne via les **lifecycles** Strapi (`backend/src/api/recette/content-types/recette/lifecycles.js`).

Quand une recette est créée ou mise à jour avec :
- `pinterestAutoPublish: true`
- `publishedAt` défini
- `pinterestPinId` vide

Le pin Pinterest sera créé automatiquement.

## Publication Manuelle via API

Pour publier manuellement une recette sur Pinterest, vous pouvez utiliser le controller directement via un script personnalisé.

### Via le Controller directement

```javascript
// Dans un script ou une commande Strapi
const recette = await strapi.entityService.findOne('api::recette.recette', id, {
  populate: ['imagePrincipale'],
});

const pinterestService = strapi.service('api::recette.pinterest');
const pinData = await pinterestService.createPin(recette);
```

## Cron Job

Le cron job dans `backend/config/cron-tasks.js` vérifie toutes les heures les recettes publiées qui doivent être postées sur Pinterest mais qui n'ont pas encore de pin.

## Configuration Requise

Assurez-vous d'avoir configuré dans `backend/.env` :

```env
PINTEREST_ACCESS_TOKEN=votre_token
PINTEREST_BOARD_ID=votre_board_id
FRONTEND_URL=http://localhost:3000  # Ou votre URL publique
```

**Note** : Si les variables ne sont pas configurées, le système continuera de fonctionner mais les pins Pinterest ne seront pas créés.

## Fonctionnement

1. **Création/Publication automatique** : Via lifecycles (immédiat)
2. **Vérification périodique** : Via cron job (toutes les heures)
3. **Publication manuelle** : Via script ou commande personnalisée

## Dépannage

### Erreur "Forbidden" ou "Access denied"
- Vérifiez que votre site est accessible publiquement (pas localhost)
- Vérifiez que vous utilisez HTTPS en production
- Vérifiez que votre application Pinterest est approuvée
- Vérifiez que les URLs sont autorisées dans les paramètres Pinterest

### Erreur "Invalid token"
- Régénérez votre Access Token sur Pinterest Developers
- Vérifiez que le token n'a pas expiré

### Les pins ne sont pas créés
- Vérifiez les logs Strapi pour les erreurs
- Vérifiez que `pinterestAutoPublish` est activé sur la recette
- Vérifiez que la recette est publiée (`publishedAt` défini)
- Vérifiez que l'image principale est bien uploadée
