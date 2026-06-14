import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { AdminPanel } from "@/components/feature/admin-panel";
import { getAdminData } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    const data = await getAdminData();

    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <PageHeader title="Admin" subtitle="Control users, roles, support inboxes, and assistant complaints." />

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <article className="card p-5">
            <div className="kicker">Total users</div>
            <p className="mt-2 text-2xl font-semibold">{data.stats.totalUsers}</p>
          </article>
          <article className="card p-5">
            <div className="kicker">Active users</div>
            <p className="mt-2 text-2xl font-semibold">{data.stats.activeUsers}</p>
          </article>
          <article className="card p-5">
            <div className="kicker">Active push subscriptions</div>
            <p className="mt-2 text-2xl font-semibold">{data.stats.totalPushSubs}</p>
          </article>
          <article className="card p-5">
            <div className="kicker">Open complaints</div>
            <p className="mt-2 text-2xl font-semibold">{data.stats.openAssistantFeedbackCount}</p>
          </article>
          <article className="card p-5">
            <div className="kicker">Open contact</div>
            <p className="mt-2 text-2xl font-semibold">{data.stats.openInquiryCount}</p>
          </article>
        </section>

        <AdminPanel
          adminId={data.admin.id}
          users={data.users}
          inquiries={data.inquiries}
          assistantFeedback={data.assistantFeedback}
        />
      </main>
    );
  } catch {
    redirect("/dashboard?notice=admin_required");
  }
}
