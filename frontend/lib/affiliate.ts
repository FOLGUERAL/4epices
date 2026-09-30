/**
 * Liens d'affiliation Amazon Associates France pour le bloc « Ustensiles » des pages recette.
 *
 * Les ustensiles sont saisis dans Strapi avec une URL produit Amazon "nue" (sans tag) : le tag
 * est ajouté ici, au rendu, pour n'avoir qu'un seul endroit à corriger si le tag change un jour.
 * Calqué sur lib/ads.ts (isAdSenseEnabled, même style de feature flag). Utilisé uniquement côté
 * serveur (la page recette est un composant serveur) : pas besoin de préfixe NEXT_PUBLIC_.
 */

export function isAffiliateLinksEnabled(): boolean {
  return process.env.ENABLE_AFFILIATE_LINKS === 'true';
}

/** Ajoute le tag Amazon Associates à une URL produit ; renvoie l'URL telle quelle si aucun tag n'est configuré. */
export function buildAmazonAffiliateUrl(productUrl: string): string {
  const tag = process.env.AMAZON_ASSOCIATES_TAG?.trim();
  if (!tag || !productUrl) return productUrl;

  try {
    const url = new URL(productUrl);
    url.searchParams.set('tag', tag);
    return url.toString();
  } catch {
    // URL malformée (saisie admin incorrecte) : on la renvoie telle quelle plutôt que de planter la page.
    return productUrl;
  }
}
