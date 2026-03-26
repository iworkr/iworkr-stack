"use client";

import { RefreshCw, CheckCheck, CloudUpload } from "lucide-react";

export type TravelLedgerView = "PENDING_REVIEW" | "FLAGGED_VARIANCE" | "APPROVED" | "BILLED";

interface TravelTab {
  id: TravelLedgerView;
  label: string;
  count: number;
}

interface TravelActionBarProps {
  view: TravelLedgerView;
  tabs: TravelTab[];
  isBusy?: boolean;
  onViewChange: (view: TravelLedgerView) => void;
  onRefresh: () => void;
  onBulkApproveClean: () => void;
  onPushToLedger: () => void;
  canBulkApprove: boolean;
  canPushToLedger: boolean;
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 whitespace-nowrap rounded-md px-3 text-[11px] font-medium transition-colors ${
        active
          ? "bg-white text-black"
          : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {count > 0 && (
          <span
            className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
              active ? "bg-black/15 text-black" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {count}
          </span>
        )}
      </span>
    </button>
  );
}

export function TravelActionBar({
  view,
  tabs,
  isBusy = false,
  onViewChange,
  onRefresh,
  onBulkApproveClean,
  onPushToLedger,
  canBulkApprove,
  canPushToLedger,
}: TravelActionBarProps) {
  return (
    <div className="w-full border-b border-white/[0.06] bg-[#050505] px-4 py-3">
      <div className="flex w-full items-center justify-between gap-3">
        {/* LEFT: View Toggles */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-zinc-900 p-1">
            {tabs.map((tab) => (
              <TabButton
                key={tab.id}
                active={view === tab.id}
                label={tab.label}
                count={tab.count}
                onClick={() => onViewChange(tab.id)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: Mutation Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isBusy}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-white/[0.08] px-3 text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-300 disabled:opacity-50"
          >
            <RefreshCw size={13} className={isBusy ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={onBulkApproveClean}
            disabled={!canBulkApprove || isBusy}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-700/30 px-3 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-950/40 disabled:opacity-40"
          >
            <CheckCheck size={13} />
            Bulk Approve Clean
          </button>

          <button
            type="button"
            onClick={onPushToLedger}
            disabled={!canPushToLedger || isBusy}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-zinc-100 px-3 text-[11px] font-semibold text-black transition-colors hover:bg-white disabled:opacity-40"
          >
            <CloudUpload size={13} />
            Approve & Push to Ledger-Prime
          </button>
        </div>
      </div>
    </div>
  );
}
