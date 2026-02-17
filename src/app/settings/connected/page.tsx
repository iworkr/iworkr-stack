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
      <h1 className="mb-8 text-2xl font-medium tracking-tight text-zinc-100">Connected accounts</h1>
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
