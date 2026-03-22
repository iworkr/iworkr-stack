/**
 * @page /dashboard/care/participants/[id]/finance
 * @status COMPLETE
 * @description Participant finance — wallet balances, ledger entries, and transaction creation
 * @dataSource server-action: wallets actions (createParticipantWallet, listWalletLedgerEntries)
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { ArrowLeftRight, Plus, ShieldAlert, Wallet } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  createParticipantWalletAction,
  listParticipantWalletsAction,
  listWalletLedgerEntriesAction,
} from "@/app/actions/wallets";

type WalletRow = {
  id: string;
  name: string;
  wallet_type: "cash" | "debit_card";
  card_last_four: string | null;
  current_balance: number;
  requires_financial_delegation: boolean;
};

type LedgerRow = {
  id: string;
  entry_type: string;
  amount: number;
  running_balance: number;
  category: string | null;
  description: string | null;
  receipt_image_url: string | null;
  created_at: string;
};

function fmtMoney(n: number) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ParticipantFinancePage() {
  const params = useParams<{ id: string }>();
  const participantId = params.id;
  const { orgId } = useOrg();
  const [pending, startTransition] = useTransition();

  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [error, setError] = useState<string>("");

  const [name, setName] = useState("Main Cash Tin");
  const [walletType, setWalletType] = useState<"cash" | "debit_card">("cash");
  const [cardLastFour, setCardLastFour] = useState("");
  const [initialBalance, setInitialBalance] = useState("0.00");
  const [delegated, setDelegated] = useState(false);

  async function loadWallets() {
    if (!orgId || !participantId) return;
    const rows = (await listParticipantWalletsAction({
      organization_id: orgId,
      participant_id: participantId,
    })) as WalletRow[];
    setWallets(rows);
    if (!selectedWalletId && rows[0]?.id) setSelectedWalletId(rows[0].id);
  }

  async function loadLedger(walletId: string) {
    if (!walletId) return;
    const rows = (await listWalletLedgerEntriesAction(walletId)) as LedgerRow[];
    setLedger(rows);
  }

  useEffect(() => {
    startTransition(() => {
      loadWallets().catch((e) => setError((e as Error).message));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, participantId]);

  useEffect(() => {
    if (!selectedWalletId) return;
    startTransition(() => {
      loadLedger(selectedWalletId).catch((e) => setError((e as Error).message));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWalletId]);

  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === selectedWalletId) || null,
    [wallets, selectedWalletId],
  );

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-6 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-400" />
          <h1 className="text-lg font-semibold">Participant Assets</h1>
          <span className="rounded-md border border-zinc-700 px-2 py-0.5 font-mono text-xs text-zinc-400">
            Fort Knox
          </span>
        </div>

        {error && <p className="mb-3 text-sm text-rose-300">{error}</p>}

        <div className="grid gap-4 md:grid-cols-12">
          <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:col-span-4">
            <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">Initialize Wallet</p>
            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                placeholder="Wallet name"
              />
              <select
                value={walletType}
                onChange={(e) => setWalletType(e.target.value as "cash" | "debit_card")}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="cash">Cash Tin / Physical Wallet</option>
                <option value="debit_card">Debit / Prepaid Card</option>
              </select>
              {walletType === "debit_card" && (
                <input
                  value={cardLastFour}
                  onChange={(e) => setCardLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  placeholder="Card last 4"
                />
              )}
              <input
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
                placeholder="Opening amount"
              />
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={delegated} onChange={(e) => setDelegated(e.target.checked)} />
                Requires financial delegation
              </label>
              <button
                disabled={!orgId || pending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await createParticipantWalletAction({
                        organization_id: orgId!,
                        participant_id: participantId,
                        name,
                        wallet_type: walletType,
                        card_last_four: walletType === "debit_card" ? cardLastFour : null,
                        requires_financial_delegation: delegated,
                        initial_balance: Number(initialBalance || "0"),
                      });
                      await loadWallets();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  })
                }
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Initialize Wallet
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:col-span-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Provisioned Wallets</p>
              <span className="font-mono text-xs text-zinc-500">{wallets.length} wallet(s)</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => setSelectedWalletId(wallet.id)}
                  className={`rounded-lg border px-3 py-3 text-left ${
                    selectedWalletId === wallet.id
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-zinc-800 bg-zinc-900"
                  }`}
                >
                  <p className="text-sm text-zinc-100">{wallet.name}</p>
                  <p className="mt-1 font-mono text-lg text-emerald-300">${fmtMoney(Number(wallet.current_balance || 0))}</p>
                  <p className="text-xs text-zinc-500">
                    {wallet.wallet_type === "debit_card"
                      ? `Card ending ${wallet.card_last_four || "----"}`
                      : "Cash wallet"}
                  </p>
                  {wallet.requires_financial_delegation && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-300">
                      <ShieldAlert className="h-3 w-3" />
                      Delegated access only
                    </p>
                  )}
                </button>
              ))}
              {wallets.length === 0 && (
                <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-500">
                  No wallets created yet.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-zinc-500">
              Immutable Ledger {selectedWallet ? `· ${selectedWallet.name}` : ""}
            </p>
            <ArrowLeftRight className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="space-y-2">
            {ledger.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-200">{entry.entry_type.replace("_", " ")}</p>
                  <p className={`font-mono text-sm ${Number(entry.amount) < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                    {Number(entry.amount) < 0 ? "-" : "+"}${fmtMoney(Math.abs(Number(entry.amount || 0)))}
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  Running balance ${fmtMoney(Number(entry.running_balance || 0))} · {new Date(entry.created_at).toLocaleString("en-AU")}
                </p>
                {entry.description && <p className="mt-1 text-xs text-zinc-400">{entry.description}</p>}
              </div>
            ))}
            {ledger.length === 0 && (
              <p className="text-sm text-zinc-500">No ledger entries yet for this wallet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

