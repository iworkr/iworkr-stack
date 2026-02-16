"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>

        <h2 className="text-lg font-semibold text-white mb-1.5">
          Module error
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          This section encountered an error. Your data is safe.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-700 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
