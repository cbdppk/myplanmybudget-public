import Link from "next/link";

export default function SettingsHelpPage() {
  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-sm font-semibold">How MyPlan MyBudget works</h2>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          MyPlan MyBudget helps you plan your money, track your spending, and reach your savings goals — all in one place.
        </p>
        <ul className="mt-4 space-y-3 text-sm text-[color:var(--text-secondary)]">
          <li className="flex gap-2">
            <span className="mt-0.5 text-sky-500">•</span>
            <span><span className="font-medium text-[color:var(--text-primary)]">Set your budget:</span> Go to <Link href="/settings/budget" className="text-sky-600 underline underline-offset-2 dark:text-sky-400">Budget &amp; Currency</Link> to enter your monthly income, expenses, and savings target. This becomes your spending plan.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-sky-500">•</span>
            <span><span className="font-medium text-[color:var(--text-primary)]">Track transactions:</span> Log your income and expenses on the <Link href="/track" className="text-sky-600 underline underline-offset-2 dark:text-sky-400">Transactions</Link> page as they happen. Every entry updates your real balance instantly.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-sky-500">•</span>
            <span><span className="font-medium text-[color:var(--text-primary)]">Set goals:</span> On the <Link href="/goals" className="text-sky-600 underline underline-offset-2 dark:text-sky-400">Goals</Link> page, create targets for things you are saving towards — a trip, a new gadget, or an emergency fund. The app tracks your progress automatically.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-sky-500">•</span>
            <span><span className="font-medium text-[color:var(--text-primary)]">Watch your dashboard:</span> Your <Link href="/dashboard" className="text-sky-600 underline underline-offset-2 dark:text-sky-400">Dashboard</Link> gives you a live view of income, spending, savings, and how much flex money you have left.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-sky-500">•</span>
            <span><span className="font-medium text-[color:var(--text-primary)]">Run simulations:</span> The <Link href="/simulate" className="text-sky-600 underline underline-offset-2 dark:text-sky-400">Simulate</Link> page lets you test &quot;what if&quot; scenarios — like a new job, a new expense, or a loan — without affecting your real data.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-sky-500">•</span>
            <span><span className="font-medium text-[color:var(--text-primary)]">Ask the assistant:</span> Use the <Link href="/assistant" className="text-sky-600 underline underline-offset-2 dark:text-sky-400">Assistant</Link> to ask questions about your budget, get guidance, or understand what a number means.</span>
          </li>
        </ul>
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold">Tips for getting started</h3>
        <ul className="mt-3 space-y-2 text-sm text-[color:var(--text-secondary)]">
          <li className="flex gap-2"><span className="text-sky-500">1.</span><span>Start by setting up your budget in <Link href="/settings/budget" className="text-sky-600 underline underline-offset-2 dark:text-sky-400">Budget &amp; Currency</Link>.</span></li>
          <li className="flex gap-2"><span className="text-sky-500">2.</span><span>Log income and expenses as they happen to keep your balance accurate.</span></li>
          <li className="flex gap-2"><span className="text-sky-500">3.</span><span>Check your dashboard daily to see your spending pace and flex room.</span></li>
          <li className="flex gap-2"><span className="text-sky-500">4.</span><span>Create a savings goal so you always have something to save towards.</span></li>
          <li className="flex gap-2"><span className="text-sky-500">5.</span><span>Use the AI assistant if you have questions — just ask in plain language.</span></li>
        </ul>
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold">Need help?</h3>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Our support team is ready to help you with any questions.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href="mailto:support@myplanmybudget.app"
            className="inline-flex items-center gap-1.5 rounded-xl border [border-color:var(--border)] px-4 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
          >
            Contact support
          </a>
          <Link
            href="/assistant"
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-sm text-white hover:bg-sky-600"
          >
            Ask the assistant
          </Link>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold">About MyPlan MyBudget</h3>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          MyPlan MyBudget is a personal finance app built to help you take control of your money. Plan your budget, track your spending, set goals, and simulate financial decisions — all in one clean, easy-to-use app.
        </p>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          Built by EyeHai Technologies.
        </p>
      </section>
    </div>
  );
}
