export default function NotesLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 md:py-8">
      {/* Header */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-24 rounded-lg skeleton-strong" />
        <div className="h-4 w-48 rounded-lg skeleton" />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex animate-pulse items-center gap-3">
        <div className="h-9 flex-1 rounded-xl skeleton" />
        <div className="h-9 w-24 rounded-xl skeleton" />
        <div className="h-9 w-28 rounded-xl skeleton-strong" />
      </div>

      {/* Note cards grid */}
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="theme-card rounded-2xl p-5 shadow-sm">
            <div className="mb-3 h-5 w-3/4 rounded skeleton-strong" />
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded skeleton" />
              <div className="h-3 w-5/6 rounded skeleton" />
              <div className="h-3 w-2/3 rounded skeleton" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="h-3 w-20 rounded skeleton" />
              <div className="h-3 w-10 rounded skeleton" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
