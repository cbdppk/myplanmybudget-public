const SLOW_OPERATION_MS = Number(process.env.OP_SLOW_MS ?? 1200);
const PERF_LOGS_ENABLED = process.env.PERF_LOGS === "true";

export async function withPerfTiming<T>(
  operation: string,
  meta: Record<string, unknown>,
  run: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    return await run();
  } finally {
    const ms = Date.now() - start;
    if (PERF_LOGS_ENABLED && ms >= SLOW_OPERATION_MS) {
      console.warn("slow_operation", JSON.stringify({ operation, ms, ...meta }));
    }
  }
}
