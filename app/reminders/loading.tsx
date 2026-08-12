export default function RemindersLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 md:py-8">
      {/* Header */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-36 rounded-lg skeleton-strong" />
        <div className="h-4 w-52 rounded-lg skeleton" />
      </div>

      {/* Top action bar */}
      <div className="mb-6 flex animate-pulse items-center justify-between">
        <div className="h-4 w-24 rounded skeleton-strong" />
        <div className="h-9 w-36 rounded-xl skeleton-strong" />
      </div>

      {/* Reminder list */}
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 theme-card rounded-2xl px-5 py-4 shadow-sm"
          >
            <div className="h-9 w-9 shrink-0 rounded-xl skeleton" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 rounded skeleton-strong" />
              <div className="h-3 w-28 rounded skeleton" />
            </div>
            <div className="h-3 w-16 rounded skeleton" />
            <div className="h-8 w-8 rounded-xl skeleton" />
          </div>
        ))}
      </div>
    </main>
  );
}
