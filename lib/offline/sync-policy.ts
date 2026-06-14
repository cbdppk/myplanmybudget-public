export function shouldQueueOfflineFallback(error: unknown) {
  if (!(error instanceof Error)) return true;
  const text = error.message.toLowerCase();
  if (
    text.includes("not possible unless you earn more") ||
    text.includes("budget is fully used") ||
    text.includes("allocation exceeds baseline") ||
    text.includes("category name is required") ||
    text.includes("reserved")
  ) {
    return false;
  }
  return (
    text.includes("network") ||
    text.includes("fetch") ||
    text.includes("timeout") ||
    text.includes("connection") ||
    text.includes("offline")
  );
}
