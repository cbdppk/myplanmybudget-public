export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      {/* Header skeleton */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-64 rounded-lg bg-slate-100" />
      </div>

      <div className="mb-6 animate-pulse rounded-[2rem] border border-slate-100 bg-slate-900 p-6 shadow-sm">
        <div className="h-3 w-24 rounded bg-slate-700" />
        <div className="mt-4 h-12 w-56 rounded bg-slate-700" />
        <div className="mt-3 h-4 w-72 rounded bg-slate-800" />
      </div>

      <div className="mb-6 grid animate-pulse gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-2 h-3 w-16 rounded bg-slate-200" />
            <div className="h-7 w-28 rounded bg-slate-100" />
            <div className="mt-3 h-4 w-24 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="mb-6 animate-pulse rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="mt-3 h-8 w-20 rounded bg-slate-100" />
          </div>
          <div className="h-4 w-56 rounded bg-slate-100" />
        </div>
        <div className="mt-4 h-3 w-full rounded-full bg-slate-100" />
      </div>

      <div className="mb-6 grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-2 h-3 w-20 rounded bg-slate-200" />
            <div className="h-7 w-24 rounded bg-slate-100" />
            <div className="mt-3 h-4 w-40 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Assistant hero skeleton */}
      <div className="mb-4 animate-pulse rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-5 h-6 w-56 rounded bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100" />
          ))}
        </div>
        <div className="mt-5 space-y-3">
          <div className="h-14 w-4/5 rounded-3xl bg-slate-100" />
          <div className="ml-auto h-14 w-2/5 rounded-3xl bg-slate-200" />
          <div className="h-14 w-3/4 rounded-3xl bg-slate-100" />
        </div>
      </div>

      {/* Secondary cards skeleton */}
      <div className="grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 h-4 w-24 rounded bg-slate-200" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-3/4 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
