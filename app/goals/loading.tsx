export default function GoalsLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-32 rounded-lg bg-slate-200" />
        <div className="h-4 w-52 rounded-lg bg-slate-100" />
      </div>

      {/* Summary */}
      <div className="mb-6 grid animate-pulse gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-2 h-3 w-24 rounded bg-slate-200" />
            <div className="h-8 w-32 rounded bg-slate-100" />
            <div className="mt-2 h-3 w-40 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Goal cards */}
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between">
              <div className="h-5 w-36 rounded bg-slate-200" />
              <div className="h-5 w-16 rounded-full bg-slate-100" />
            </div>
            <div className="mb-4 h-3 w-full rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-slate-200" style={{ width: `${40 + i * 15}%` }} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-16 rounded bg-slate-100" />
                <div className="h-3 w-20 rounded bg-slate-200" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-20 rounded bg-slate-100" />
                <div className="h-3 w-16 rounded bg-slate-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
