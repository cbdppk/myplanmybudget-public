export default function SettingsLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-28 rounded-lg bg-black/10 dark:bg-white/10" />
        <div className="h-4 w-56 rounded-lg bg-black/[0.06] dark:bg-white/[0.06]" />
      </div>

      {/* Settings section cards */}
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-2xl border [border-color:var(--border)] bg-[color:var(--card-bg)] p-5">
            <div className="mb-3 h-9 w-9 rounded-xl bg-black/[0.06] dark:bg-white/[0.06]" />
            <div className="mb-2 h-4 w-28 rounded bg-black/10 dark:bg-white/10" />
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-black/[0.06] dark:bg-white/[0.06]" />
              <div className="h-3 w-3/4 rounded bg-black/[0.06] dark:bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
