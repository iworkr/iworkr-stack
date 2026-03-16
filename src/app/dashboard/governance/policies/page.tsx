"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  createPolicyAction,
  listPoliciesAction,
  publishPolicyVersionAction,
} from "@/app/actions/governance-policies";

export default function GovernancePoliciesPage() {
  const { orgId } = useOrg();
  const [pending, startTransition] = useTransition();
  const [policies, setPolicies] = useState<any[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [message, setMessage] = useState("");

  const [createForm, setCreateForm] = useState({
    title: "",
    category: "whs",
    enforcement_level: 2,
    grace_period_days: 7,
    target_audience_rules: "{\"audience\":\"all\"}",
  });
  const [publishForm, setPublishForm] = useState({
    version_number: "1.0",
    rich_text_content: "",
    document_url: "",
    quiz_payload: '[{"question":"Who must follow this policy?","options":["All staff","No one"],"correct_answer":"All staff"}]',
  });

  async function load() {
    if (!orgId) return;
    const data = await listPoliciesAction(orgId);
    setPolicies(data || []);
    if (!selectedPolicyId && (data || []).length > 0) setSelectedPolicyId(data[0].id);
  }

  useEffect(() => {
    startTransition(async () => {
      await load();
    });
  }, [orgId]);

  const selected = useMemo(
    () => policies.find((p) => p.id === selectedPolicyId) || null,
    [policies, selectedPolicyId],
  );

  return (
    <main className="min-h-screen bg-[#050505] p-6 text-zinc-100">
      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-4">
        <section className="col-span-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Project Solon</p>
          <h1 className="mb-4 text-lg">Policy Governance Hub</h1>

          <div className="space-y-2 rounded border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-400">Create Policy</p>
            <input className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" placeholder="Policy title" value={createForm.title} onChange={(e) => setCreateForm((s) => ({ ...s, title: e.target.value }))} />
            <select className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" value={createForm.category} onChange={(e) => setCreateForm((s) => ({ ...s, category: e.target.value }))}>
              {["whs", "clinical", "hr", "general", "emergency"].map((cat) => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
            </select>
            <select className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" value={createForm.enforcement_level} onChange={(e) => setCreateForm((s) => ({ ...s, enforcement_level: Number(e.target.value) }))}>
              <option value={1}>Level 1 - Information</option>
              <option value={2}>Level 2 - Signature Required</option>
              <option value={3}>Level 3 - Clock-In Blocker</option>
            </select>
            <input className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" type="number" value={createForm.grace_period_days} onChange={(e) => setCreateForm((s) => ({ ...s, grace_period_days: Number(e.target.value) }))} />
            <textarea className="h-16 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-[11px]" value={createForm.target_audience_rules} onChange={(e) => setCreateForm((s) => ({ ...s, target_audience_rules: e.target.value }))} />
            <button
              className="w-full rounded bg-emerald-600 px-2 py-1.5 text-xs"
              disabled={!orgId || pending}
              onClick={() => startTransition(async () => {
                try {
                  await createPolicyAction({
                    organization_id: orgId!,
                    title: createForm.title,
                    category: createForm.category as any,
                    enforcement_level: createForm.enforcement_level,
                    grace_period_days: createForm.grace_period_days,
                    target_audience_rules: JSON.parse(createForm.target_audience_rules || "{}"),
                  });
                  setMessage("Policy created.");
                  await load();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              })}
            >
              + New Policy
            </button>
          </div>

          <div className="mt-4 space-y-1">
            {(policies || []).map((policy) => (
              <button key={policy.id} onClick={() => setSelectedPolicyId(policy.id)} className={`w-full rounded border px-2 py-1.5 text-left text-xs ${selectedPolicyId === policy.id ? "border-cyan-400 bg-cyan-500/10" : "border-zinc-800 bg-zinc-900"}`}>
                <p>{policy.title}</p>
                <p className="font-mono text-[10px] text-zinc-500">v{policy.version} • L{policy.enforcement_level}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="col-span-8 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="mb-1 text-sm">{selected?.title || "Select policy"}</h2>
          <p className="mb-4 text-xs text-zinc-500">Version control, targeted distribution, and mandatory re-signing on updates.</p>

          <div className="space-y-2 rounded border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-400">Publish New Version</p>
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" placeholder="Version (e.g. 2.0)" value={publishForm.version_number} onChange={(e) => setPublishForm((s) => ({ ...s, version_number: e.target.value }))} />
              <input className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" placeholder="PDF URL (optional)" value={publishForm.document_url} onChange={(e) => setPublishForm((s) => ({ ...s, document_url: e.target.value }))} />
            </div>
            <textarea className="h-32 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs" placeholder="Rich text content" value={publishForm.rich_text_content} onChange={(e) => setPublishForm((s) => ({ ...s, rich_text_content: e.target.value }))} />
            <textarea className="h-20 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-[11px]" placeholder='Quiz JSON [{"question":"...","options":["a","b"],"correct_answer":"a"}]' value={publishForm.quiz_payload} onChange={(e) => setPublishForm((s) => ({ ...s, quiz_payload: e.target.value }))} />
            <button
              className="rounded bg-blue-600 px-3 py-1.5 text-xs"
              disabled={!selectedPolicyId || pending}
              onClick={() => startTransition(async () => {
                try {
                  await publishPolicyVersionAction({
                    policy_id: selectedPolicyId,
                    version_number: publishForm.version_number,
                    document_url: publishForm.document_url || undefined,
                    rich_text_content: publishForm.rich_text_content || undefined,
                    quiz_payload: publishForm.quiz_payload ? JSON.parse(publishForm.quiz_payload) : [],
                  });
                  setMessage("Version published and distributed.");
                  await load();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              })}
            >
              Publish + Distribute
            </button>
          </div>

          <p className="mt-3 text-xs text-zinc-400">{message}</p>
        </section>
      </div>
    </main>
  );
}

