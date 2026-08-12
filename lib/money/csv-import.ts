/**
 * Pure CSV parsing + validation for transaction import. No I/O — the DB side
 * lives in lib/data/import.ts so this stays unit-testable.
 *
 * Expected columns (header names case-insensitive): date, type, amount, and
 * optionally category, memo/note, pending. Extra columns are ignored so most
 * bank exports work after renaming a header or two.
 */

export const MAX_IMPORT_ROWS = 500;

export type ImportRow = {
  line: number;
  occurredAt: string; // YYYY-MM-DD
  type: "INCOME" | "EXPENSE" | "SAVINGS";
  amount: number;
  category?: string;
  memo?: string;
  pending?: boolean;
};

export type ImportRowError = { line: number; reason: string };

/** RFC 4180-style parser: quoted fields, escaped quotes, CRLF/LF endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    // Skip fully empty lines.
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

const TYPE_ALIASES = new Map<string, ImportRow["type"]>([
  ["income", "INCOME"],
  ["in", "INCOME"],
  ["credit", "INCOME"],
  ["expense", "EXPENSE"],
  ["out", "EXPENSE"],
  ["debit", "EXPENSE"],
  ["spend", "EXPENSE"],
  ["savings", "SAVINGS"],
  ["saving", "SAVINGS"],
]);

const TRUTHY = new Set(["true", "yes", "1", "pending"]);

function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    const [, y, m, d] = iso;
    const month = Number(m);
    const day = Number(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${y}-${m}-${d}`;
    return null;
  }
  // dd/mm/yyyy or dd-mm-yyyy (day-first, the common non-US bank format)
  const dayFirst = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const year = dayFirst[3];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

export function normalizeImportRows(records: string[][]): { rows: ImportRow[]; errors: ImportRowError[] } {
  const errors: ImportRowError[] = [];
  const rows: ImportRow[] = [];
  if (records.length === 0) {
    return { rows, errors: [{ line: 1, reason: "The file is empty." }] };
  }

  const header = records[0].map((cell) => cell.trim().toLowerCase());
  const col = (names: string[]) => header.findIndex((name) => names.includes(name));
  const dateCol = col(["date", "occurred", "occurredat", "occurred_at"]);
  const typeCol = col(["type", "direction", "kind"]);
  const amountCol = col(["amount", "value", "sum"]);
  const categoryCol = col(["category", "budget"]);
  const memoCol = col(["memo", "note", "description", "details"]);
  const pendingCol = col(["pending", "status"]);

  if (dateCol < 0 || typeCol < 0 || amountCol < 0) {
    return {
      rows,
      errors: [{ line: 1, reason: 'Header must include "date", "type", and "amount" columns.' }],
    };
  }

  const dataRecords = records.slice(1, 1 + MAX_IMPORT_ROWS);
  if (records.length - 1 > MAX_IMPORT_ROWS) {
    errors.push({ line: MAX_IMPORT_ROWS + 2, reason: `Import is capped at ${MAX_IMPORT_ROWS} rows per file; the rest were ignored.` });
  }

  dataRecords.forEach((record, index) => {
    const line = index + 2; // 1-based, after header
    const occurredAt = normalizeDate(record[dateCol] ?? "");
    if (!occurredAt) {
      errors.push({ line, reason: "Unrecognized date — use YYYY-MM-DD or DD/MM/YYYY." });
      return;
    }
    const rawType = (record[typeCol] ?? "").trim().toLowerCase();
    const type = TYPE_ALIASES.get(rawType);
    if (!type) {
      errors.push({ line, reason: `Unknown type "${record[typeCol] ?? ""}" — use income, expense, or savings.` });
      return;
    }
    const amount = Math.round(Math.abs(Number((record[amountCol] ?? "").replace(/[, ]/g, ""))) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ line, reason: `Invalid amount "${record[amountCol] ?? ""}".` });
      return;
    }
    const category = categoryCol >= 0 ? (record[categoryCol] ?? "").trim() : "";
    const memo = memoCol >= 0 ? (record[memoCol] ?? "").trim() : "";
    const pendingRaw = pendingCol >= 0 ? (record[pendingCol] ?? "").trim().toLowerCase() : "";

    rows.push({
      line,
      occurredAt,
      type,
      amount,
      category: category || undefined,
      memo: memo.slice(0, 200) || undefined,
      pending: TRUTHY.has(pendingRaw) || undefined,
    });
  });

  return { rows, errors };
}
