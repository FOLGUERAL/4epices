# Analyse de l'intégration Pinterest - 4épices

## 📊 État Actuel de l'Intégration

### ✅ Backend (Strapi) - Ce qui est déjà en place

#### 1. Service Pinterest (`backend/src/api/recette/services/pinterest.js`)
- ✅ Service complet pour créer des pins Pinterest via l'API v5
- ✅ Récupération automatique de l'URL de l'image depuis Strapi
- ✅ Gestion des différentes formats de données Strapi (avec/sans attributes)
- ✅ Gestion des erreurs avec logs détaillés
- ✅ Respect des limites Pinterest (titre: 100 chars, description: 800 chars)

#### 2. Controller (`backend/src/api/recette/controllers/recette.js`)
- ✅ Méthode `publishToPinterest()` pour publication manuelle
- ✅ Publication automatique lors de la création si `pinterestAutoPublish` est activé
- ✅ Mise à jour du `pinterestPinId` après publication réussie
- ✅ Gestion d'erreurs gracieuse (ne fait pas échouer la création de recette)

#### 3. Lifecycles (`backend/src/api/recette/content-types/recette/lifecycles.js`)
- ✅ Publication automatique lors de la création/mise à jour
- ✅ Conditions : `pinterestAutoPublish: true`, `publishedAt` défini, `pinterestPinId` vide
- ✅ Génération automatique des metaTitle et metaDescription
- ✅ Détection de l'activation de `pinterestAutoPublish` lors d'une modification (comparaison avec l'état précédent)
- ✅ S'assure que tous les tags liés sont publiés automatiquement

#### 4. Cron Job (`backend/config/cron-tasks.js`)
- ✅ Vérification toutes les heures des recettes à publier
- ✅ Filtrage des recettes : publiées, auto-publish activé, sans pin existant
- ✅ Gestion d'erreurs par recette (ne bloque pas les autres)

#### 5. Schéma de Données
- ✅ Champ `pinterestPinId` (string) pour stocker l'ID du pin créé
- ✅ Champ `pinterestAutoPublish` (boolean) pour activer la publication automatique
- ✅ Champs `metaTitle` et `metaDescription` pour optimiser le contenu Pinterest

#### 6. Route API Personnalisée
- ✅ **IMPLÉMENTÉ** : La route `/api/recettes/:id/publish-pinterest` est maintenant disponible
- ✅ La méthode `publishToPinterest` est accessible via une route dédiée dans `backend/src/api/recette/routes/recette.js`

#### 7. Interface Strapi Admin
- ✅ Champ checkbox `pinterestAutoPublish` disponible dans le formulaire
- ✅ Publication automatique fonctionne lors de la création ET de la modification
- ✅ Route API disponible pour publication manuelle depuis scripts/externe

### ✅ Frontend (Next.js) - Ce qui est déjà en place

#### 1. Composant ShareRecipe (`frontend/components/ShareRecipe.tsx`)
- ✅ Bouton de partage Pinterest (via URL Pinterest standard, pas via votre API)
- ✅ Intégré dans les pages de recettes pour partage utilisateur
- ✅ Autres réseaux : Facebook, Twitter, WhatsApp, Email

#### 2. Configuration Next.js
- ✅ Domaine Pinterest autorisé dans `next.config.js`
- ✅ Image optimization configurée

---

## 🚧 Ce qui reste à faire

### 🔴 Priorité Haute

#### 1. Route API Manquante

La méthode `publishToPinterest` existe dans le controller mais n'est pas accessible via une route dédiée. Il faut créer une route personnalisée.

**Fichier à modifier :** `backend/src/api/recette/routes/recette.js`

**Code actuel :**
```javascript
module.exports = createCoreRouter('api::recette.recette', {
  config: {
    find: { middlewares: [] },
    findOne: { middlewares: [] },
    create: { middlewares: [] },
    update: { middlewares: [] },
    delete: { middlewares: [] },
  },
});
```

**Code implémenté :**
```javascript
// backend/src/api/recette/routes/recette.js
const defaultRouter = createCoreRouter('api::recette.recette', { ... });

const customRoutes = {
  routes: [
    {
      method: 'POST',
      path: '/recettes/:id/publish-pinterest',
      handler: 'recette.publishToPinterest',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

module.exports = {
  routes: [...defaultRouter.routes, ...customRoutes.routes],
};
```

**Utilisation :**
```bash
POST http://localhost:1337/api/recettes/:id/publish-pinterest
Authorization: Bearer <admin_token>
```

✅ **IMPLÉMENTÉ** - Route disponible et fonctionnelle

### 🟡 Priorité Moyenne

#### 2. Interface Strapi Admin

Ajouter un bouton "Publier sur Pinterest" dans l'interface d'édition des recettes.

**Options possibles :**

**Option A : Plugin personnalisé Strapi**
- Créer un plugin Strapi avec un composant injecté dans l'édition
- Plus complexe, nécessite une connaissance approfondie de l'API Strapi
- Avantage : Intégration native dans l'interface Strapi

**Option B : Action personnalisée via l'API**
- Utiliser l'API REST depuis un script/interface externe
- Plus simple, mais nécessite une interface externe
- Avantage : Plus rapide à implémenter

**Option C : Utiliser le champ existant**
- Garder uniquement le champ `pinterestAutoPublish`
- Publier manuellement via la route API (une fois implémentée)
- Avantage : Aucun développement supplémentaire

**Recommandation :** Option C pour l'instant, Option A plus tard si besoin.

#### 3. Améliorations Frontend

- ✅ Bouton "Publier sur Pinterest" sur la page de recette (`/recettes/[slug]`)
  - Composant `PublishPinterestButton` qui permet de publier depuis le frontend
  - Route API `/api/publish-pinterest` qui appelle l'API Strapi
  - Affichage du statut de publication (succès/échec) via toasts

- ✅ Affichage du statut Pinterest sur la page de recette
  - Composant `PinterestBadge` qui affiche un badge si `pinterestPinId` existe
  - Lien direct vers le pin Pinterest (format: `https://www.pinterest.fr/pin/{pinId}/`)
  - Badge affiché sous la description de la recette

- [ ] Tableau de bord Pinterest (optionnel, futur)
  - Statistiques des pins créés
  - Gestion des pins (re-publier, supprimer)

### 🟢 Priorité Basse

#### 4. Tests et Documentation

- [ ] Tests unitaires pour le service Pinterest
- [ ] Tests d'intégration pour la route API
- [ ] Documentation utilisateur complète
- [ ] Gestion d'erreurs côté frontend plus détaillée

---

## 📝 Configuration Requise

### Variables d'Environnement (`backend/.env`)

```env
# Pinterest API
PINTEREST_ACCESS_TOKEN=votre_token
PINTEREST_BOARD_ID=votre_board_id

# URL du frontend (doit être publique en production)
FRONTEND_URL=http://localhost:3000  # En production : https://4epices.fr
```

### Restrictions Pinterest

⚠️ **Important :** Pinterest refuse les requêtes depuis `localhost` en production.

**Pour le développement :**
- Utiliser un tunnel (ngrok, localtunnel) pour exposer votre site publiquement
- Ou attendre le déploiement en production

**Pour la production :**
- ✅ Site accessible publiquement (pas localhost)
- ✅ HTTPS obligatoire
- ✅ Application Pinterest approuvée
- ✅ URLs autorisées dans les paramètres Pinterest
- ✅ Politique de confidentialité accessible

Voir `NOTES_PINTEREST.md` pour plus de détails.

---

## 🔄 Flux de Publication

### Publication Automatique

1. **Création/Mise à jour de recette** dans Strapi Admin
2. **Activation** du champ `pinterestAutoPublish`
3. **Publication** de la recette (`publishedAt` défini)
4. **Lifecycle hook** se déclenche automatiquement
5. **Service Pinterest** crée le pin
6. **Mise à jour** de la recette avec `pinterestPinId`

### Publication Manuelle (via Route API - une fois implémentée)

1. **Requête POST** vers `/api/recettes/:id/publish-pinterest`
2. **Controller** récupère la recette
3. **Service Pinterest** crée le pin
4. **Mise à jour** de la recette avec `pinterestPinId`
5. **Retour** des données du pin créé

### Vérification Cron Job

1. **Toutes les heures**, le cron job s'exécute
2. **Filtrage** des recettes :
   - `publishedAt` défini
   - `pinterestAutoPublish: true`
   - `pinterestPinId` vide
3. **Création** des pins pour chaque recette trouvée
4. **Mise à jour** de chaque recette avec `pinterestPinId`

---

## 📚 Documentation Référence

- `NOTES_PINTEREST.md` : Détails sur les restrictions et solutions
- `INSTALLATION.md` : Guide d'installation avec configuration Pinterest
- `QUICK_START.md` : Démarrage rapide avec Pinterest
- `backend/src/api/recette/services/pinterest.js` : Code source du service

---

## ✅ Checklist de Déploiement

- [x] Route API `/publish-pinterest` implémentée
- [ ] Variables d'environnement configurées
- [ ] Application Pinterest créée et approuvée
- [ ] URLs autorisées dans Pinterest
- [ ] HTTPS configuré en production
- [ ] Politique de confidentialité accessible
- [ ] Tests de publication effectués
- [x] Cron job fonctionnel vérifié
- [x] Bouton de publication frontend implémenté
- [x] Badge Pinterest sur la page de recette implémenté
- [x] Publication automatique lors de la modification fonctionnelle

---

## 📦 Fichiers Créés/Modifiés

### Backend
- ✅ `backend/src/api/recette/routes/recette.js` - Route API personnalisée ajoutée
- ✅ `backend/src/api/recette/controllers/recette.js` - Gestion des tags automatique améliorée
- ✅ `backend/src/api/recette/content-types/recette/lifecycles.js` - Détection de l'activation de `pinterestAutoPublish` lors de la modification
- ✅ `backend/src/api/tag/content-types/tag/lifecycles.js` - Publication automatique des tags

### Frontend
- ✅ `frontend/components/PinterestBadge.tsx` - Composant pour afficher le statut Pinterest
- ✅ `frontend/components/PublishPinterestButton.tsx` - Composant bouton pour publier sur Pinterest
- ✅ `frontend/app/api/publish-pinterest/route.ts` - Route API frontend pour publier sur Pinterest
- ✅ `frontend/app/recettes/[slug]/page.tsx` - Badge et bouton Pinterest ajoutés
- ✅ `frontend/lib/strapi.ts` - Type Recette mis à jour avec `pinterestPinId` et `pinterestAutoPublish`

**Date de l'analyse :** 2024-12-19  
**Date de mise à jour :** 2024-12-20  
**Statut global :** 🟢 Fonctionnel (route API et interface frontend implémentées, interface admin Strapi optionnelle via champ checkbox)
