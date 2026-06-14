export default function NotesLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-24 rounded-lg bg-slate-200" />
        <div className="h-4 w-48 rounded-lg bg-slate-100" />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex animate-pulse items-center gap-3">
        <div className="h-9 flex-1 rounded-xl bg-slate-100" />
        <div className="h-9 w-24 rounded-xl bg-slate-100" />
        <div className="h-9 w-28 rounded-xl bg-slate-200" />
      </div>

      {/* Note cards grid */}
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 h-5 w-3/4 rounded bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-5/6 rounded bg-slate-100" />
              <div className="h-3 w-2/3 rounded bg-slate-100" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-slate-100" />
              <div className="h-3 w-10 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
