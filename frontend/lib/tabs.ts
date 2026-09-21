/**
 * Barre d'onglets du bas (mobile) : les onglets, celui qui est actif, et les pages où elle s'affiche.
 * Module pur, comme lib/planning.ts.
 */

export type TabKey = 'accueil' | 'recettes' | 'decouvrir' | 'planning' | 'courses' | 'favoris';

export interface TabDef {
  key: TabKey;
  href: string;
  label: string;
}

export const TABS: readonly TabDef[] = [
  { key: 'accueil', href: '/', label: 'Accueil' },
  { key: 'recettes', href: '/recettes', label: 'Recettes' },
  { key: 'decouvrir', href: '/decouvrir', label: 'Découvrir' },
  { key: 'planning', href: '/planning', label: 'Planning' },
  { key: 'courses', href: '/courses', label: 'Courses' },
  { key: 'favoris', href: '/favoris', label: 'Favoris' },
];

function isSection(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * L'onglet actif pour une page, ou null (ingrédients, mentions légales…).
 * Une page recette n'a pas d'onglet actif : la barre y est masquée.
 */
export function getActiveTab(pathname: string): TabKey | null {
  if (pathname === '/') return 'accueil';
  if (isSection(pathname, '/recettes') || isSection(pathname, '/categories') || isSection(pathname, '/tags')) {
    return 'recettes';
  }
  if (isSection(pathname, '/decouvrir') || isSection(pathname, '/ce-soir')) return 'decouvrir';
  if (isSection(pathname, '/planning')) return 'planning';
  if (isSection(pathname, '/courses')) return 'courses';
  if (isSection(pathname, '/favoris')) return 'favoris';
  return null;
}

/**
 * La barre est masquée sur une page recette (elle a sa propre barre d'actions, et le Mode Cuisine est en plein
 * écran) et dans l'administration.
 */
export function isTabBarVisible(pathname: string): boolean {
  if (/^\/recettes\/[^/]+/.test(pathname)) return false;
  if (isSection(pathname, '/admin')) return false;
  return true;
}
