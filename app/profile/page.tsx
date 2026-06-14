import { PageHeader } from "@/components/shell/page-header";
import { getSettingsData } from "@/lib/data/settings";
import { DataLoadError } from "@/components/feature/data-load-error";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  let data: Awaited<ReturnType<typeof getSettingsData>> | null = null;
  try {
    data = await getSettingsData();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <PageHeader title="Personal Profile" subtitle="Your account and personal preferences." />
        <DataLoadError primaryHref="/dashboard" primaryLabel="Open dashboard" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader title="Personal Profile" subtitle="Your account and personal preferences." />

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="card p-5">
          <div className="kicker">Name</div>
          <p className="mt-2 text-lg font-semibold">{data.user.name ?? "Not set"}</p>
        </article>
        <article className="card p-5">
          <div className="kicker">Email</div>
          <p className="mt-2 text-lg font-semibold">{data.user.email}</p>
        </article>
        <article className="card p-5">
          <div className="kicker">Preferred currency</div>
          <p className="mt-2 text-lg font-semibold">{data.user.currency}</p>
        </article>
        <article className="card p-5">
          <div className="kicker">Joined</div>
          <p className="mt-2 text-lg font-semibold">{new Date(data.user.createdAt).toISOString().slice(0, 10)}</p>
        </article>
      </section>
    </main>
  );
}
