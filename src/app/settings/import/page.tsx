"use client";

import { useRef, useState } from "react";
import { Upload, Download, Loader2, Check, AlertCircle } from "lucide-react";
import { useToastStore } from "@/components/app/action-toast";
import { importClientsFromCSV, exportWorkspaceData } from "@/app/actions/import-export";

export default function ImportExportPage() {
  const { addToast } = useToastStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  function handleStartImport() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const result = await importClientsFromCSV(text);
      setImportResult(result);
      if (result.imported > 0) {
        addToast(`Imported ${result.imported} client${result.imported === 1 ? "" : "s"}`);
      } else if (result.errors.length > 0) {
        addToast(`Import failed: ${result.errors[0]}`);
      }
    } catch {
      addToast("Import failed unexpectedly");
    }
    setImporting(false);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportWorkspaceData();
      if (data.error) {
        addToast(`Export failed: ${data.error}`);
        setExporting(false);
        return;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iworkr-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("Workspace data exported");
    } catch {
      addToast("Export failed unexpectedly");
    }
    setExporting(false);
  }

  return (
    <>
      <h1 className="mb-2 text-2xl font-medium tracking-tight text-zinc-100">Import / Export</h1>
      <p className="mb-6 text-[13px] text-zinc-600">Import data from other platforms or export your workspace data.</p>

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
