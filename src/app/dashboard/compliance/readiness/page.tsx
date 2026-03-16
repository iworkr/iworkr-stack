"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Shield, Zap } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { getComplianceReadinessAction, triggerCredentialRemediationAction } from "@/app/actions/care";

type ReadinessState = {
  compliance_score: number;
  gaps: {
    staffing: number;
    documentation: number;
    clinical: number;
    evv_rate: number;
  };
  computed_at: string;
};

const emptyState: ReadinessState = {
  compliance_score: 0,
  gaps: { staffing: 0, documentation: 0, clinical: 0, evv_rate: 0 },
  computed_at: new Date().toISOString(),
};

export default function ComplianceReadinessPage() {
  const { orgId } = useOrg();
  const [data, setData] = useState<ReadinessState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [fixing, startFixing] = useTransition();
  const [notice, setNotice] = useState<string>("");

  useEffect(() => {
    if (!orgId) return;
    getComplianceReadinessAction(orgId)
      .then((res) => setData(res as ReadinessState))
      .finally(() => setLoading(false));
  }, [orgId]);

  const scoreColor = useMemo(() => {
    if (data.compliance_score >= 90) return "text-emerald-400";
    if (data.compliance_score >= 75) return "text-amber-400";
    return "text-rose-400";
  }, [data.compliance_score]);

  return (
    <div className="relative p-6 lg:p-8">
      <div className="stealth-noise" />
      <div className="mb-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          PROJECT IRONCLAD
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Compliance Readiness
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Continuous compliance telemetry against staffing, documentation, clinical and EVV standards.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <section className="r-card col-span-12 border border-[var(--border-base)] bg-[var(--surface-1)] p-6 lg:col-span-4">
          <div className="mb-4 flex items-center gap-2">
            <Shield size={14} className="text-[var(--brand)]" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Ironclad Score
            </span>
          </div>
          {loading ? (
            <div className="h-12 w-28 rounded skeleton-shimmer" />
          ) : (
            <>
              <div className={`font-mono text-5xl font-semibold tracking-tighter ${scoreColor}`}>
                {data.compliance_score}%
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Updated {new Date(data.computed_at).toLocaleString("en-AU")}
              </p>
            </>
          )}
        </section>

        <section className="r-card col-span-12 border border-[var(--border-base)] bg-[var(--surface-1)] p-6 lg:col-span-8">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Gap Analysis Matrix
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <GapCard
              label="Staffing Gaps"
              value={`${data.gaps.staffing}`}
              detail="Upcoming shifts with missing or expired NDIS worker screening."
            />
            <GapCard
              label="Documentation Gaps"
              value={`${data.gaps.documentation}`}
              detail="Active participants with expired service agreements."
            />
            <GapCard
              label="Clinical Gaps"
              value={`${data.gaps.clinical}`}
              detail="Incidents this month lacking linked quality action."
            />
            <GapCard
              label="EVV Gap Rate"
              value={`${data.gaps.evv_rate}%`}
              detail="Recent shift notes with missing or invalid clock-out location."
            />
          </div>
        </section>

        <section className="r-card col-span-12 border border-[var(--border-base)] bg-[var(--surface-1)] p-6">
          <div className="mb-3 flex items-center gap-2">
            <Zap size={14} className="text-[var(--brand)]" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Automated Remediation
            </span>
          </div>
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            Trigger immediate push notifications to non-compliant workers for credential remediation.
          </p>
          <button
            className="stealth-btn-brand"
            disabled={!orgId || fixing}
            onClick={() =>
              startFixing(async () => {
                if (!orgId) return;
                const result = await triggerCredentialRemediationAction(orgId);
                setNotice(`${result.notified} worker(s) notified`);
              })
            }
          >
            {fixing ? "Dispatching..." : "Fix Now"}
          </button>
          {notice ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
              <CheckCircle2 size={12} />
              {notice}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function GapCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-base)] bg-white/[0.02] p-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}
