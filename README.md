# 4épices - Site de Recettes Culinaires

Site de recettes culinaires avec automatisation Pinterest et planification de contenu.

## Architecture

- **Backend** : Strapi (CMS headless)
- **Frontend** : Next.js 14 (App Router)
- **Base de données** : SQLite (développement) / PostgreSQL (production)

## Prérequis

- Node.js 18+ 
- npm ou yarn ou pnpm
- PostgreSQL (optionnel, SQLite par défaut pour le développement)

## Installation Rapide

Voir le fichier [INSTALLATION.md](./INSTALLATION.md) pour les instructions détaillées.

### Résumé

1. **Backend** :
   ```bash
   cd backend
   npm install
   cp config/env.example .env
   # Configurer .env avec vos clés
   npm run develop
   ```

2. **Frontend** :
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   npm run dev
   ```

## Configuration

1. Copier les fichiers `.env.example` en `.env` dans chaque dossier
2. Configurer les variables d'environnement
3. Pour Strapi : créer un compte admin à la première connexion
4. Pour Pinterest : configurer les tokens API dans `.env`

## Déploiement

Voir les fichiers Docker (docker-compose.yml) pour le déploiement sur VPS.

## Fonctionnalités

- ✅ Gestion des recettes via Strapi (interface admin complète)
- ✅ Site frontend avec Next.js 14 (App Router)
- ✅ Automatisation Pinterest (cron job + publication manuelle)
- ✅ Planification de contenu (via date de publication)
- ✅ SEO optimisé (métadonnées, URLs propres)
- ✅ Responsive design (Tailwind CSS)
