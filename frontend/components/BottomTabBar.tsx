'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TAB_ICONS } from '@/lib/tabIcons';
import { TABS, getActiveTab, isTabBarVisible } from '@/lib/tabs';

/**
 * Barre d'onglets du bas, sur mobile seulement : les sous-applications à portée de pouce.
 * Quand elle s'affiche, elle pose `data-tabbar` sur <html> : le CSS réserve alors sa hauteur en bas de page
 * et les autres éléments fixes (liste de courses, swipe) s'en écartent.
 */
export default function BottomTabBar() {
  const pathname = usePathname() || '/';
  const visible = isTabBarVisible(pathname);
  const active = getActiveTab(pathname);

  useEffect(() => {
    if (!visible) return;
    document.documentElement.dataset.tabbar = 'on';
    return () => {
      delete document.documentElement.dataset.tabbar;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
    >
      <ul className="flex h-16">
        {TABS.map(({ key, href, label }) => {
          const Icon = TAB_ICONS[key];
          const isActive = key === active;
          return (
            <li key={key} className="flex-1">
              <Link
                href={href}
                data-umami-event={`tab-${key}`}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-orange-600' : 'text-gray-600 hover:text-orange-600'
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
