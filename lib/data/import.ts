import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/data/utils";
import { createQuickTransaction } from "@/lib/data/transactions";
import { logAudit } from "@/lib/data/audit";
import { normalizeImportRows, parseCsv, type ImportRowError } from "@/lib/money/csv-import";
import { Prisma } from "@prisma/client";

const MAX_CSV_BYTES = 512 * 1024;

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: ImportRowError[];
};

/**
 * Import transactions from CSV (columns: date, type, amount, and optional
 * category/memo/pending). Each row is claimed in the OfflineSyncOp idempotency
 * ledger under a content hash, so re-importing the same file never duplicates
 * transactions — rows already applied are counted as skipped.
 *
 * Posting semantics match the money model: income and categorized expenses
 * are BASELINE (merge with the plan / consume category budgets); savings rows
 * are EXTRA_SAVINGS and fund a matching goal via the normal create path.
 */
export async function importTransactionsCsv(csvText: string): Promise<ImportResult> {
  const user = await getActiveUser();
  if (Buffer.byteLength(csvText, "utf8") > MAX_CSV_BYTES) {
    throw new Error("CSV file is too large (512KB max).");
  }

  const { rows, errors } = normalizeImportRows(parseCsv(csvText));
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const fingerprint = createHash("sha256")
      .update([row.line, row.occurredAt, row.type, row.amount, row.category ?? "", row.memo ?? ""].join("|"))
      .digest("hex");
    const opId = `csvimport:${fingerprint}`;

    try {
      await prisma.offlineSyncOp.create({ data: { userId: user.id, opId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        skipped += 1;
        continue;
      }
      errors.push({ line: row.line, reason: "Import bookkeeping failed." });
      continue;
    }

    try {
      await createQuickTransaction({
        kind: row.type === "SAVINGS" ? "EXTRA" : "BASELINE",
        type: row.type,
        extraType: row.type === "SAVINGS" ? "EXTRA_SAVINGS" : undefined,
        amount: row.amount,
        category: row.category,
        memo: row.memo,
        occurredAt: row.occurredAt,
        pending: row.pending,
      });
      imported += 1;
    } catch (error) {
      await prisma.offlineSyncOp
        .deleteMany({ where: { userId: user.id, opId } })
        .catch(() => undefined);
      errors.push({ line: row.line, reason: error instanceof Error ? error.message : "Row failed to import." });
    }
  }

  logAudit(user.id, "transactions_import", { imported, skipped, errorCount: errors.length });
  return { imported, skipped, errors };
}
