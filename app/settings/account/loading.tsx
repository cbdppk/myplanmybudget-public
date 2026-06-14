export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="rounded-2xl border [border-color:var(--border)] bg-[color:var(--card-bg)] p-5">
        <div className="mb-3 h-5 w-40 rounded bg-black/10 dark:bg-white/10" />
        <div className="mb-4 h-3 w-64 rounded bg-black/[0.06] dark:bg-white/[0.06]" />
        <div className="space-y-3">
          <div className="h-10 w-full max-w-sm rounded-xl bg-black/[0.06] dark:bg-white/[0.06]" />
          <div className="h-10 w-full max-w-sm rounded-xl bg-black/[0.06] dark:bg-white/[0.06]" />
        </div>
      </div>
      <div className="rounded-2xl border [border-color:var(--border)] bg-[color:var(--card-bg)] p-5">
        <div className="mb-3 h-5 w-32 rounded bg-black/10 dark:bg-white/10" />
        <div className="h-9 w-36 rounded-xl bg-black/[0.06] dark:bg-white/[0.06]" />
      </div>
    </div>
  );
}
