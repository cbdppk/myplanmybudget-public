import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[color:var(--page-bg)] p-8 text-center text-[color:var(--text-primary)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-3xl font-bold text-sky-700">
        404
      </div>
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">Page not found</h1>
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/"
          className="rounded-xl border [border-color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--page-secondary)]"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
