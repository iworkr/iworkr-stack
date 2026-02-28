"use client";

import { useRef, useState } from "react";
import { Upload, Download, Loader2 } from "lucide-react";
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

  function handleStartImport() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    e.target.value = "";

    setImporting(true);
    try {
      const text = await file.text();
      const result = await importClientsFromCSV(orgId, text);
      if (result.error) {
        addToast(`Import error: ${result.error}`);
      } else {
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
          <h3 className="text-[14px] font-medium text-zinc-200">Import data</h3>
          <p className="mt-1 mb-4 text-[12px] text-zinc-600">Import clients, jobs, and invoices from CSV or other platforms.</p>
          <button
            onClick={handleStartImport}
            disabled={importing}
            className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50"
          >
            {importing && <Loader2 size={12} className="animate-spin" />}
            {importing ? "Importing..." : "Start import"}
          </button>
        </div>
        <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
          <Download size={20} className="mb-3 text-zinc-500" />
          <h3 className="text-[14px] font-medium text-zinc-200">Export data</h3>
          <p className="mt-1 mb-4 text-[12px] text-zinc-600">Download all your workspace data as CSV or JSON.</p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50"
          >
            {exporting && <Loader2 size={12} className="animate-spin" />}
            {exporting ? "Exporting..." : "Export all data"}
          </button>
        </div>
      </div>
    </>
  );
}
