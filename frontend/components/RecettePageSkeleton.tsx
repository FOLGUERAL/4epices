export default function RecettePageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        {/* Breadcrumb skeleton */}
        <div className="mb-6">
          <div className="h-4 bg-gray-200 rounded w-48" />
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-12">
          {/* Image skeleton */}
          <div className="relative w-full bg-gray-200" style={{ aspectRatio: '16/9', height: '400px' }} />
          
          <div className="p-8">
            {/* Title skeleton */}
            <div className="h-10 bg-gray-200 rounded mb-4 w-3/4" />
            
            {/* Description skeleton */}
            <div className="space-y-2 mb-6">
              <div className="h-5 bg-gray-200 rounded w-full" />
              <div className="h-5 bg-gray-200 rounded w-5/6" />
            </div>
            
            {/* Info badges skeleton */}
            <div className="flex flex-wrap gap-4 mb-8 pb-8 border-b">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-200 rounded" />
                  <div>
                    <div className="h-3 bg-gray-200 rounded w-16 mb-1" />
                    <div className="h-4 bg-gray-200 rounded w-12" />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Ingredients skeleton */}
            <div className="mb-8">
              <div className="h-7 bg-gray-200 rounded w-32 mb-4" />
              <ul className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => {
                  const widths = ['w-full', 'w-5/6', 'w-4/5', 'w-full', 'w-3/4'];
                  return (
                    <li key={i} className="ml-4">
                      <div className={`h-4 bg-gray-200 rounded ${widths[i - 1]}`} />
                    </li>
                  );
                })}
              </ul>
            </div>
            
            {/* Preparation skeleton */}
            <div className="mb-8">
              <div className="h-7 bg-gray-200 rounded w-40 mb-4" />
              <div className="space-y-3 prose max-w-none">
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
                <div className="h-4 bg-gray-200 rounded w-4/5" />
                <div className="h-4 bg-gray-200 rounded w-full" />
              </div>
            </div>
            
            {/* Categories/Tags skeleton */}
            <div className="flex flex-wrap gap-4">
              <div className="h-6 bg-gray-200 rounded-full w-20" />
              <div className="h-6 bg-gray-200 rounded-full w-24" />
              <div className="h-6 bg-gray-200 rounded-full w-16" />
            </div>
          </div>
        </div>
        
        {/* Similar recipes skeleton */}
        <div className="mt-12">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="relative h-48 w-full bg-gray-200" style={{ aspectRatio: '4/3' }} />
                <div className="p-4">
                  <div className="h-5 bg-gray-200 rounded mb-2 w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

