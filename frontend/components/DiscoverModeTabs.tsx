import Link from 'next/link';

export type DiscoverMode = 'week' | 'tonight';

const MODES: ReadonlyArray<{ key: DiscoverMode; href: string; label: string }> = [
  { key: 'week', href: '/decouvrir', label: 'Découvrir' },
  { key: 'tonight', href: '/ce-soir', label: 'Ce soir' },
];

/** Une phrase par mode : ce qu'on y fait, et ce qui se passe ensuite. */
const HINTS: Record<DiscoverMode, string> = {
  week: 'Gardez ce qui vous plaît : ça rejoint vos favoris.',
  tonight: 'Un seul dîner à choisir, puis on cuisine.',
};

/**
 * L'interrupteur des deux modes du swipe : « Découvrir » (garder des recettes en favoris) et « Ce soir »
 * (trouver un dîner), avec une phrase qui dit la différence. Ce sont deux adresses, pour que chaque mode garde
 * sa page dans les moteurs de recherche.
 */
export default function DiscoverModeTabs({ active }: { active: DiscoverMode }) {
  return (
    <div className="mb-3">
      <nav aria-label="Mode de découverte" className="mb-1.5 flex justify-center">
        <ul className="inline-flex overflow-hidden rounded-xl border border-orange-200 bg-white">
          {MODES.map(({ key, href, label }) => (
            <li key={key}>
              <Link
                href={href}
                data-umami-event={`discover-mode-${key}`}
                aria-current={key === active ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center px-5 text-sm font-semibold transition-colors ${
                  key === active ? 'bg-orange-600 text-white' : 'text-gray-700 hover:bg-orange-50'
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="text-center text-xs text-gray-600 sm:text-sm">{HINTS[active]}</p>
    </div>
  );
}
