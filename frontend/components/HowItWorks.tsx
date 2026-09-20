import Link from 'next/link';
import { CalendarDays, ChefHat, Compass, type LucideIcon } from 'lucide-react';
import KitchenModeHelp from '@/components/KitchenModeHelp';

const linkClass =
  'focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-orange-700 underline-offset-4 transition-colors hover:underline';

interface Step {
  number: number;
  Icon: LucideIcon;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    Icon: Compass,
    title: 'Swipez',
    text: 'Faites défiler les recettes et gardez celles qui vous donnent envie : elles rejoignent vos favoris, sans limite.',
  },
  {
    number: 2,
    Icon: CalendarDays,
    title: 'Planifiez',
    text: 'Placez vos favoris dans un calendrier, laissez 4épices remplir les soirs libres, puis envoyez le tout vers votre agenda et votre liste de courses.',
  },
  {
    number: 3,
    Icon: ChefHat,
    title: 'Cuisinez',
    text: 'Ne lisez plus vos recettes. Vivez-les : étapes guidées, lecture à voix haute et minuteurs intégrés, avec la Nonna.',
  },
];

/** Explique l'app en trois étapes : chaque étape mène à une sous-application. */
export default function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-title"
      className="mt-12 mb-16 rounded-3xl border border-gray-100 bg-gradient-to-br from-gray-50 to-orange-50 p-6 shadow-lg sm:mb-20 sm:p-8 md:p-12 lg:mb-24"
    >
      <h2 id="how-it-works-title" className="mb-8 text-center text-3xl font-bold text-gray-900 sm:mb-10 sm:text-4xl">
        Comment ça marche
      </h2>
      <ol className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-10">
        {STEPS.map(({ number, Icon, title, text }) => (
          <li key={number} className="text-center">
            <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-orange-200 shadow-md">
              <Icon className="h-7 w-7 text-orange-700" aria-hidden="true" />
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
                {number}
              </span>
            </div>
            <h3 className="mb-2 text-xl font-bold text-gray-900 sm:text-2xl">{title}</h3>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-600 sm:text-base">{text}</p>
            <div className="mt-3">
              {number === 1 && (
                <Link href="/decouvrir" className={linkClass}>
                  Découvrir des recettes
                </Link>
              )}
              {number === 2 && (
                <Link href="/planning" className={linkClass}>
                  Ouvrir le planning
                </Link>
              )}
              {number === 3 && <KitchenModeHelp triggerLabel="Découvrir le Mode Cuisine" triggerClassName={linkClass} />}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
