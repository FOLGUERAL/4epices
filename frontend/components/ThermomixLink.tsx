import Link from 'next/link';
import { ChefHat } from 'lucide-react';

/**
 * Lien vers la version Thermomix d'une recette (mirroir léger de KitchenModeLink.tsx).
 * Pas de sessionStorage ici : /thermomix refait son propre fetch par slug, pas besoin de handoff.
 * À afficher seulement si la recette est validée (compatibleThermomix + au moins une étape) —
 * c'est à l'appelant de faire cette vérification, comme pour UstensilesList.
 */
export default function ThermomixLink({ slug }: { slug: string }) {
  return (
    <Link
      href={`/recettes/${slug}/thermomix`}
      className="mb-6 inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-800 transition-colors hover:bg-orange-100"
    >
      <ChefHat className="h-4 w-4" aria-hidden="true" />
      Voir la version Thermomix
    </Link>
  );
}
