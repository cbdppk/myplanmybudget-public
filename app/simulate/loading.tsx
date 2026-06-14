export default function SimulateLoading() {
  return (
    <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-10">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-40 rounded-xl bg-black/10" />
        <div className="h-24 rounded-2xl bg-black/10" />
        <div className="h-56 rounded-2xl bg-black/10" />
        <div className="h-40 rounded-2xl bg-black/10" />
      </div>
    </main>
  );
}
