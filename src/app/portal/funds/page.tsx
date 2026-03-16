import { getPortalFunds } from "@/app/actions/portal-family";
import { FamilyPortalShell } from "@/components/portal/family-portal-shell";

function fmtMoney(n: number) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PortalFundsPage({
  searchParams,
}: {
  searchParams: Promise<{ participant?: string }>;
}) {
  const params = await searchParams;
  const data = await getPortalFunds(params.participant);

  if ("error" in data) {
    return (
      <main className="min-h-screen bg-[#050505] px-6 py-12 text-zinc-200">
        <h1 className="text-2xl font-semibold">Family Portal Funds</h1>
        <p className="mt-4 text-zinc-400">{data.error}</p>
      </main>
    );
  }

  const wallets = (data.wallets || []) as any[];
  const ledger = (data.ledger || []) as any[];
  const walletMap = new Map<string, any>(wallets.map((w: any) => [w.id as string, w]));

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-50">
      <FamilyPortalShell
        participants={data.linked_participants}
        activeParticipantId={data.active_participant_id}
      />
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-5 md:grid-cols-12">
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 md:col-span-12">
          <p className="text-xs uppercase tracking-wider text-emerald-300">Live Wallet Balances</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {wallets.map((wallet: any) => (
              <div key={wallet.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-sm text-zinc-200">{wallet.name}</p>
                <p className="mt-1 font-mono text-xl text-emerald-300">${fmtMoney(Number(wallet.current_balance || 0))}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {wallet.wallet_type === "debit_card" && wallet.card_last_four
                    ? `Card ending ${wallet.card_last_four}`
                    : "Cash wallet"}
                </p>
              </div>
            ))}
            {wallets.length === 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
                No active wallets are provisioned for this participant.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:col-span-12">
          <p className="text-xs uppercase tracking-wider text-zinc-400">Funds Ledger</p>
          <div className="mt-3 space-y-2">
            {ledger.map((row: any) => {
              const wallet = walletMap.get(row.wallet_id);
              return (
                <details key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-200">
                          {wallet?.name || "Wallet"} · {String(row.entry_type).replace("_", " ")}
                        </p>
                        <p className="text-xs text-zinc-500">{fmtDateTime(row.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-sm ${Number(row.amount) < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                          {Number(row.amount) < 0 ? "-" : "+"}${fmtMoney(Math.abs(Number(row.amount || 0)))}
                        </p>
                        <p className="font-mono text-xs text-zinc-400">Bal ${fmtMoney(Number(row.running_balance || 0))}</p>
                      </div>
                    </div>
                  </summary>
                  <div className="mt-3 border-t border-zinc-800 pt-3">
                    <p className="text-sm text-zinc-300">{row.description || "No description provided."}</p>
                    {row.category && <p className="mt-1 text-xs text-zinc-500">Category: {row.category}</p>}
                    {row.receipt_image_url && (
                      <a
                        href={row.receipt_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-xs text-blue-400 hover:underline"
                      >
                        View receipt image
                      </a>
                    )}
                  </div>
                </details>
              );
            })}
            {ledger.length === 0 && (
              <p className="text-sm text-zinc-500">No ledger activity yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

