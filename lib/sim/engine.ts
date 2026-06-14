export type SimulationPoint = {
  monthIndex: number;
  income: number;
  expenses: number;
  debtPayment: number;
  totalDebt: number;
  balance: number;
};

export type DebtStrategy = "AVALANCHE" | "SNOWBALL";

export type SimulationDebtInput = {
  id: string;
  name: string;
  balance: number;
  aprPct: number;
  minPayment: number;
};

export type SimulationSummary = {
  runwayMonths: number | null;
  negativeMonths: number;
  endingBalance: number;
  endingDebt: number;
  payoffMonth: number | null;
};

export function buildSimulationTimeline(input: {
  startBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  horizonMonths: number;
  debtStrategy?: DebtStrategy;
  extraDebtPayment?: number;
  debts?: SimulationDebtInput[];
}) {
  const horizonMonths = Math.max(1, Math.floor(input.horizonMonths));
  const debtStrategy = input.debtStrategy ?? "AVALANCHE";
  const extraDebtPayment = Math.max(0, input.extraDebtPayment ?? 0);
  const debts = (input.debts ?? [])
    .filter((item) => item.balance > 0)
    .map((item) => ({
      ...item,
      balance: Math.max(0, item.balance),
      aprPct: Math.max(0, item.aprPct),
      minPayment: Math.max(0, item.minPayment),
    }));

  const output: SimulationPoint[] = [];
  let balance = input.startBalance;
  let firstNegativeMonth: number | null = null;
  let payoffMonth: number | null | undefined = debts.length === 0 ? null : undefined;

  for (let month = 1; month <= horizonMonths; month += 1) {
    for (const debt of debts) {
      if (debt.balance <= 0) continue;
      // Round after each accrual to prevent floating-point drift over long horizons.
      debt.balance = Math.round((debt.balance + debt.balance * (debt.aprPct / 100 / 12)) * 100) / 100;
    }

    const totalDebtBeforePayment = debts.reduce((sum, item) => sum + item.balance, 0);
    let paymentPool = Math.min(totalDebtBeforePayment, Math.max(0, extraDebtPayment + debts.reduce((sum, item) => sum + item.minPayment, 0)));

    // Apply minimum payments first.
    for (const debt of debts) {
      if (paymentPool <= 0 || debt.balance <= 0) continue;
      const minPayment = Math.min(debt.balance, debt.minPayment);
      const payment = Math.min(paymentPool, minPayment);
      debt.balance -= payment;
      paymentPool -= payment;
    }

    // Allocate the remainder by the selected payoff strategy.
    if (paymentPool > 0) {
      const rankedDebts = [...debts].sort((a, b) => {
        if (debtStrategy === "SNOWBALL") {
          // Lowest balance first; break ties by highest APR.
          const diff = a.balance - b.balance;
          return diff !== 0 ? diff : b.aprPct - a.aprPct;
        }
        // Highest APR first; break ties by lowest balance.
        const diff = b.aprPct - a.aprPct;
        return diff !== 0 ? diff : a.balance - b.balance;
      });

      for (const debt of rankedDebts) {
        if (paymentPool <= 0 || debt.balance <= 0) continue;
        const payment = Math.min(paymentPool, debt.balance);
        debt.balance -= payment;
        paymentPool -= payment;
      }
    }

    const debtPayment = totalDebtBeforePayment - debts.reduce((sum, item) => sum + item.balance, 0);
    balance += input.monthlyIncome - input.monthlyExpenses - debtPayment;

    if (balance < 0 && firstNegativeMonth === null) {
      firstNegativeMonth = month;
    }

    const totalDebt = debts.reduce((sum, item) => sum + item.balance, 0);
    if (payoffMonth === undefined && totalDebt <= 0.01) {
      payoffMonth = month;
    }

    output.push({
      monthIndex: month,
      income: input.monthlyIncome,
      expenses: input.monthlyExpenses,
      debtPayment,
      totalDebt,
      balance,
    });
  }

  const negativeMonths = output.filter((point) => point.balance < 0).length;
  const endingBalance = output[output.length - 1]?.balance ?? input.startBalance;
  const endingDebt = output[output.length - 1]?.totalDebt ?? 0;

  return {
    timeline: output,
    summary: {
      runwayMonths: firstNegativeMonth ? Math.max(0, firstNegativeMonth - 1) : null,
      negativeMonths,
      endingBalance,
      endingDebt,
      payoffMonth: payoffMonth ?? null,
    } satisfies SimulationSummary,
  };
}
