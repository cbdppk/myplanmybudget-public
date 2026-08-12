export default function OnboardingLoading() {
  return (
    <main className="mx-auto min-h-[60vh] w-full max-w-3xl px-4 py-6 md:py-10">
      <section className="theme-card rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--text-primary)] border-t-transparent" aria-hidden="true" />
          <p className="text-sm text-[color:var(--text-secondary)]">Loading onboarding workspace...</p>
        </div>
      </section>
    </main>
  );
}
