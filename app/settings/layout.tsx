import { PageHeader } from "@/components/shell/page-header";
import { SettingsPath } from "./_components/settings-path";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader title="Settings" subtitle="Manage your account, budget, goals, notifications, and app preferences." />
      <SettingsPath />
      <section className="mt-6 space-y-5">{children}</section>
    </main>
  );
}
