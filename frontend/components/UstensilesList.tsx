import OptimizedImage from '@/components/OptimizedImage';
import { buildAmazonAffiliateUrl, isAffiliateLinksEnabled } from '@/lib/affiliate';
import type { Recette } from '@/lib/strapi';

interface UstensilesListProps {
  ustensiles: NonNullable<Recette['attributes']['ustensiles']>['data'];
}

/**
 * Bloc « Ustensiles », juste après les ingrédients : liens d'affiliation Amazon Associates.
 * La mention de transparence reste collée au bloc (exigence du programme Amazon), pas seulement
 * dans la politique de confidentialité. Composant serveur : pas de JS nécessaire ici.
 */
export default function UstensilesList({ ustensiles }: UstensilesListProps) {
  if (!isAffiliateLinksEnabled()) return null;

  const items = (ustensiles || []).filter((u) => u.attributes.lienAmazon);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="ustensiles-title" className="my-10">
      <h2 id="ustensiles-title" className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">
        Ustensiles utiles pour cette recette
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        En tant que Partenaire Amazon, 4Épices réalise un bénéfice sur les achats remplissant les
        conditions requises.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        {items.map((ustensile) => {
          const { id, attributes } = ustensile;
          const image = attributes.image?.data?.attributes;
          const href = buildAmazonAffiliateUrl(attributes.lienAmazon as string);

          return (
            <a
              key={id}
              href={href}
              target="_blank"
              rel="sponsored nofollow noopener noreferrer"
              data-umami-event="ustensile-click"
              data-umami-event-target={attributes.slug}
              className="card-base card-hover group/card flex h-full flex-col"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
                <OptimizedImage
                  src={image?.url}
                  alt={image?.alternativeText || attributes.nom}
                  fill
                  disableAspectRatio
                  className="object-cover transition-transform duration-500 group-hover/card:scale-105"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>
              <div className="p-3">
                <p className="font-medium text-gray-900">{attributes.nom}</p>
                <p className="text-xs text-gray-500">Voir sur Amazon</p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
