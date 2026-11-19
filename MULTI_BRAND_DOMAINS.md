# Multi-marque par domaine (4epices.fr + futur domaine)

> Document de référence, à relire avant de coder. Pas encore implémenté : c'est un audit +
> un plan, pour pouvoir changer de nom de domaine (ou en ajouter un deuxième) sans tout
> redécouvrir. Dernière mise à jour de l'audit : 2026-10-02 (recherche faite sur `frontend/`).

## Objectif

Un seul déploiement Next.js, une seule base Strapi, mais une identité de marque différente
selon le nom de domaine d'accès (logo, favicon, nom de marque dans les textes/meta/JSON-LD,
copyright). Le contenu des recettes (Strapi) n'est jamais concerné — uniquement l'identité
visuelle et textuelle du template.

## Architecture proposée

### `lib/branding.ts` (nouveau)

```ts
export interface Brand {
  siteName: string;
  logoPath: string;
  faviconPath: string;
  ogSiteName: string;
}

const BRANDS: Record<string, Brand> = {
  '4epices.fr': {
    siteName: '4 épices',
    logoPath: '/logo.png',
    faviconPath: '/logo_carre_favicon.png',
    ogSiteName: '4 épices',
  },
  // 'nouveaudomaine.fr': { siteName: 'NouveauNom', logoPath: '/logo-nouveau.png', ... },
};

const DEFAULT_BRAND = BRANDS['4epices.fr'];

/** Enlève www. et le port éventuel avant de chercher — un hostname brut de header Host peut avoir les deux. */
export function getBrand(hostname: string | null | undefined): Brand {
  if (!hostname) return DEFAULT_BRAND;
  const normalized = hostname.replace(/^www\./, '').split(':')[0].toLowerCase();
  return BRANDS[normalized] || DEFAULT_BRAND;
}
```

### Comment lire le domaine par requête

Deux options, avec un vrai compromis entre elles — à trancher avant de coder :

| Option | Avantage | Inconvénient |
|---|---|---|
| **`headers()` direct dans les Server Components** (`next/headers`) | Simple, pas de fichier middleware à maintenir | Il faut appeler `getBrand(headers().get('host'))` à chaque endroit qui en a besoin |
| **Middleware Next.js** (`middleware.ts`) qui lit le Host et pose un header custom (`x-brand-id`) | Un seul endroit qui décide, logique de normalisation centralisée, prêt si un jour il faut aussi rediriger `www.` ou un domaine inconnu | Une brique de plus à écrire et tester |

**Recommandation** : commencer par `headers()` direct (plus simple), migrer vers le middleware
seulement si un besoin de redirection/normalisation apparaît. Dans les deux cas, **résoudre la
marque une seule fois dans `app/layout.tsx`** (Server Component racine) et la redescendre :
- aux Server Components enfants directement (ils peuvent aussi appeler `headers()` eux-mêmes,
  mais le faire une fois en haut évite la répétition) ;
- aux Client Components (`BottomTabBar`, etc.) via prop ou Context React — eux ne peuvent pas
  appeler `headers()` (API serveur uniquement).

**Bonne nouvelle constatée à l'audit** : `components/Navigation.tsx` et
`components/FooterCategories.tsx` (où vit le logo et une partie du texte de marque) ne sont
**pas** `'use client'` — ce sont déjà des Server Components. Ils pourront appeler `getBrand()`
directement sans prop-drilling.

## Audit réel des occurrences en dur (recherché le 2026-10-02)

### Nom de marque (« 4 épices » / « 4épices » / « 4Épices »)

| Fichier | Ligne | Contenu actuel | Action |
|---|---|---|---|
| `lib/seo.ts` | 4 | `export const SITE_NAME = '4 épices';` | Devient dérivé de `getBrand(hostname).siteName`, plus une constante statique |
| `lib/seo.ts` | 26, 40 | `alternateName: ['4épices', '4epices']` (Organization + WebSite JSON-LD) | À paramétrer par marque, ou à accepter comme alias génériques si les deux marques partagent un historique — **à décider** |
| `app/layout.tsx` | 27, 31, 38-39, 52, 56, 62 | `applicationName`, `appleWebApp.title: "4epices"`, `title.default/template`, `openGraph.siteName`, `openGraph/twitter.title` — tous via `SITE_NAME`, sauf la ligne 31 qui est un literal `"4epices"` en dur | Migrer tout le bloc `export const metadata` vers `export async function generateMetadata()` (seule façon de varier par requête) ; corriger le literal ligne 31 |
| `app/layout.tsx` | 113 | `© {new Date().getFullYear()} {SITE_NAME}. Tous droits réservés.` | Déjà via `SITE_NAME` → suit automatiquement une fois `SITE_NAME` dynamique |
| `app/manifest.ts` | 5-6 | `name: '4epices'`, `short_name: '4epices'` | **Limite réelle** : `manifest.ts` est un fichier statique Next.js, pas une fonction par requête — impossible de le varier par Host avec l'API actuelle. À garder générique, ou à dupliquer en deux fichiers de manifeste si un jour c'est bloquant (PWA par domaine) |
| `components\HowItWorks.tsx` | 26 | `"...laissez 4épices remplir les soirs libres..."` | Remplacer par `${brand.siteName}` |
| `lib\planning.ts` | 363 | `` `Recette ${entry.titre} sur 4épices` `` (description d'événement calendrier) | Remplacer — nécessite de faire descendre `brand` jusqu'à cette fonction pure (actuellement sans dépendance à la marque) |
| `components\WeekCalendar.tsx` | 163 | `calendarName: 'Menu de la semaine 4épices'` | Idem |
| `app\api\recipe\ingest\route.ts` | 289 | `'Recette \| 4 épices'` (titre de repli) | Remplacer — cette route API n'a pas directement accès à `headers()` de la requête page, mais a sa propre requête : `request.headers.get('host')` fonctionne pareil dans un Route Handler |
| `app\politique-de-confidentialite\page.tsx` | 77, 79 | `4Épices participe au Programme Partenaires...` | Remplacer — **mais voir la réserve légale ci-dessous** |
| `components\UstensilesList.tsx` | 26 | `En tant que Partenaire Amazon, 4Épices réalise un bénéfice...` | Remplacer |
| `public\placeholder-recipe.svg` | 15 | Texte `4épices` dessiné en dur dans un SVG statique | Pas un composant React — soit un SVG par marque, soit laisser générique (c'est un visuel de repli, impact mineur) |

### Logo / favicon

| Fichier | Ligne | Contenu actuel | Action |
|---|---|---|---|
| `app/layout.tsx` | 47-49 | `icon/shortcut/apple: "/logo_carre_favicon.png"` (dans `export const metadata`, donc statique) | Passe par `generateMetadata()` avec `brand.faviconPath` |
| `components/Navigation.tsx` | ~ligne avec `src="/logo.png"` | Logo codé en dur | Remplacer par `brand.logoPath` |
| `lib/seo.ts` | 28 | `` logo: `${siteUrl}/logo.png` `` (Organization JSON-LD) | Remplacer par `brand.logoPath` |
| `app/manifest.ts` | icons | `/icons/icon-192.png`, `/icons/icon-512.png` | Même limite que le nom : fichier statique, pas par requête |

### Domaine en dur (`4epices.fr` littéral, pas via env var)

| Fichier | Contenu | Remarque |
|---|---|---|
| `next.config.js:22` | `hostname: 'api.4epices.fr'` | **Ne pas toucher** — c'est le domaine de l'API Strapi, fixe quel que soit le domaine du frontend (l'énoncé le confirme : « les deux domaines pointeront vers... la même base Strapi ») |
| `lib/seo.ts:8` | `process.env.NEXT_PUBLIC_SITE_URL \|\| 'https://4epices.fr'` | Repli uniquement — la vraie valeur vient de l'env var au build, voir limite ci-dessous |
| `app/politique-de-confidentialite/page.tsx` (lignes 26, 81, 178, 181) | Domaine + email de contact en dur | Voir réserve légale |

## Limite importante au-delà du simple remplacement de texte

`app/sitemap.ts` et `app/robots.ts` lisent `process.env.NEXT_PUBLIC_SITE_URL` — une variable
d'environnement **figée au build**, donc par construction une seule valeur pour tout le
déploiement. Si demain les deux domaines doivent chacun avoir leur propre sitemap/robots avec
leur propre URL de base, ces deux fichiers devront aussi lire le Host de la requête (même
mécanisme que `getBrand`) plutôt que cette variable — sans quoi le sitemap annoncera toujours
le même domaine pour les deux marques.

## Cache ISR/CDN : ce qui a été vérifié

Pas de CDN ni de cache HTTP devant l'app actuellement (vérifié dans `DEPLOYMENT.md` : nginx
sert de reverse proxy simple, aucune zone `proxy_cache` configurée). Le seul cache à surveiller
est donc celui de Next.js lui-même :

- **Bonne nouvelle** : dans l'App Router, appeler `headers()` dans un Server Component **force
  automatiquement cette route en rendu dynamique** (Next.js désactive de lui-même le Full Route
  Cache dès qu'une route lit les en-têtes de la requête). Concrètement : si `getBrand()` est
  appelé (directement ou via le layout) sur une page, cette page ne sera jamais mise en cache
  statique partagée entre les deux domaines — c'est exactement la garantie demandée.
- **Point de vigilance** : les données Strapi elles-mêmes (`fetch` avec `revalidate: 300`,
  utilisé dans `lib/strapi.ts`) restent cachées par URL d'API, indépendamment du domaine
  frontend — c'est voulu, puisque les deux domaines partagent la même base Strapi. Seul le
  **rendu HTML** (qui contient le nom/logo de marque) doit varier, pas les données sources.
- **Si un CDN est ajouté plus tard** (Cloudflare, etc.) : vérifier explicitement que sa clé de
  cache inclut le `Host`, pas seulement le chemin — sinon le problème décrit dans la demande
  (page mise en cache sous un domaine, servie avec la mauvaise marque sur l'autre) peut
  réapparaître à ce niveau-là, hors de portée du code Next.js.

## Hors de portée volontaire : la page légale

`app/politique-de-confidentialite/page.tsx` contient non seulement le nom de marque mais aussi
l'email de contact (`contact@4epices.fr`) et l'adresse du site en dur, utilisés comme
identifiants légaux (mentions, RGPD). Si les deux domaines représentent la même société avec
juste un nom commercial différent, remplacer le texte de marque suffit. Si un jour un second
domaine correspond à une entité légale différente (SIRET, contact, hébergeur différents), cette
page aura besoin de son propre contenu complet par marque, pas juste d'un nom substitué — **à
trancher au moment de l'implémentation**, pas anticipé ici.

## Plan de mise en œuvre suggéré (à confirmer avant de coder)

1. **`lib/branding.ts`** : `BRANDS`, `getBrand()`, tests unitaires (`lib/__tests__/branding.test.ts`)
2. **`app/layout.tsx`** : migrer `export const metadata` → `export async function generateMetadata()` lisant `headers()` ; injecter `brand.faviconPath`/`brand.siteName`/`brand.ogSiteName`
3. **`lib/seo.ts`** : `SITE_NAME` devient un paramètre des fonctions `buildOrganizationJsonLd`/`buildWebSiteJsonLd` (ou elles acceptent un `Brand` complet) au lieu d'une constante module-level
4. **Propagation** : `Navigation.tsx`, `FooterCategories.tsx` appellent `getBrand()` directement (Server Components) ; `lib/planning.ts`/`WeekCalendar.tsx` reçoivent `brand.siteName` en paramètre plutôt que de l'importer en dur
5. **Remplacement des occurrences du tableau d'audit ci-dessus**, une par une, en vérifiant chaque fois le rendu réel
6. **Décision sur la page légale** (voir section dédiée)
7. **Vérification manuelle finale** : ouvrir le site via les deux noms de domaine (configurés en local via `/etc/hosts` ou équivalent) et comparer visuellement logo/titre/favicon/JSON-LD

## Questions ouvertes à trancher avant de coder

- Les deux marques doivent-elles avoir des `manifest.ts`/icônes PWA différents ? (limite technique documentée plus haut si oui)
- `alternateName` du JSON-LD Organization/WebSite : alias partagés ou propres à chaque marque ?
- La page légale : même entité juridique ou deux entités distinctes ?
- Le futur domaine est-il déjà connu, ou ce fichier doit-il rester générique en attendant ?
