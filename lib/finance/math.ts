export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function getPeriodDayMetrics(periodStart: Date, periodEnd: Date, now: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / dayMs) + 1);
  const effectiveNow = now > periodEnd ? periodEnd : now;
  const elapsedRaw = Math.floor((effectiveNow.getTime() - periodStart.getTime()) / dayMs) + 1;
  const elapsedDays = Math.max(0, Math.min(totalDays, elapsedRaw));
  return { totalDays, elapsedDays, effectiveNow };
}

export function computeCarryForwardFromGroups(rows: Array<{ type: string; amount: number }>) {
  return rows.reduce((sum, row) => {
    if (row.type === "INCOME") return sum + row.amount;
    if (row.type === "EXPENSE") return sum - row.amount;
    return sum;
  }, 0);
}
