export default function RemindersLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-7 w-36 rounded-lg bg-slate-200" />
        <div className="h-4 w-52 rounded-lg bg-slate-100" />
      </div>

      {/* Top action bar */}
      <div className="mb-6 flex animate-pulse items-center justify-between">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="h-9 w-36 rounded-xl bg-slate-200" />
      </div>

      {/* Reminder list */}
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm"
          >
            <div className="h-9 w-9 shrink-0 rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 rounded bg-slate-200" />
              <div className="h-3 w-28 rounded bg-slate-100" />
            </div>
            <div className="h-3 w-16 rounded bg-slate-100" />
            <div className="h-8 w-8 rounded-xl bg-slate-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
