export default function PostLoginLoading() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[color:var(--page-bg)]">
      <span
        className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--border)] border-t-[color:var(--accent)]"
        aria-hidden="true"
      />
    </div>
  );
}
