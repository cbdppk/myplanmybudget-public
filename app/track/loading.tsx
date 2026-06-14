export default function TrackLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-40 rounded-lg bg-slate-200" />
        <div className="h-4 w-56 rounded-lg bg-slate-100" />
      </div>

      {/* Stats row */}
      <div className="mb-6 grid animate-pulse gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-2 h-3 w-20 rounded bg-slate-200" />
            <div className="h-7 w-28 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex animate-pulse items-center gap-3">
        <div className="h-9 w-48 rounded-xl bg-slate-100" />
        <div className="h-9 w-28 rounded-xl bg-slate-100" />
        <div className="ml-auto h-9 w-32 rounded-xl bg-slate-200" />
      </div>

      {/* Transaction rows */}
      <div className="animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-slate-50 px-5 py-4 last:border-0"
          >
            <div className="h-9 w-9 shrink-0 rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-40 rounded bg-slate-200" />
              <div className="h-3 w-24 rounded bg-slate-100" />
            </div>
            <div className="h-4 w-20 rounded bg-slate-100" />
            <div className="h-4 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </main>
  );
}
