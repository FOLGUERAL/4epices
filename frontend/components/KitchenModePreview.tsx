import Link from 'next/link';
import OptimizedImage from '@/components/OptimizedImage';

type KitchenModePreviewProps = {
  recipe?: {
    title: string;
    slug: string;
    imageUrl?: string | null;
    totalTime?: string;
  } | null;
};

export default function KitchenModePreview({ recipe }: KitchenModePreviewProps) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-100 bg-white text-gray-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-orange-700">En cuisine</p>
          <p className="text-sm font-semibold text-gray-500">Etape 2 sur 6</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          Voix active
        </span>
      </div>

      <div className="grid gap-0 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <div className="bg-orange-50 p-3">
          <img
            src="/images/chef-guide-cut.webp"
            alt="Chef en train de guider la decoupe"
            className="h-full min-h-[11rem] w-full rounded-lg object-contain"
          />
        </div>
        <div className="flex flex-col justify-between gap-4 p-4">
          <div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-1/3 rounded-full bg-orange-600" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">En direct</p>
            <p className="mt-2 text-lg font-bold leading-snug text-gray-950">
              Coupez les legumes en morceaux reguliers, puis gardez-les a portee de main.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
            <span className="rounded-lg bg-gray-100 px-2 py-2 text-gray-700">Precedent</span>
            <span className="rounded-lg bg-orange-600 px-2 py-2 text-white">Lire</span>
            <span className="rounded-lg bg-gray-100 px-2 py-2 text-gray-700">Suivant</span>
          </div>
        </div>
      </div>

      {recipe && (
        <div className="border-t border-gray-100 p-4">
          <div className="flex gap-3">
            <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              <OptimizedImage
                src={recipe.imageUrl}
                alt={recipe.title}
                fill
                disableAspectRatio
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Pret maintenant</p>
              <h2 className="truncate text-base font-bold text-gray-950">{recipe.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {recipe.totalTime && (
                  <span className="text-xs font-semibold text-gray-600">Total : {recipe.totalTime}</span>
                )}
                <Link
                  href={`/recettes/${recipe.slug}`}
                  className="text-xs font-bold text-orange-700 hover:text-orange-800"
                >
                  Voir la recette
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
