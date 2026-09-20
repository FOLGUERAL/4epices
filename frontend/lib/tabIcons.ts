import { CalendarDays, ChefHat, Compass, Heart, Home, type LucideIcon } from 'lucide-react';
import type { TabKey } from '@/lib/tabs';

/** Les icônes des onglets, partagées par la barre du bas (mobile) et la barre du haut (PC). */
export const TAB_ICONS: Record<TabKey, LucideIcon> = {
  accueil: Home,
  recettes: ChefHat,
  decouvrir: Compass,
  planning: CalendarDays,
  favoris: Heart,
};
