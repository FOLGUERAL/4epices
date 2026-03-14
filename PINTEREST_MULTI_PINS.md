# Automatisation Pinterest - Multi-pins par recette

## 🎯 Fonctionnalités

Le système permet maintenant de créer **3 pins Pinterest automatiquement** pour chaque recette, avec :
- ✅ **Images multiples** : Utilisation de `imagesPinterest` ou répétition de `imagePrincipale`
- ✅ **Contenu varié** : Titres et descriptions différents pour chaque pin
- ✅ **Boards multiples** : Mapping automatique catégorie → board Pinterest
- ✅ **Rate limiting** : Délai de 5 minutes entre chaque pin (respect des limites Pinterest)
- ✅ **Queue automatique** : Les pins sont planifiés et créés progressivement

## 📋 Configuration

### 1. Schéma de données

#### Recette
- **`imagesPinterest`** (nouveau) : Champ média multiple pour les images dédiées Pinterest
- **`pinterestPins`** (nouveau) : JSON stockant tous les pins créés
- **`pinterestPinId`** (conservé) : Compatibilité avec l'ancien système (premier pin)

#### Catégorie
- **`pinterestBoardId`** (nouveau) : ID du board Pinterest associé à la catégorie

### 2. Variables d'environnement

```env
# Token Pinterest (OAuth ou statique)
PINTEREST_ACCESS_TOKEN=votre_token

# Board par défaut (fallback si aucune catégorie n'a de board)
PINTEREST_BOARD_ID=votre_board_id

# URL du frontend
FRONTEND_URL=https://4epices.fr

# API Pinterest (production ou sandbox)
PINTEREST_USE_SANDBOX=false  # false pour production
```

### 3. Configuration des catégories

Pour chaque catégorie, vous pouvez définir un board Pinterest spécifique :

1. Aller dans **Content Manager > Catégories**
2. Éditer une catégorie
3. Remplir le champ **`pinterestBoardId`** avec l'ID du board Pinterest
4. Si non défini, le système utilisera `PINTEREST_BOARD_ID` par défaut

#### 🔍 Comment récupérer le Board ID depuis l'URL ?

**Méthode 1 : Script automatique (recommandé)**

```bash
# Depuis le dossier backend
node scripts/get-pinterest-board-id.js "https://www.pinterest.fr/username/board-name/"

# Ou lister tous vos boards
node scripts/get-pinterest-board-id.js --list

# Ou avec username et board name
node scripts/get-pinterest-board-id.js --username username --board "board name"
```

Le script affichera le Board ID à copier dans votre configuration.

**Méthode 2 : Via l'API Pinterest**

1. Aller sur https://developers.pinterest.com/tools/api-explorer/
2. Utiliser l'endpoint `GET /v5/boards`
3. Trouver votre board dans la liste et copier son `id`

**Méthode 3 : Depuis le code (programmatique)**

```javascript
const { getBoardIdFromUrl } = require('./src/utils/pinterestBoardHelper');

const result = await getBoardIdFromUrl('https://www.pinterest.fr/username/board-name/');
console.log('Board ID:', result.boardId);
```

## 🚀 Utilisation

### Publication automatique

1. **Créer/éditer une recette** dans Strapi
2. **Ajouter des images** dans le champ `imagesPinterest` (optionnel, sinon l'image principale sera utilisée)
3. **Activer** `pinterestAutoPublish`
4. **Publier** la recette

Le système créera automatiquement :
- **Pin #0** : Immédiatement à la publication
- **Pin #1** : Planifié dans 5 minutes
- **Pin #2** : Planifié dans 10 minutes

### Images disponibles

Le système utilise les images dans cet ordre de priorité :

1. **`imagesPinterest`** : Si des images sont définies, elles sont utilisées
2. **`imagePrincipale`** : Si pas assez d'images Pinterest, l'image principale est répétée

**Exemple** :
- Si vous avez 2 images dans `imagesPinterest` : Pin #0 = image 1, Pin #1 = image 2, Pin #2 = image 1 (répétée)
- Si vous n'avez que `imagePrincipale` : Les 3 pins utiliseront la même image

### Variations de contenu

Chaque pin a un contenu légèrement différent :

- **Pin #0** : Titre original + Description originale (générée par Groq si disponible)
- **Pin #1** : "Recette de [titre]" + Description avec emoji ⏱️ temps
- **Pin #2** : "Comment faire [titre]" + Description avec emoji 👥 nombre de personnes

## ⚙️ Système de queue

Les pins planifiés sont gérés par une **queue en mémoire** :

- **Cron job toutes les 5 minutes** : Traite une tâche à la fois
- **Retry automatique** : 3 tentatives maximum en cas d'échec
- **Nettoyage automatique** : Les tâches expirées (>24h) sont supprimées

### Structure des données

Les pins créés sont stockés dans `pinterestPins` (JSON) :

```json
{
  "pin_id_1": {
    "imageUrl": "https://...",
    "pinIndex": 0,
    "boardId": "board_123",
    "createdAt": "2024-01-01T12:00:00.000Z"
  },
  "pin_id_2": {
    "imageUrl": "https://...",
    "pinIndex": 1,
    "boardId": "board_123",
    "createdAt": "2024-01-01T12:05:00.000Z"
  }
}
```

## 📊 Cron jobs

### Toutes les 5 minutes
Traite la queue de pins planifiés (1 pin à la fois pour respecter le rate limiting)

### Toutes les heures
Vérifie les recettes publiées sans pins et les traite automatiquement

## 🔧 Services disponibles

### `api::recette.pinterest`

- **`createMultiplePins(recette, options)`** : Créer plusieurs pins
  ```javascript
  await pinterestService.createMultiplePins(recette, {
    pinsCount: 3,
    delayBetweenPins: 5 * 60 * 1000, // 5 minutes
    boardId: 'optional_board_id'
  });
  ```

- **`createPinFromImage(recette, imageUrl, pinIndex, boardId)`** : Créer un pin spécifique

- **`getImagesForPins(recetteData)`** : Récupérer toutes les images disponibles

### `api::recette.pinterest-queue`

- **`addPinTask(task)`** : Ajouter une tâche à la queue
- **`getReadyTasks()`** : Récupérer les tâches prêtes
- **`processTask(task)`** : Traiter une tâche
- **`cleanup()`** : Nettoyer les tâches expirées

### `utils/pinterestBoardMapper`

- **`getBoardIdForRecette(strapi, recette)`** : Récupérer le board ID pour une recette

## ⚠️ Limitations Pinterest

- **Rate limiting** : Maximum ~12 pins/heure par compte
- **Délai recommandé** : 5 minutes minimum entre chaque pin
- **Images** : Format JPG/PNG, ratio 2:3 recommandé (1000x1500px)

## 🐛 Dépannage

### Les pins ne sont pas créés

1. Vérifier que `pinterestAutoPublish` est activé
2. Vérifier que la recette est publiée (`publishedAt` défini)
3. Vérifier les logs Strapi pour les erreurs
4. Vérifier que le token Pinterest est valide
5. Vérifier que le board ID est configuré (catégorie ou variable d'environnement)

### Les pins planifiés ne sont pas créés

1. Vérifier que le cron job fonctionne (logs toutes les 5 minutes)
2. Vérifier les logs pour les erreurs de traitement
3. Vérifier que le serveur n'a pas été redémarré (queue en mémoire)

### Erreur "Board ID manquant"

1. Ajouter un `pinterestBoardId` à une catégorie de la recette
2. Ou configurer `PINTEREST_BOARD_ID` dans les variables d'environnement

## 📝 Notes

- La queue est **en mémoire** : Les tâches sont perdues si le serveur redémarre
- Pour une solution plus robuste, envisager d'utiliser **Bull/Redis** (phase 3)
- Le système est **rétrocompatible** : L'ancien champ `pinterestPinId` est toujours utilisé
