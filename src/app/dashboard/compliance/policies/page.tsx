"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  listPolicyComplianceMatrixAction,
  sendPolicyRemindersAction,
} from "@/app/actions/governance-policies";

function statusFor(workerId: string, policyId: string, rows: any[]) {
  const row = rows.find((r) => r.user_id === workerId && r.policy_id === policyId);
  return row?.status || "pending";
}

export default function CompliancePoliciesPage() {
  const { orgId } = useOrg();
  const [pending, startTransition] = useTransition();
  const [matrix, setMatrix] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    if (!orgId) return;
    const data = await listPolicyComplianceMatrixAction(orgId);
    setMatrix(data);
  }

  useEffect(() => {
    startTransition(async () => { await load(); });
  }, [orgId]);

  const percent = useMemo(() => Number(matrix?.compliance_percent || 0), [matrix]);

  return (
    <main className="min-h-screen bg-[#050505] p-6 text-zinc-100">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Obsidian Governance</p>
          <h1 className="text-lg">Policy Compliance Matrix</h1>
          <p className="text-xs text-zinc-500">
            Compliance % = Signed / Required = {matrix?.total_signed || 0} / {matrix?.total_required || 0}
          </p>
          <p className={`font-mono text-3xl ${percent >= 95 ? "text-emerald-300" : percent >= 70 ? "text-amber-300" : "text-rose-300"}`}>
            {percent.toFixed(2)}%
          </p>
        </div>

        <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-950">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border border-zinc-800 bg-zinc-950 px-3 py-2 text-left">Worker</th>
                {(matrix?.policies || []).map((p: any) => (
                  <th key={p.id} className="min-w-40 border border-zinc-800 px-2 py-2 text-left">
                    <p className="truncate">{p.title}</p>
                    <button
                      className="mt-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px]"
                      onClick={() => startTransition(async () => {
                        try {
                          await sendPolicyRemindersAction({ organization_id: orgId!, policy_id: p.id });
                          setMsg(`Reminders sent for ${p.title}`);
                        } catch (e) {
                          setMsg((e as Error).message);
                        }
                      })}
                    >
                      Send reminders
                    </button>
                    <a
                      href={`/api/compliance/policies/dossier?organization_id=${orgId}&policy_id=${p.id}`}
                      target="_blank"
                      className="ml-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px]"
                      rel="noreferrer"
                    >
                      Dossier PDF
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(matrix?.workers || []).map((w: any) => (
                <tr key={w.user_id}>
                  <td className="sticky left-0 z-10 border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <p>{w.profiles?.full_name || w.profiles?.email || w.user_id}</p>
                    <p className="font-mono text-[10px] text-zinc-500">{w.role}</p>
                  </td>
                  {(matrix?.policies || []).map((p: any) => {
                    const status = statusFor(w.user_id, p.id, matrix?.acknowledgements || []);
                    const cls = status === "signed"
                      ? "bg-emerald-500/30 border-emerald-400"
                      : status === "expired"
                        ? "bg-rose-500/30 border-rose-400"
                        : "bg-amber-500/30 border-amber-400";
                    return (
                      <td key={`${w.user_id}-${p.id}`} className={`border px-2 py-2 text-center ${cls}`}>
                        {status}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {msg && <p className="text-xs text-zinc-400">{msg}</p>}
      </div>
    </main>
  );
}

