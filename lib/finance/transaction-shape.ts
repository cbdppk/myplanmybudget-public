export type QuickFlowMode = "INCOME" | "OUTFLOW";
export type QuickIncomeKind = "REGULAR" | "EXTRA";
export type QuickOutflowKind = "EXPENSE" | "SAVINGS" | "EXTRA_EXPENSE";

export function quickTransactionPosting(params: {
  flowMode: QuickFlowMode;
  incomeKind: QuickIncomeKind;
  outflowKind: QuickOutflowKind;
}) {
  if (params.flowMode === "INCOME") {
    return params.incomeKind === "REGULAR"
      ? { kind: "BASELINE" as const, type: "INCOME" as const, extraType: undefined }
      : { kind: "EXTRA" as const, type: "INCOME" as const, extraType: "EXTRA_INCOME" as const };
  }
  if (params.outflowKind === "EXPENSE") {
    return { kind: "BASELINE" as const, type: "EXPENSE" as const, extraType: undefined };
  }
  if (params.outflowKind === "SAVINGS") {
    return { kind: "EXTRA" as const, type: "SAVINGS" as const, extraType: "EXTRA_SAVINGS" as const };
  }
  return { kind: "EXTRA" as const, type: "EXPENSE" as const, extraType: "EXTRA_EXPENSE" as const };
}
