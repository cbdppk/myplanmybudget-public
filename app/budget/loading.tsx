export default function BudgetLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-36 rounded-lg bg-slate-200" />
        <div className="h-4 w-60 rounded-lg bg-slate-100" />
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-2 h-3 w-16 rounded bg-slate-200" />
            <div className="h-7 w-24 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="mb-6 animate-pulse rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 h-4 w-32 rounded bg-slate-200" />
        <div className="h-48 w-full rounded-xl bg-slate-100" />
      </div>

      {/* Category list */}
      <div className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-4 w-28 rounded bg-slate-200" />
          <div className="h-8 w-24 rounded-xl bg-slate-100" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-32 rounded bg-slate-200" />
                <div className="h-3.5 w-20 rounded bg-slate-100" />
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100">
                <div
                  className="h-2.5 rounded-full bg-slate-200"
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
