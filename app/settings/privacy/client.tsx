"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importTransactionsFromCsv, updatePrivacySettings } from "../actions";

export function PrivacySettingsForm({ analyticsOptIn, tipsOptIn }: { analyticsOptIn: boolean; tipsOptIn: boolean }) {
  const router = useRouter();
  const [analytics, setAnalytics] = useState(analyticsOptIn);
  const [tips, setTips] = useState(tipsOptIn);
  const [pending, start] = useTransition();
  const [exportPending, setExportPending] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAnalytics(analyticsOptIn);
  }, [analyticsOptIn]);

  useEffect(() => {
    setTips(tipsOptIn);
  }, [tipsOptIn]);

  const hasChanges = analytics !== analyticsOptIn || tips !== tipsOptIn;

  const importCsvFile = async (file: File) => {
    setImportPending(true);
    setImportSummary(null);
    try {
      const text = await file.text();
      const result = await importTransactionsFromCsv({ csv: text });
      const parts = [`${result.imported} imported`];
      if (result.skipped > 0) parts.push(`${result.skipped} already imported`);
      if (result.errors.length > 0) parts.push(`${result.errors.length} row(s) had problems`);
      const summary = parts.join(", ") + ".";
      setImportSummary(
        result.errors.length > 0
          ? `${summary} First issue (line ${result.errors[0].line}): ${result.errors[0].reason}`
          : summary
      );
      if (result.imported > 0) toast.success(`Imported ${result.imported} transaction(s).`);
      else if (result.skipped > 0) toast.info("Everything in this file was already imported.");
      else toast.error("No rows could be imported — check the file format.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImportPending(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const downloadExport = async (format: "csv" | "json") => {
    setExportPending(true);
    try {
      const res = await fetch(`/api/export/${format}`);
      if (!res.ok) throw new Error("Export failed. Please try again.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Your data has been downloaded as ${format.toUpperCase()}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setExportPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-sm font-semibold">Your data</h2>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Download a copy of all your financial data at any time.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="outline"
            loading={exportPending}
            disabled={exportPending}
            onClick={() => downloadExport("csv")}
          >
            Download as CSV
          </Button>
          <Button
            variant="outline"
            loading={exportPending}
            disabled={exportPending}
            onClick={() => downloadExport("json")}
          >
            Download as JSON
          </Button>
        </div>
        <p className="mt-3 text-xs text-[color:var(--text-muted)]">Your export includes all transactions, goals, notes, and budget data.</p>

        <div className="mt-5 border-t border-black/10 pt-4">
          <h3 className="text-sm font-semibold">Import transactions</h3>
          <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
            Upload a CSV with <code>date</code>, <code>type</code> (income/expense/savings), and <code>amount</code> columns —
            <code>category</code>, <code>memo</code>, and <code>pending</code> are optional. Re-importing the same file never duplicates rows.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCsvFile(file);
              }}
            />
            <Button
              variant="outline"
              loading={importPending}
              disabled={importPending}
              onClick={() => importInputRef.current?.click()}
            >
              Import from CSV
            </Button>
          </div>
          {importSummary ? <p className="mt-2 text-xs text-[color:var(--text-secondary)]">{importSummary}</p> : null}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Privacy preferences</h2>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Control how your data is used to improve your experience.</p>
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded"
            />
            <span>
              <span className="block text-sm">Help improve the app</span>
              <span className="block text-xs text-[color:var(--text-muted)]">Allow us to collect anonymous usage data to make the app better.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={tips}
              onChange={(e) => setTips(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded"
            />
            <span>
              <span className="block text-sm">Personalised tips</span>
              <span className="block text-xs text-[color:var(--text-muted)]">Get money-saving tips tailored to your spending patterns.</span>
            </span>
          </label>
        </div>
        <div className="mt-4">
          <Button
            loading={pending}
            disabled={pending || !hasChanges}
            onClick={() => {
              start(async () => {
                try {
                  await updatePrivacySettings({ analyticsOptIn: analytics, tipsOptIn: tips });
                  router.refresh();
                  toast.success("Privacy preferences saved.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to save.");
                }
              });
            }}
          >
            Save preferences
          </Button>
        </div>
      </section>
    </div>
  );
}
