export default function TrackLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 md:py-8">
      {/* Header */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-40 rounded-lg skeleton-strong" />
        <div className="h-4 w-56 rounded-lg skeleton" />
      </div>

      {/* Stats row */}
      <div className="mb-6 grid animate-pulse gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="theme-card rounded-2xl p-5 shadow-sm">
            <div className="mb-2 h-3 w-20 rounded skeleton-strong" />
            <div className="h-7 w-28 rounded skeleton" />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex animate-pulse items-center gap-3">
        <div className="h-9 w-48 rounded-xl skeleton" />
        <div className="h-9 w-28 rounded-xl skeleton" />
        <div className="ml-auto h-9 w-32 rounded-xl skeleton-strong" />
      </div>

      {/* Transaction rows */}
      <div className="theme-card animate-pulse rounded-2xl shadow-sm">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b [border-color:var(--border)] px-5 py-4 last:border-0"
          >
            <div className="h-9 w-9 shrink-0 rounded-xl skeleton" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-40 rounded skeleton-strong" />
              <div className="h-3 w-24 rounded skeleton" />
            </div>
            <div className="h-4 w-20 rounded skeleton" />
            <div className="h-4 w-16 rounded skeleton-strong" />
          </div>
        ))}
      </div>
    </main>
  );
}
