# Authentification Admin

## Fonctionnement

L'accès admin repose sur une **session côté serveur** :

1. Sur `/admin`, vous saisissez le secret. Il est envoyé à `POST /api/admin/session` et vérifié **côté serveur**
   (comparaison à temps constant, 5 tentatives échouées maximum par IP sur 15 minutes).
2. Si le secret est correct, le serveur pose un cookie `admin_session` : `HttpOnly`, `Secure` (en production),
   `SameSite=Strict`, valable **8 heures**. Il contient uniquement une date d'expiration et une signature HMAC,
   jamais le secret.
3. Toutes les routes sensibles vérifient ce cookie (`requireAdmin` dans `frontend/lib/admin-session.ts`) :
   génération et import de recettes, Pinterest/Instagram (file d'attente, stats, stratégie), avis, transcription vocale.

Le secret n'est **jamais** envoyé au navigateur. L'ancienne variable `NEXT_PUBLIC_ADMIN_SECRET` est supprimée : son
préfixe `NEXT_PUBLIC_` l'intégrait au JavaScript public, donc lisible par tous les visiteurs.

## Configuration

Définir `ADMIN_SECRET` (variable **serveur**, sans préfixe `NEXT_PUBLIC_`).

- **Développement** : dans `frontend/.env.local`
  ```env
  ADMIN_SECRET=votre_secret_ici
  ```
- **Production (Docker Compose)** : dans le fichier `.env` à la racine du projet (à côté de `docker-compose.yml`).
  Il est transmis au conteneur frontend à l'exécution.
  ```env
  ADMIN_SECRET=votre_secret_ici
  ```
  Puis :
  ```bash
  docker compose build frontend
  docker compose up -d
  ```

Sans `ADMIN_SECRET`, tout l'accès admin est refusé.

### Générer un secret

```bash
openssl rand -base64 32
```

### Changer le secret

Modifier `ADMIN_SECRET` puis redémarrer le conteneur frontend : toutes les sessions en cours sont invalidées.
**Si vous utilisiez `NEXT_PUBLIC_ADMIN_SECRET`, choisissez une valeur différente** : l'ancienne était lisible
dans le JavaScript public et doit être considérée comme compromise.

## Déconnexion

La session expire au bout de 8 heures. Pour la révoquer immédiatement, changer `ADMIN_SECRET` et redémarrer le frontend.

## Limites connues

- La limitation de tentatives est en mémoire (une seule instance frontend) : elle est remise à zéro au redémarrage.
- `/api/tts/step` (voix de la Nonna) reste public, car le mode cuisine l'utilise pour tous les visiteurs.
