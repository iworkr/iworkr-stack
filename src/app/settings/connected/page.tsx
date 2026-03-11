"use client";

import { useAuthStore } from "@/lib/auth-store";
import { Shimmer } from "@/components/ui/shimmer";

export default function ConnectedAccountsPage() {
  const { profile } = useAuthStore();
  const userEmail = profile?.email || "";

  const accounts = [
    { provider: "Google", email: userEmail, connected: !!userEmail },
    { provider: "Apple", email: "", connected: false },
    { provider: "GitHub", email: "", connected: false },
  ];

  return (
    <>
      {/* ─── Page intro — premium control-center header ─── */}
      <div className="mb-10">
        <span className="font-mono text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
          Connected Accounts
        </span>
        <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          Connected accounts
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Link third-party sign-in providers to your iWorkr account.
        </p>
      </div>

      <div className="space-y-3">
        {accounts.map((acc) => (
          <div key={acc.provider} className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-zinc-200">{acc.provider}</div>
              {acc.connected && (
                <div className="text-[11px] text-zinc-600">
                  {acc.email || <Shimmer className="h-2 w-32" />}
                </div>
              )}
            </div>
            <button className={`rounded-md border px-3 py-1 text-[12px] ${
              acc.connected ? "border-[rgba(255,255,255,0.08)] text-zinc-500 hover:text-red-400" : "border-[rgba(255,255,255,0.12)] text-zinc-300 hover:bg-[rgba(255,255,255,0.04)]"
            }`}>
              {acc.connected ? "Disconnect" : "Connect"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
