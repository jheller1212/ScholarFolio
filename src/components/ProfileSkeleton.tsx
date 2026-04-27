export function ProfileSkeleton() {
  return (
    <div className="min-h-screen mesh-bg">
      {/* Header skeleton */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100/80">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-4">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="skeleton w-28 h-5" />
            <div className="flex-1 max-w-md ml-auto skeleton h-8 rounded-lg" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Profile card skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="skeleton w-16 h-16 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="skeleton w-48 h-6" />
                <div className="skeleton w-64 h-4" />
                <div className="flex gap-2">
                  <div className="skeleton w-24 h-6 rounded-full" />
                  <div className="skeleton w-20 h-6 rounded-full" />
                  <div className="skeleton w-16 h-6 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <div className="skeleton w-16 h-5 rounded-full" />
                  <div className="skeleton w-20 h-5 rounded-full" />
                  <div className="skeleton w-24 h-5 rounded-full" />
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="skeleton w-32 h-10 rounded-xl" />
              <div className="skeleton w-24 h-4" />
            </div>
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div className="mb-6">
          <div className="flex gap-1 p-1 bg-gray-100/80 rounded-xl w-fit">
            {[120, 130, 140, 110, 120].map((w, i) => (
              <div key={i} className="skeleton rounded-lg" style={{ width: w, height: 36 }} />
            ))}
          </div>
        </div>

        {/* Metrics grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-card">
              <div className="flex items-start gap-2.5">
                <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton w-20 h-3" />
                  <div className="skeleton w-14 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
