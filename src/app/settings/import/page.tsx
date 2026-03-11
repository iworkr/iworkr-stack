"use client";

import { useRef, useState } from "react";
import { Upload, Download, Loader2, Check, AlertCircle } from "lucide-react";
import { useToastStore } from "@/components/app/action-toast";
import { useOrg } from "@/lib/hooks/use-org";
import { importClientsFromCSV } from "@/app/actions/clients";
import { exportWorkspaceData } from "@/app/actions/settings";

export default function ImportExportPage() {
  const { addToast } = useToastStore();
  const { orgId } = useOrg();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  function handleStartImport() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    e.target.value = "";

    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const result = await importClientsFromCSV(orgId, text);
      if (result.error) {
        addToast(`Import error: ${result.error}`);
      } else {
        setImportResult({ imported: result.imported ?? 0, skipped: result.skipped ?? 0, errors: [] });
        addToast(`Imported ${result.imported} clients (${result.skipped} skipped)`);
      }
    } catch {
      addToast("Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    if (!orgId) return;
    setExporting(true);
    try {
      const result = await exportWorkspaceData(orgId, ["clients", "jobs", "invoices"]);
      if (result.error || !result.data) {
        addToast(`Export error: ${result.error || "No data"}`);
        return;
      }
      for (const [table, csv] of Object.entries(result.data)) {
        if (csv.startsWith("Error:")) continue;
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${table}-export.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      addToast("Export complete — files downloaded");
    } catch {
      addToast("Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {/* ─── Page intro — premium control-center header ─── */}
      <div className="mb-10">
        <span className="font-mono text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
          Import &amp; Export
        </span>
        <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          Import / Export
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Import data from other platforms or export your workspace data.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
          <Upload size={20} className="mb-3 text-zinc-500" />
          <h3 className="text-[14px] font-medium text-zinc-200">Import clients</h3>
          <p className="mt-1 mb-4 text-[12px] text-zinc-600">
            Upload a CSV with columns: name, email, phone, address, type.
          </p>
          <button
            onClick={handleStartImport}
            disabled={importing}
            className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50"
          >
            {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {importing ? "Importing..." : "Upload CSV"}
          </button>

          {importResult && (
            <div className="mt-3 rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check size={10} />
                {importResult.imported} imported
              </div>
              {importResult.skipped > 0 && (
                <div className="mt-1 text-amber-400">{importResult.skipped} skipped</div>
              )}
              {importResult.errors.slice(0, 3).map((err, i) => (
                <div key={i} className="mt-1 flex items-start gap-1 text-red-400">
                  <AlertCircle size={10} className="mt-0.5 shrink-0" />
                  {err}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
          <Download size={20} className="mb-3 text-zinc-500" />
          <h3 className="text-[14px] font-medium text-zinc-200">Export data</h3>
          <p className="mt-1 mb-4 text-[12px] text-zinc-600">Download all clients, jobs, and invoices as JSON.</p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50"
          >
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {exporting ? "Exporting..." : "Export all data"}
          </button>
        </div>
      </div>
    </>
  );
}
