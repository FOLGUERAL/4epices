import RecettesGridSkeleton from '@/components/RecettesGridSkeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="h-10 bg-gray-200 rounded w-96 mb-4 animate-pulse" />
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
        </div>
        <RecettesGridSkeleton count={9} />
      </div>
    </div>
  );
}

