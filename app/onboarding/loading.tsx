export default function OnboardingLoading() {
  return (
    <main className="mx-auto min-h-[60vh] w-full max-w-3xl px-4 py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" aria-hidden="true" />
          <p className="text-sm text-slate-700">Loading onboarding workspace...</p>
        </div>
      </section>
    </main>
  );
}
