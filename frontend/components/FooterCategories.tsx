import Link from 'next/link';
import { BASES_CATEGORY_SLUG } from '@/lib/recipeList';
import { getCategories, type Categorie } from '@/lib/strapi';

/**
 * Les liens vers toutes les pages catégorie, en pied de page : ils restent présents sur chaque page du site
 * (le menu déroulant de la barre du haut a été retiré).
 */
export default async function FooterCategories() {
  let categories: Categorie[] = [];
  try {
    const response = await getCategories();
    categories = response.data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories pour le pied de page:', error);
  }
  if (categories.length === 0) return null;

  const sorted = [...categories].sort((a, b) => {
    const aBases = a.attributes.slug === BASES_CATEGORY_SLUG ? 1 : 0;
    const bBases = b.attributes.slug === BASES_CATEGORY_SLUG ? 1 : 0;
    return aBases - bBases || a.attributes.nom.localeCompare(b.attributes.nom, 'fr');
  });

  return (
    <nav aria-label="Catégories de recettes" className="mb-4 border-b border-gray-700 pb-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Catégories</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {sorted.map((categorie) => (
          <li key={categorie.id}>
            <Link
              href={`/categories/${categorie.attributes.slug}`}
              className="inline-block py-1 text-sm text-gray-400 transition-colors hover:text-white"
            >
              {categorie.attributes.nom}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
