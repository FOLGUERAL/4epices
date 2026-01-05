import RecetteCardSkeleton from './RecetteCardSkeleton';

interface RecettesGridSkeletonProps {
  count?: number;
}

export default function RecettesGridSkeleton({ count = 6 }: RecettesGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <RecetteCardSkeleton key={index} />
      ))}
    </div>
  );
}

