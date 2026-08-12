export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 md:py-8">
      {/* Header skeleton */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-48 rounded-lg skeleton-strong" />
        <div className="h-4 w-64 rounded-lg skeleton" />
      </div>

      {/* Hero / money-health card */}
      <div className="mb-6 animate-pulse theme-card rounded-[2rem] p-6 shadow-sm">
        <div className="h-3 w-24 rounded skeleton" />
        <div className="mt-4 h-12 w-56 rounded skeleton-strong" />
        <div className="mt-3 h-4 w-72 rounded skeleton" />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl skeleton" />
          ))}
        </div>
      </div>

      <div className="mb-6 grid animate-pulse gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="theme-card rounded-2xl p-5 shadow-sm">
            <div className="mb-2 h-3 w-16 rounded skeleton-strong" />
            <div className="h-7 w-28 rounded skeleton" />
            <div className="mt-3 h-4 w-24 rounded skeleton" />
          </div>
        ))}
      </div>

      <div className="mb-6 animate-pulse theme-card rounded-[2rem] p-5 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="h-3 w-20 rounded skeleton-strong" />
            <div className="mt-3 h-8 w-20 rounded skeleton" />
          </div>
          <div className="h-4 w-56 rounded skeleton" />
        </div>
        <div className="mt-4 h-3 w-full rounded-full skeleton" />
      </div>

      <div className="mb-6 grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="theme-card rounded-2xl p-5 shadow-sm">
            <div className="mb-2 h-3 w-20 rounded skeleton-strong" />
            <div className="h-7 w-24 rounded skeleton" />
            <div className="mt-3 h-4 w-40 rounded skeleton" />
          </div>
        ))}
      </div>

      {/* Chart + categories skeleton */}
      <div className="mb-4 animate-pulse theme-card rounded-[2rem] p-6 shadow-sm">
        <div className="mb-5 h-6 w-56 rounded skeleton-strong" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl skeleton" />
          ))}
        </div>
        <div className="mt-5 space-y-3">
          <div className="h-14 w-4/5 rounded-3xl skeleton" />
          <div className="ml-auto h-14 w-2/5 rounded-3xl skeleton-strong" />
          <div className="h-14 w-3/4 rounded-3xl skeleton" />
        </div>
      </div>

      {/* Secondary cards skeleton */}
      <div className="grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="theme-card rounded-2xl p-5 shadow-sm">
            <div className="mb-3 h-4 w-24 rounded skeleton-strong" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded skeleton" />
              <div className="h-3 w-3/4 rounded skeleton" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
