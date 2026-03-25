/**
 * @page Compliance Rules Admin
 * @status COMPLETE
 * @description Project Cerberus-Gate: Admin panel for managing compliance gates,
 *   override PIN generation, and audit trail viewing.
 * @lastAudit 2026-03-24
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchComplianceRulesAction,
  createComplianceRuleAction,
  toggleComplianceRuleAction,
  deleteComplianceRuleAction,
  generateOverridePinAction,
  fetchOverridesAction,
  fetchComplianceStatsAction,
  type ComplianceRule,
  type ComplianceOverride,
  type ComplianceStats,
} from "@/app/actions/cerberus-gate";

type Tab = "rules" | "overrides" | "pin";

const RULE_TYPES = [
  { value: "FORM_SUBMISSION", label: "Form Submission" },
  { value: "MEDIA_CAPTURE", label: "Photo/Media Capture" },
  { value: "PROGRESS_NOTE", label: "Progress Note Quality" },
  { value: "EMAR_SIGN_OFF", label: "eMAR Sign-Off" },
  { value: "CLIENT_SIGNATURE", label: "Client Signature" },
  { value: "SWMS_REQUIRED", label: "SWMS Assessment" },
  { value: "SUBTASK_COMPLETION", label: "Subtask Completion" },
];

const TARGET_TYPES = [
  { value: "GLOBAL", label: "All Jobs (Global)" },
  { value: "JOB_LABEL", label: "Job Label" },
  { value: "CLIENT_TAG", label: "Specific Client" },
  { value: "SPECIFIC_JOB", label: "Specific Job" },
  { value: "CARE_PLAN_TYPE", label: "Care Plan Type" },
];

export default function ComplianceRulesPage() {
  const orgId = useAuthStore((s) => s.currentOrg?.id);
  const [tab, setTab] = useState<Tab>("rules");
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [overrides, setOverrides] = useState<ComplianceOverride[]>([]);
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // PIN generation state
  const [pinJobId, setPinJobId] = useState("");
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState<"PRE_START" | "POST_COMPLETION">("PRE_START");
  const [formRuleType, setFormRuleType] = useState("FORM_SUBMISSION");
  const [formTarget, setFormTarget] = useState("GLOBAL");
  const [formTargetLabel, setFormTargetLabel] = useState("");
  const [formIsHardBlock, setFormIsHardBlock] = useState(true);
  const [formConfigStr, setFormConfigStr] = useState("{}");
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [rulesData, overridesData, statsData] = await Promise.all([
      fetchComplianceRulesAction(orgId),
      fetchOverridesAction(orgId),
      fetchComplianceStatsAction(orgId),
    ]);
    setRules(rulesData);
    setOverrides(overridesData);
    setStats(statsData);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateRule = async () => {
    if (!orgId || !formName) return;
    setCreating(true);
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(formConfigStr);
    } catch {
      config = {};
    }

    await createComplianceRuleAction(orgId, {
      name: formName,
      trigger_state: formTrigger,
      rule_type: formRuleType,
      config_jsonb: config,
      target_entity_type: formTarget,
      target_label: formTarget === "JOB_LABEL" ? formTargetLabel : undefined,
      is_hard_block: formIsHardBlock,
    });

    setCreating(false);
    setShowCreate(false);
    setFormName("");
    setFormConfigStr("{}");
    loadData();
  };

  const handleToggle = async (ruleId: string, isActive: boolean) => {
    await toggleComplianceRuleAction(ruleId, !isActive);
    loadData();
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm("Delete this compliance rule?")) return;
    await deleteComplianceRuleAction(ruleId);
    loadData();
  };

  const handleGeneratePin = async () => {
    if (!orgId || !pinJobId) return;
    setPinLoading(true);
    setGeneratedPin(null);
    const result = await generateOverridePinAction(orgId, pinJobId);
    if ("pin" in result) {
      setGeneratedPin(result.pin ?? null);
    }
    setPinLoading(false);
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            Compliance Rules Engine
          </h1>
          <p className="text-xs text-neutral-500">
            Project Cerberus-Gate — Pre-start and post-completion gates
          </p>
        </div>
        {stats && (
          <div className="flex gap-3 text-xs">
            <StatChip label="Rules" value={stats.total_rules} />
            <StatChip label="Hard Blocks" value={stats.hard_blocks} />
            <StatChip label="Overrides (7d)" value={stats.overrides_7d} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-neutral-800 pb-2">
        {(["rules", "overrides", "pin"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === t
                ? "bg-neutral-800 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t === "rules"
              ? "Compliance Rules"
              : t === "overrides"
                ? "Override Audit Log"
                : "Generate Override PIN"}
          </button>
        ))}
      </div>

      {/* Rules Tab */}
      {tab === "rules" && (
        <div>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500"
            >
              {showCreate ? "Cancel" : "+ New Rule"}
            </button>
          </div>

          {showCreate && (
            <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
              <h3 className="mb-4 text-sm font-semibold text-white">
                Create Compliance Rule
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">Rule Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Commercial Gas Safety Protocol"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">Trigger</label>
                  <select
                    value={formTrigger}
                    onChange={(e) =>
                      setFormTrigger(e.target.value as "PRE_START" | "POST_COMPLETION")
                    }
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="PRE_START">Pre-Start</option>
                    <option value="POST_COMPLETION">Post-Completion</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">Rule Type</label>
                  <select
                    value={formRuleType}
                    onChange={(e) => setFormRuleType(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {RULE_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>
                        {rt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">Target</label>
                  <select
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {TARGET_TYPES.map((tt) => (
                      <option key={tt.value} value={tt.value}>
                        {tt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {formTarget === "JOB_LABEL" && (
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">Job Label</label>
                    <input
                      type="text"
                      value={formTargetLabel}
                      onChange={(e) => setFormTargetLabel(e.target.value)}
                      placeholder="e.g., commercial-gas"
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">
                    Config (JSON)
                  </label>
                  <input
                    type="text"
                    value={formConfigStr}
                    onChange={(e) => setFormConfigStr(e.target.value)}
                    placeholder='{"min_photos": 2}'
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-xs text-white placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      checked={formIsHardBlock}
                      onChange={(e) => setFormIsHardBlock(e.target.checked)}
                      className="rounded border-neutral-600 bg-neutral-800 text-emerald-500"
                    />
                    Hard Block (no worker bypass)
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleCreateRule}
                  disabled={creating || !formName}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Rule"}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : rules.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <p className="text-sm text-neutral-500">No compliance rules configured</p>
              <p className="text-xs text-neutral-600">
                Create rules to enforce pre-start and post-completion gates
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onToggle={() => handleToggle(rule.id, rule.is_active)}
                  onDelete={() => handleDelete(rule.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overrides Tab */}
      {tab === "overrides" && (
        <div>
          {overrides.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <p className="text-sm text-neutral-500">No overrides recorded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overrides.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {o.worker_name}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            o.override_type === "HARD_STOP"
                              ? "bg-red-900/50 text-red-400"
                              : "bg-amber-900/50 text-amber-400"
                          }`}
                        >
                          {o.override_type}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {o.rule_name} — {o.job_title}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-600">
                      {new Date(o.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 rounded-lg bg-neutral-800 p-2 text-xs italic text-neutral-400">
                    &ldquo;{o.justification}&rdquo;
                  </p>
                  {o.admin_name && (
                    <p className="mt-1 text-xs text-neutral-600">
                      Authorized by: {o.admin_name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PIN Generation Tab */}
      {tab === "pin" && (
        <div className="mx-auto max-w-md">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">
              Generate Override PIN
            </h3>
            <p className="mb-4 text-xs text-neutral-500">
              Generate a 6-digit PIN for a worker who is stuck on a hard-block
              compliance gate. The PIN expires after 5 minutes.
            </p>
            <label className="mb-1 block text-xs text-neutral-500">Job ID</label>
            <input
              type="text"
              value={pinJobId}
              onChange={(e) => setPinJobId(e.target.value)}
              placeholder="Paste job UUID..."
              className="mb-4 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-xs text-white placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={handleGeneratePin}
              disabled={pinLoading || !pinJobId}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {pinLoading ? "Generating..." : "Generate PIN"}
            </button>

            {generatedPin && (
              <div className="mt-6 rounded-xl border border-emerald-800/50 bg-emerald-900/20 p-6 text-center">
                <p className="mb-2 text-xs text-emerald-400">
                  Read this PIN to the worker:
                </p>
                <p className="font-mono text-4xl font-bold tracking-[0.3em] text-emerald-400">
                  {generatedPin}
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  Expires in 5 minutes
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onDelete,
}: {
  rule: ComplianceRule;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const triggerColor =
    rule.trigger_state === "PRE_START"
      ? "bg-blue-900/50 text-blue-400"
      : "bg-purple-900/50 text-purple-400";

  const ruleTypeLabel =
    RULE_TYPES.find((rt) => rt.value === rule.rule_type)?.label || rule.rule_type;

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        rule.is_active
          ? "border-neutral-800 bg-neutral-900/50"
          : "border-neutral-800/50 bg-neutral-900/20 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{rule.name}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${triggerColor}`}>
              {rule.trigger_state.replace("_", " ")}
            </span>
            {rule.is_hard_block ? (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-900/50 text-red-400">
                HARD BLOCK
              </span>
            ) : (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-900/50 text-amber-400">
                SOFT STOP
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {ruleTypeLabel} — {rule.target_entity_type}
            {rule.target_label ? `: ${rule.target_label}` : ""}
          </p>
          {rule.config_jsonb && Object.keys(rule.config_jsonb).length > 0 && (
            <p className="mt-1 font-mono text-[10px] text-neutral-600">
              {JSON.stringify(rule.config_jsonb)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`rounded-md px-2 py-1 text-xs ${
              rule.is_active
                ? "bg-emerald-900/30 text-emerald-400"
                : "bg-neutral-800 text-neutral-500"
            }`}
          >
            {rule.is_active ? "Active" : "Inactive"}
          </button>
          <button
            onClick={onDelete}
            className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-900/30"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-neutral-700 px-2.5 py-0.5 font-mono text-neutral-400">
      {value} <span className="text-neutral-600">{label}</span>
    </span>
  );
}
