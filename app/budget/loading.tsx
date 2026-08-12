export default function BudgetLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      {/* Header */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-36 rounded-lg skeleton-strong" />
        <div className="h-4 w-60 rounded-lg skeleton" />
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="theme-card rounded-2xl p-5 shadow-sm">
            <div className="mb-2 h-3 w-16 rounded skeleton-strong" />
            <div className="h-7 w-24 rounded skeleton" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="mb-6 animate-pulse rounded-[2rem] theme-card p-6 shadow-sm">
        <div className="mb-4 h-4 w-32 rounded skeleton-strong" />
        <div className="h-48 w-full rounded-xl skeleton" />
      </div>

      {/* Category list */}
      <div className="animate-pulse theme-card rounded-2xl p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-4 w-28 rounded skeleton-strong" />
          <div className="h-8 w-24 rounded-xl skeleton" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-32 rounded skeleton-strong" />
                <div className="h-3.5 w-20 rounded skeleton" />
              </div>
              <div className="h-2.5 w-full rounded-full skeleton">
                <div
                  className="h-2.5 rounded-full skeleton-strong"
                  style={{ width: `${30 + i * 10}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
