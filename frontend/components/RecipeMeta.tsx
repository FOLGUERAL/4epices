import { Clock, Flame, Gauge, Timer, Users } from 'lucide-react';
import { formatMinutes as formatTime } from '@/lib/recipeList';

interface RecipeMetaProps {
  prepMinutes: number;
  cookMinutes: number;
  portions?: number | null;
  difficulty?: string | null;
}

/** Temps, portions et difficulté d'une recette, sur une seule ligne d'icônes. */
export default function RecipeMeta({ prepMinutes, cookMinutes, portions, difficulty }: RecipeMetaProps) {
  const total = prepMinutes + cookMinutes;
  const items = [
    prepMinutes > 0 && { key: 'prep', Icon: Timer, label: 'Préparation', value: formatTime(prepMinutes) },
    cookMinutes > 0 && { key: 'cook', Icon: Flame, label: 'Cuisson', value: formatTime(cookMinutes) },
    // Le total n'apporte rien quand il n'y a qu'un seul temps
    prepMinutes > 0 && cookMinutes > 0 && { key: 'total', Icon: Clock, label: 'Total', value: formatTime(total) },
    portions ? { key: 'portions', Icon: Users, label: 'Portions', value: String(portions) } : false,
    difficulty ? { key: 'difficulty', Icon: Gauge, label: 'Difficulté', value: difficulty } : false,
  ].filter((item): item is { key: string; Icon: typeof Clock; label: string; value: string } => item !== false);

  if (items.length === 0) return null;

  return (
    <ul className="mb-6 flex flex-wrap gap-x-6 gap-y-3 border-b pb-6">
      {items.map(({ key, Icon, label, value }) => (
        <li key={key} className="flex items-center gap-2">
          <Icon className="h-5 w-5 flex-shrink-0 text-orange-600" aria-hidden="true" />
          <span className="text-sm text-gray-700">
            {label} <span className="font-semibold capitalize tabular-nums text-gray-900">{value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
