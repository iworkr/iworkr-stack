"use client";

import { useEffect, useState, useTransition } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { getSilQuoteVarianceAction, listSilQuotesAction } from "@/app/actions/sil-quoting";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

export default function SilQuotingVariancePage() {
  const { orgId } = useOrg();
  const [pending, startTransition] = useTransition();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [quoteId, setQuoteId] = useState("");
  const [variance, setVariance] = useState<any>(null);

  useEffect(() => {
    if (!orgId) return;
    startTransition(async () => {
      const q = await listSilQuotesAction(orgId);
      setQuotes(q || []);
      if ((q || []).length > 0) setQuoteId(q[0].id);
    });
  }, [orgId]);

  useEffect(() => {
    if (!orgId || !quoteId) return;
    startTransition(async () => {
      const data = await getSilQuoteVarianceAction({ organization_id: orgId, quote_id: quoteId });
      setVariance(data);
    });
  }, [orgId, quoteId]);

  return (
    <main className="min-h-screen bg-[#050505] p-6 text-zinc-100">
      <div className="mx-auto max-w-4xl rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <h1 className="mb-2 text-lg">SIL Quote Variance Dashboard</h1>
        <p className="mb-4 text-xs text-zinc-500">Quoted vs Actual delivery across last 30 days.</p>

        <select
          className="mb-4 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm"
          value={quoteId}
          onChange={(e) => setQuoteId(e.target.value)}
        >
          {quotes.map((q) => (
            <option key={q.id} value={q.id}>{q.name}</option>
          ))}
        </select>

        {variance && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500">Quoted (30d projection)</p>
              <p className="font-mono text-lg">${Number(variance.quoted_30d_projection || 0).toFixed(2)}</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500">Actual (30d)</p>
              <p className="font-mono text-lg">${Number(variance.actual_30d || 0).toFixed(2)}</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500">Variance</p>
              <p className={`font-mono text-lg ${variance.variance_percent >= 0 ? "text-amber-300" : "text-emerald-300"}`}>
                {Number(variance.variance_percent || 0).toFixed(2)}%
              </p>
            </div>
          </div>
        )}

        {variance?.anomaly === "over_servicing" && (
          <div className="mt-4 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Over-servicing alert: actual delivery exceeds quote assumptions.
            <TrendingUp className="ml-2 inline h-4 w-4" />
          </div>
        )}
        {variance?.anomaly === "under_servicing" && (
          <div className="mt-4 rounded border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-200">
            Under-servicing trend: actual delivery below quote assumptions.
            <TrendingDown className="ml-2 inline h-4 w-4" />
          </div>
        )}
        {!pending && !variance && (
          <p className="text-sm text-zinc-500">Choose a quote to view variance telemetry.</p>
        )}
      </div>
    </main>
  );
}

