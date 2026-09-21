'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TabBadge from '@/components/TabBadge';
import { useShoppingCount } from '@/hooks/useShoppingCount';
import { TAB_ICONS } from '@/lib/tabIcons';
import { TABS, getActiveTab } from '@/lib/tabs';

/** Sur mobile, ces onglets restent en haut quand la barre du bas est absente (pages recette) */
const KEPT_ON_MOBILE = new Set(['recettes', 'courses', 'favoris']);

/**
 * Les onglets dans la barre du haut : les mêmes que la barre du bas (mobile), avec l'onglet actif en orange.
 * L'accueil est le logo. Sur mobile, seuls Recettes, Courses et Favoris restent, et seulement quand la barre du
 * bas est absente (pages recette) : sinon elle porte déjà tous les onglets.
 */
export default function NavTabs() {
  const active = getActiveTab(usePathname() || '/');
  const shoppingCount = useShoppingCount();

  return (
    <>
      {TABS.filter((tab) => tab.key !== 'accueil').map(({ key, href, label }) => {
        const Icon = TAB_ICONS[key];
        const isActive = key === active;
        const visibility = KEPT_ON_MOBILE.has(key) ? 'hide-with-tabbar' : 'hidden md:flex';
        return (
          <Link
            key={key}
            href={href}
            data-umami-event={`nav-${key}`}
            aria-current={isActive ? 'page' : undefined}
            className={`${visibility} flex items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors duration-200 sm:text-base ${
              isActive ? 'text-orange-600' : 'text-gray-700 hover:text-orange-600'
            }`}
          >
            <span className="relative">
              <Icon className="h-5 w-5" aria-hidden="true" />
              {key === 'courses' && <TabBadge count={shoppingCount} />}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </>
  );
}
