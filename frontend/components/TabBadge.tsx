/** La pastille de compteur d'un onglet (articles restant à acheter). Rien n'est affiché à zéro. */
export default function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} à acheter`}
      className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-orange-600 px-1 text-center text-[10px] font-bold leading-4 tabular-nums text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
