export default function GoalsLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 md:py-8">
      {/* Header */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-32 rounded-lg skeleton-strong" />
        <div className="h-4 w-52 rounded-lg skeleton" />
      </div>

      {/* Summary */}
      <div className="mb-6 grid animate-pulse gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="theme-card rounded-2xl p-5 shadow-sm">
            <div className="mb-2 h-3 w-24 rounded skeleton-strong" />
            <div className="h-8 w-32 rounded skeleton" />
            <div className="mt-2 h-3 w-40 rounded skeleton" />
          </div>
        ))}
      </div>

      {/* Goal cards */}
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="theme-card rounded-2xl p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between">
              <div className="h-5 w-36 rounded skeleton-strong" />
              <div className="h-5 w-16 rounded-full skeleton" />
            </div>
            <div className="mb-4 h-3 w-full rounded-full skeleton">
              <div className="h-3 rounded-full skeleton-strong" style={{ width: `${40 + i * 15}%` }} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-16 rounded skeleton" />
                <div className="h-3 w-20 rounded skeleton-strong" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-20 rounded skeleton" />
                <div className="h-3 w-16 rounded skeleton" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
