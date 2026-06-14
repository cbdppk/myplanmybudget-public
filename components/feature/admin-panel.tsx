"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resolveAssistantFeedback, resolveContactInquiry, updateUserActive, updateUserRole } from "@/app/admin/actions";
import { assistantFeedbackCategoryLabel, type AssistantFeedbackCategory } from "@/lib/assistant/feedback";

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  isActive: boolean;
  createdAt: Date | string;
  _count: {
    transactions: number;
    reminders: number;
    pushSubscriptions: number;
  };
};

type AdminInquiryRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: "NEW" | "RESOLVED";
  createdAt: Date | string;
  resolvedAt: Date | string | null;
  handledBy: { email: string } | null;
};

type AdminAssistantFeedbackRow = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  subject: string | null;
  message: string;
  category: string;
  sourcePage: string;
  sourceQuestion: string | null;
  status: "NEW" | "RESOLVED";
  createdAt: Date | string;
  resolvedAt: Date | string | null;
  handledBy: { email: string } | null;
};

function formatStableDateTime(value: Date | string) {
  return `${new Date(value).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function feedbackTone(category: string) {
  switch (category) {
    case "BUG":
      return "bg-rose-50 text-rose-700";
    case "FEATURE":
      return "bg-sky-50 text-sky-700";
    case "SUPPORT":
      return "bg-amber-50 text-amber-700";
    case "OTHER":
      return "bg-slate-100 text-slate-700";
    case "COMPLAINT":
    default:
      return "bg-violet-50 text-violet-700";
  }
}

function UserActionButtons({
  user,
  adminId,
  pending,
  pendingKey,
  layout = "desktop",
  runAdminTask,
}: {
  user: AdminUserRow;
  adminId: string;
  pending: boolean;
  pendingKey: string | null;
  layout?: "desktop" | "mobile";
  runAdminTask: (taskKey: string, task: () => Promise<void>, successMessage: string) => void;
}) {
  const wrapClass = layout === "mobile" ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2";
  const buttonClass = layout === "mobile" ? "w-full" : undefined;

  return (
    <div className={wrapClass}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={buttonClass}
        loading={pending && pendingKey === `promote:${user.id}`}
        disabled={pending || user.role === "ADMIN"}
        onClick={() =>
          runAdminTask(
            `promote:${user.id}`,
            () => updateUserRole({ targetUserId: user.id, role: "ADMIN" }).then(() => undefined),
            `Promoted ${user.email} to admin.`
          )
        }
      >
        Make admin
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={buttonClass}
        loading={pending && pendingKey === `demote:${user.id}`}
        disabled={pending || user.role === "USER" || user.id === adminId}
        onClick={() =>
          runAdminTask(
            `demote:${user.id}`,
            () => updateUserRole({ targetUserId: user.id, role: "USER" }).then(() => undefined),
            `Set ${user.email} as user.`
          )
        }
      >
        Remove admin
      </Button>
      <Button
        type="button"
        size="sm"
        className={buttonClass}
        loading={pending && pendingKey === `disable:${user.id}`}
        disabled={pending || !user.isActive || user.id === adminId}
        onClick={() =>
          runAdminTask(
            `disable:${user.id}`,
            () => updateUserActive({ targetUserId: user.id, isActive: false }).then(() => undefined),
            `Disabled ${user.email}.`
          )
        }
      >
        Disable
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={buttonClass}
        loading={pending && pendingKey === `enable:${user.id}`}
        disabled={pending || user.isActive}
        onClick={() =>
          runAdminTask(
            `enable:${user.id}`,
            () => updateUserActive({ targetUserId: user.id, isActive: true }).then(() => undefined),
            `Reactivated ${user.email}.`
          )
        }
      >
        Reactivate
      </Button>
    </div>
  );
}

export function AdminPanel({
  adminId,
  users,
  inquiries,
  assistantFeedback,
}: {
  adminId: string;
  users: AdminUserRow[];
  inquiries: AdminInquiryRow[];
  assistantFeedback: AdminAssistantFeedbackRow[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [feedbackFilter, setFeedbackFilter] = useState<"ALL" | "OPEN" | "RESOLVED" | AssistantFeedbackCategory>("OPEN");
  const [pending, startTransition] = useTransition();

  const feedbackCounts = useMemo(() => {
    const open = assistantFeedback.filter((item) => item.status === "NEW").length;
    const resolved = assistantFeedback.filter((item) => item.status === "RESOLVED").length;
    const bugs = assistantFeedback.filter((item) => item.category === "BUG").length;
    const feature = assistantFeedback.filter((item) => item.category === "FEATURE").length;
    return { open, resolved, bugs, feature };
  }, [assistantFeedback]);

  const filteredFeedback = useMemo(() => {
    const search = feedbackSearch.trim().toLowerCase();
    return assistantFeedback.filter((item) => {
      const matchesFilter =
        feedbackFilter === "ALL"
          ? true
          : feedbackFilter === "OPEN"
            ? item.status === "NEW"
            : feedbackFilter === "RESOLVED"
              ? item.status === "RESOLVED"
              : item.category === feedbackFilter;
      if (!matchesFilter) return false;
      if (!search) return true;
      return [item.name, item.email, item.subject, item.message, item.sourceQuestion, item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }, [assistantFeedback, feedbackFilter, feedbackSearch]);

  const unresolvedInquiries = inquiries.filter((item) => item.status === "NEW").length;

  function runAdminTask(taskKey: string, task: () => Promise<void>, successMessage: string) {
    setMessage(null);
    setPendingKey(taskKey);
    startTransition(async () => {
      try {
        await task();
        setMessage(successMessage);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Admin action failed.");
      } finally {
        setPendingKey(null);
      }
    });
  }

  return (
    <section className="mt-6 space-y-6">
      {message ? (
        <div className="theme-card rounded-2xl px-4 py-3 text-sm text-[color:var(--text-secondary)]">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <article className="theme-card overflow-hidden rounded-[1.75rem] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b [border-color:var(--border)] px-5 py-4">
            <div>
              <p className="text-base font-semibold text-[color:var(--text-primary)]">User controls</p>
              <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">Role, account status, and product activity.</p>
            </div>
            <div className="rounded-full bg-[color:var(--page-secondary)] px-3 py-1 text-xs font-medium text-[color:var(--text-secondary)]">
              {users.length} loaded
            </div>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {users.length === 0 ? (
              <div className="rounded-2xl border border-dashed [border-color:var(--border)] px-4 py-8 text-sm text-[color:var(--text-secondary)]">
                No users found.
              </div>
            ) : null}
            {users.map((user) => (
              <article key={user.id} className="theme-card-soft rounded-[1.5rem] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[color:var(--text-primary)]">{user.name ?? "Unnamed user"}</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">{user.email}</p>
                    <p className="text-xs text-[color:var(--text-muted)]">{formatStableDateTime(user.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[color:var(--card-bg)] px-2 py-1 text-xs font-medium text-[color:var(--text-primary)]">
                      {user.role}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {user.isActive ? "ACTIVE" : "DISABLED"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[color:var(--card-bg)] px-3 py-3 text-xs text-[color:var(--text-secondary)]">
                    <p className="font-semibold text-[color:var(--text-primary)]">{user._count.transactions}</p>
                    <p className="mt-1">Transactions</p>
                  </div>
                  <div className="rounded-2xl bg-[color:var(--card-bg)] px-3 py-3 text-xs text-[color:var(--text-secondary)]">
                    <p className="font-semibold text-[color:var(--text-primary)]">{user._count.reminders}</p>
                    <p className="mt-1">Reminders</p>
                  </div>
                  <div className="rounded-2xl bg-[color:var(--card-bg)] px-3 py-3 text-xs text-[color:var(--text-secondary)]">
                    <p className="font-semibold text-[color:var(--text-primary)]">{user._count.pushSubscriptions}</p>
                    <p className="mt-1">Push subs</p>
                  </div>
                </div>

                <div className="mt-4">
                  <UserActionButtons
                    user={user}
                    adminId={adminId}
                    pending={pending}
                    pendingKey={pendingKey}
                    layout="mobile"
                    runAdminTask={runAdminTask}
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--page-secondary)] text-left text-[color:var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Usage</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t [border-color:var(--border)] align-top">
                    <td className="px-4 py-4">
                      <p className="font-medium text-[color:var(--text-primary)]">{user.name ?? "Unnamed user"}</p>
                      <p className="text-xs text-[color:var(--text-secondary)]">{user.email}</p>
                      <p className="text-xs text-[color:var(--text-muted)]">{formatStableDateTime(user.createdAt)}</p>
                    </td>
                    <td className="px-4 py-4 text-[color:var(--text-primary)]">{user.role}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {user.isActive ? "ACTIVE" : "DISABLED"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-[color:var(--text-secondary)]">
                      <p>{user._count.transactions} txns</p>
                      <p>{user._count.reminders} reminders</p>
                      <p>{user._count.pushSubscriptions} push subs</p>
                    </td>
                    <td className="px-4 py-4">
                      <UserActionButtons
                        user={user}
                        adminId={adminId}
                        pending={pending}
                        pendingKey={pendingKey}
                        runAdminTask={runAdminTask}
                      />
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-sm text-[color:var(--text-secondary)]" colSpan={5}>
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <div className="space-y-4">
          <article className="theme-card rounded-[1.75rem] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[color:var(--text-primary)]">Assistant inbox</p>
                <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">Complaint and feedback queue coming from the Assistant page.</p>
              </div>
              <div className="rounded-full bg-[color:var(--page-secondary)] px-3 py-1 text-xs font-medium text-[color:var(--text-secondary)]">
                {assistantFeedback.length} total
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <div className="theme-card-soft rounded-2xl px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Open</p>
                <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{feedbackCounts.open}</p>
              </div>
              <div className="theme-card-soft rounded-2xl px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Resolved</p>
                <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{feedbackCounts.resolved}</p>
              </div>
              <div className="rounded-2xl bg-rose-50 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-rose-700">Bug reports</p>
                <p className="mt-1 text-xl font-semibold text-rose-800">{feedbackCounts.bugs}</p>
              </div>
              <div className="rounded-2xl bg-sky-50 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-sky-700">Feature asks</p>
                <p className="mt-1 text-xl font-semibold text-sky-800">{feedbackCounts.feature}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={feedbackSearch}
                onChange={(event) => setFeedbackSearch(event.target.value)}
                placeholder="Search by email, subject, message, or category"
                className="h-11 w-full rounded-2xl border [border-color:var(--border)] bg-[color:var(--card-bg)] px-4 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] outline-none focus:border-sky-300"
              />
              <div className="flex flex-wrap gap-2">
                {(["OPEN", "ALL", "RESOLVED", "BUG", "COMPLAINT", "FEATURE", "SUPPORT"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFeedbackFilter(value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      feedbackFilter === value
                        ? "bg-slate-900 text-white"
                        : "border [border-color:var(--border)] bg-[color:var(--card-bg)] text-[color:var(--text-secondary)]"
                    }`}
                  >
                    {value.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 max-h-[42rem] space-y-3 overflow-y-auto pr-1">
              {filteredFeedback.length === 0 ? (
                <div className="rounded-2xl border border-dashed [border-color:var(--border)] px-4 py-8 text-center text-sm text-[color:var(--text-secondary)]">
                  No assistant complaints match the current filter.
                </div>
              ) : null}
              {filteredFeedback.map((item) => {
                const category = (item.category || "COMPLAINT") as AssistantFeedbackCategory;
                return (
                  <article key={item.id} className="theme-card-soft rounded-[1.5rem] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${feedbackTone(category)}`}>
                            {assistantFeedbackCategoryLabel(category)}
                          </span>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.status === "NEW" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                            {item.status === "NEW" ? "Open" : "Resolved"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">
                          {item.subject?.trim() || assistantFeedbackCategoryLabel(category)}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                          {(item.name?.trim() || "Unknown user")} · {item.email} · {formatStableDateTime(item.createdAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        loading={pending && pendingKey === `feedback:${item.id}`}
                        disabled={pending || item.status === "RESOLVED"}
                        onClick={() =>
                          runAdminTask(
                            `feedback:${item.id}`,
                            () => resolveAssistantFeedback({ feedbackId: item.id }).then(() => undefined),
                            `Marked assistant feedback ${item.id} as resolved.`,
                          )
                        }
                      >
                        Mark resolved
                      </Button>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--text-primary)]">{item.message}</p>

                    {item.sourceQuestion ? (
                      <div className="mt-3 rounded-2xl bg-[color:var(--card-bg)] px-3 py-3 text-xs text-[color:var(--text-secondary)]">
                        <p className="font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Source question</p>
                        <p className="mt-1 whitespace-pre-wrap">{item.sourceQuestion}</p>
                      </div>
                    ) : null}

                    <p className="mt-3 text-xs text-[color:var(--text-muted)]">
                      {item.status === "RESOLVED"
                        ? `Resolved${item.handledBy?.email ? ` by ${item.handledBy.email}` : ""}${item.resolvedAt ? ` on ${formatStableDateTime(item.resolvedAt)}` : ""}.`
                        : `Submitted from ${item.sourcePage}.`}
                    </p>
                  </article>
                );
              })}
            </div>
          </article>

          <article className="theme-card rounded-[1.75rem] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[color:var(--text-primary)]">Contact inbox</p>
                <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">Public contact form submissions.</p>
              </div>
              <div className="rounded-full bg-[color:var(--page-secondary)] px-3 py-1 text-xs font-medium text-[color:var(--text-secondary)]">
                {unresolvedInquiries} open
              </div>
            </div>

            <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              {inquiries.length === 0 ? (
                <div className="rounded-2xl border border-dashed [border-color:var(--border)] px-4 py-6 text-sm text-[color:var(--text-secondary)]">
                  No contact inquiries yet.
                </div>
              ) : null}
              {inquiries.map((item) => (
                <article key={item.id} className="theme-card-soft rounded-[1.5rem] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                        {item.name} <span className="font-normal text-[color:var(--text-secondary)]">({item.email})</span>
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--text-muted)]">{formatStableDateTime(item.createdAt)}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={pending && pendingKey === `inquiry:${item.id}`}
                      disabled={pending || item.status === "RESOLVED"}
                      onClick={() =>
                        runAdminTask(
                          `inquiry:${item.id}`,
                          () => resolveContactInquiry({ inquiryId: item.id }).then(() => undefined),
                          `Marked inquiry ${item.id} as resolved.`,
                        )
                      }
                    >
                      {item.status === "RESOLVED" ? "Resolved" : "Mark resolved"}
                    </Button>
                  </div>
                  {item.subject ? <p className="mt-3 text-sm font-medium text-[color:var(--text-primary)]">{item.subject}</p> : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--text-secondary)]">{item.message}</p>
                  <p className="mt-3 text-xs text-[color:var(--text-muted)]">
                    {item.status === "RESOLVED"
                      ? `Resolved${item.handledBy?.email ? ` by ${item.handledBy.email}` : ""}`
                      : "Awaiting admin response"}
                  </p>
                </article>
              ))}
            </div>
          </article>
        </div>
      </section>
    </section>
  );
}
