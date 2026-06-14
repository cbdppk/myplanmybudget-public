import { getSettingsData } from "@/lib/data/settings";
import { DataLoadError } from "@/components/feature/data-load-error";

export const dynamic = "force-dynamic";

export default async function SettingsAccountPage() {
  let data: Awaited<ReturnType<typeof getSettingsData>> | null = null;
  try {
    data = await getSettingsData();
  } catch {
    data = null;
  }

  if (!data) {
    return <DataLoadError primaryHref="/settings" primaryLabel="Open settings overview" />;
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-sm font-semibold">Account</h2>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Your sign-in details and account information.</p>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs text-[color:var(--text-muted)]">Email address</p>
            <p className="mt-0.5 text-sm font-medium">{data.user.email}</p>
          </div>
          <div>
            <p className="text-xs text-[color:var(--text-muted)]">Preferred currency</p>
            <p className="mt-0.5 text-sm font-medium">{data.user.currency}</p>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold">Account actions</h3>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
          To change your password or set up two-factor authentication, visit{" "}
          <a href="/settings/security" className="text-sky-600 underline underline-offset-2">Security settings</a>.
          To delete your account or reset your data, visit{" "}
          <a href="/settings/danger" className="text-rose-600 underline underline-offset-2">Danger Zone</a>.
        </p>
      </section>
    </div>
  );
}
