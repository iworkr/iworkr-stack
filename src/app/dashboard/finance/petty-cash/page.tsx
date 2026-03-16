"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Wallet } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { getWalletHealthSummaryAction, listWalletDiscrepanciesAction } from "@/app/actions/wallets";

type WalletHealth = {
  id: string;
  name: string;
  current_balance: number;
  updated_at: string;
  wallet_type: "cash" | "debit_card";
  is_stale: boolean;
  has_open_discrepancy: boolean;
};

type Discrepancy = {
  id: string;
  discrepancy_phase: "opening" | "closing" | "handover";
  variance_amount: number;
  created_at: string;
  status: "open" | "resolved" | "written_off";
  participant_wallets?: { name?: string } | null;
};

function fmtMoney(n: number) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PettyCashDashboardPage() {
  const { orgId } = useOrg();
  const [pending, startTransition] = useTransition();
  const [wallets, setWallets] = useState<WalletHealth[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [totals, setTotals] = useState({ active_wallets: 0, stale_wallets: 0, discrepant_wallets: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;
    startTransition(async () => {
      try {
        const [health, issues] = await Promise.all([
          getWalletHealthSummaryAction(orgId),
          listWalletDiscrepanciesAction({ organization_id: orgId }),
        ]);
        setWallets((health.wallets || []) as WalletHealth[]);
        setTotals(health.totals || totals);
        setDiscrepancies((issues || []) as Discrepancy[]);
      } catch (e) {
        setError((e as Error).message);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-6 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-400" />
          <h1 className="text-lg font-semibold">Petty Cash Ledger</h1>
          <span className="rounded-md border border-zinc-700 px-2 py-0.5 font-mono text-xs text-zinc-400">
            Global Wallet Health
          </span>
        </div>

        {error && <p className="mb-3 text-sm text-rose-300">{error}</p>}

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Active Wallets</p>
            <p className="mt-1 font-mono text-2xl text-zinc-100">{totals.active_wallets}</p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-xs uppercase tracking-widest text-amber-300">Unreconciled {"(48h)"}</p>
            <p className="mt-1 font-mono text-2xl text-amber-300">{totals.stale_wallets}</p>
          </div>
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
            <p className="text-xs uppercase tracking-widest text-rose-300">Open Discrepancies</p>
            <p className="mt-1 font-mono text-2xl text-rose-300">{totals.discrepant_wallets}</p>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">Wallet Status</p>
          <div className="space-y-2">
            {wallets.map((wallet) => {
              const flagged = wallet.is_stale || wallet.has_open_discrepancy;
              return (
                <div key={wallet.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {flagged ? (
                        <AlertTriangle className="h-4 w-4 text-amber-300" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      )}
                      <p className="text-sm text-zinc-200">{wallet.name}</p>
                    </div>
                    <p className="font-mono text-sm text-emerald-300">${fmtMoney(Number(wallet.current_balance || 0))}</p>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {wallet.wallet_type} · Last update {new Date(wallet.updated_at).toLocaleString("en-AU")}
                  </p>
                </div>
              );
            })}
            {wallets.length === 0 && (
              <p className="text-sm text-zinc-500">{pending ? "Loading wallets..." : "No wallets found for this organization."}</p>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">Discrepancy Queue</p>
          <div className="space-y-2">
            {discrepancies.map((row) => (
              <div key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-200">{row.participant_wallets?.name || "Wallet"} · {row.discrepancy_phase}</p>
                  <p className="font-mono text-sm text-amber-300">
                    {Number(row.variance_amount) < 0 ? "-" : "+"}${fmtMoney(Math.abs(Number(row.variance_amount || 0)))}
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  {new Date(row.created_at).toLocaleString("en-AU")} · {row.status}
                </p>
              </div>
            ))}
            {discrepancies.length === 0 && (
              <p className="text-sm text-zinc-500">No discrepancies logged.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

