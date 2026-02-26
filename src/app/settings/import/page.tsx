"use client";

import { useRef } from "react";
import { Upload, Download } from "lucide-react";
import { useToastStore } from "@/components/app/action-toast";

export default function ImportExportPage() {
  const { addToast } = useToastStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleStartImport() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    addToast("CSV import processing is being set up");
    // Reset file input so the same file can be selected again
    e.target.value = "";
  }

  function handleExport() {
    addToast("Export feature coming soon");
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
            className="rounded-md border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[rgba(255,255,255,0.04)]"
          >
            Start import
          </button>
        </div>
        <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
          <Download size={20} className="mb-3 text-zinc-500" />
          <h3 className="text-[14px] font-medium text-zinc-200">Export data</h3>
          <p className="mt-1 mb-4 text-[12px] text-zinc-600">Download all your workspace data as CSV or JSON.</p>
          <button
            onClick={handleExport}
            className="rounded-md border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[rgba(255,255,255,0.04)]"
          >
            Export all data
          </button>
        </div>
      </div>
    </>
  );
}
