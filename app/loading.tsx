export default function AppLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <div className="animate-pulse space-y-4">
        <div className="h-7 w-40 rounded-lg bg-[color:var(--page-secondary)]" />
        <div className="theme-card rounded-2xl p-6 shadow-sm">
          <div className="mb-4 h-4 w-28 rounded bg-[color:var(--page-secondary)]" />
          <div className="space-y-3">
            <div className="h-3 w-full rounded bg-[color:var(--page-secondary)]" />
            <div className="h-3 w-5/6 rounded bg-[color:var(--page-secondary)]" />
            <div className="h-3 w-4/6 rounded bg-[color:var(--page-secondary)]" />
          </div>
        </div>
        <div className="theme-card h-40 rounded-2xl shadow-sm" />
      </div>
    </main>
  );
}
