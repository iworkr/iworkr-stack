/**
 * @page /dashboard/team/[id]/training
 * @status COMPLETE
 * @description Worker-participant training matrix with fast-track clearance actions
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import {
  fastTrackClearWorkerForParticipantAction,
  getWorkerParticipantTrainingMatrixAction,
} from "@/app/actions/doppelganger";

export default function WorkerTrainingMatrixPage() {
  const { orgId } = useOrg();
  const params = useParams<{ id: string }>();
  const workerId = params?.id;
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!orgId || !workerId) return;
    setLoading(true);
    try {
      const data = await getWorkerParticipantTrainingMatrixAction(workerId, orgId);
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [orgId, workerId]);

  return (
    <div className="p-5">
      <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">Project Doppelganger</p>
      <h1 className="mb-4 text-xl font-semibold text-zinc-100">Participant Familiarity Matrix</h1>

      <div className="overflow-hidden rounded-lg border border-white/[0.08]">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-zinc-400">
            <tr>
              <th className="px-3 py-2">Participant</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.participant_id} className="border-t border-white/[0.06]">
                <td className="px-3 py-2 text-zinc-200">{r.participant_name}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {r.completed}/{r.required} shadow shifts
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      r.is_cleared_for_independent
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {r.is_cleared_for_independent ? "Cleared for Independent" : "Shadowing Required"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {!r.is_cleared_for_independent && (
                    <button
                      className="rounded border border-white/[0.12] px-2 py-1 text-xs text-zinc-200"
                      onClick={async () => {
                        await fastTrackClearWorkerForParticipantAction({
                          organization_id: orgId!,
                          worker_id: workerId!,
                          participant_id: r.participant_id,
                        });
                        await load();
                      }}
                    >
                      Fast-Track Clear
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-3 py-5 text-zinc-500" colSpan={4}>
                  No training matrix rows yet. Attach shadow shifts to start tracking.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
