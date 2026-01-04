# Guide des Fichiers à Committer

## ✅ Fichiers à COMMITTER (Important)

### Structure du projet
```
├── backend/
│   ├── config/              ✅ Configuration (database, server, middlewares, etc.)
│   ├── src/                 ✅ Code source (API, controllers, services, etc.)
│   ├── public/              ✅ Dossier public (avec .gitkeep)
│   ├── package.json         ✅ Dépendances
│   ├── Dockerfile           ✅ Configuration Docker
│   └── .gitignore           ✅ Fichier gitignore
│
├── frontend/
│   ├── app/                 ✅ Pages et composants
│   ├── lib/                 ✅ Utilitaires
│   ├── package.json         ✅ Dépendances
│   ├── tsconfig.json        ✅ Configuration TypeScript
│   ├── next.config.js       ✅ Configuration Next.js
│   ├── tailwind.config.ts   ✅ Configuration Tailwind
│   ├── postcss.config.js    ✅ Configuration PostCSS
│   └── Dockerfile           ✅ Configuration Docker
│
├── .gitignore               ✅ Fichier gitignore racine
├── docker-compose.yml       ✅ Configuration Docker Compose
├── README.md                ✅ Documentation
├── INSTALLATION.md          ✅ Guide d'installation
├── QUICK_START.md           ✅ Guide de démarrage rapide
├── DEPLOYMENT.md            ✅ Guide de déploiement
├── PERMISSIONS.md           ✅ Guide des permissions
└── NOTES_PINTEREST.md       ✅ Notes Pinterest
```

## ❌ Fichiers à NE PAS COMMITTER

### Fichiers de configuration locale
- `backend/.env` ❌ (contient les secrets)
- `frontend/.env.local` ❌ (contient les variables locales)
- `frontend/.env.production` ❌ (contient les secrets de production)

### Fichiers générés
- `backend/node_modules/` ❌
- `backend/.tmp/` ❌ (base de données SQLite, cache)
- `backend/build/` ❌
- `backend/.cache/` ❌
- `frontend/node_modules/` ❌
- `frontend/.next/` ❌
- `frontend/out/` ❌

### Fichiers de base de données
- `*.db` ❌
- `*.sqlite` ❌
- `*.sqlite3` ❌

### Autres
- `.DS_Store` ❌ (macOS)
- `*.log` ❌

## 📝 Fichiers d'exemple à COMMITTER

Ces fichiers servent de modèles :
- `backend/config/env.example` ✅
- `frontend/.env.example` ✅ (si vous l'avez créé)

## 🔐 Sécurité : Vérifications avant de commit

Avant de faire votre premier commit, vérifiez que vous n'avez **PAS** de fichiers sensibles :

```bash
# Vérifier les fichiers qui seront commités
git status

# Vérifier qu'il n'y a pas de .env dans le commit
git ls-files | grep -E "\.env$"

# Vérifier qu'il n'y a pas de mots de passe en clair
git grep -i "password" -- "*.js" "*.ts" "*.json"
```

## 📦 Commandes Git Recommandées

### Premier commit
```bash
# Initialiser le repo (si pas déjà fait)
git init

# Ajouter tous les fichiers sauf ceux dans .gitignore
git add .

# Vérifier ce qui sera commité
git status

# Premier commit
git commit -m "Initial commit: Setup Strapi + Next.js pour 4épices"

# Ajouter le remote
git remote add origin <votre-repo-url>

# Push
git push -u origin main
```

### Commits suivants
```bash
# Voir les changements
git status

# Ajouter les fichiers modifiés
git add .

# Commit avec message descriptif
git commit -m "Description des changements"

# Push
git push
```

## ⚠️ Si vous avez déjà commité des fichiers sensibles

Si vous avez accidentellement commité un fichier `.env` :

```bash
# Retirer le fichier de Git (mais le garder localement)
git rm --cached backend/.env
git rm --cached frontend/.env.local

# Ajouter à .gitignore (si pas déjà fait)
echo "backend/.env" >> .gitignore
echo "frontend/.env.local" >> .gitignore

# Commit la correction
git add .gitignore
git commit -m "Remove sensitive files from git"

# Si déjà pushé, vous devrez régénérer vos secrets
```

## 📋 Checklist avant le premier commit

- [ ] Vérifier que `backend/.env` n'est PAS dans git
- [ ] Vérifier que `frontend/.env.local` n'est PAS dans git
- [ ] Vérifier que `node_modules/` n'est PAS dans git
- [ ] Vérifier que les fichiers `.db` ou `.sqlite` n'y sont PAS
- [ ] Vérifier que tous les fichiers de config sont présents
- [ ] Vérifier que la documentation est à jour
- [ ] Vérifier que `.gitignore` est correct

## 🎯 Fichiers essentiels à vérifier

### Backend
- ✅ `backend/config/` - Toute la configuration
- ✅ `backend/src/` - Tout le code source
- ✅ `backend/package.json` - Dépendances
- ✅ `backend/Dockerfile` - Docker
- ✅ `backend/config/env.example` - Exemple de configuration

### Frontend
- ✅ `frontend/app/` - Pages Next.js
- ✅ `frontend/lib/` - Utilitaires
- ✅ `frontend/package.json` - Dépendances
- ✅ `frontend/tsconfig.json` - Config TypeScript
- ✅ `frontend/next.config.js` - Config Next.js

### Racine
- ✅ `docker-compose.yml`
- ✅ `README.md`
- ✅ Tous les fichiers `.md` de documentation
- ✅ `.gitignore`

