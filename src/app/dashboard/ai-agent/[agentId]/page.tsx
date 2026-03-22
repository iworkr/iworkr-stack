/**
 * @page /dashboard/ai-agent/[agentId]
 * @status COMPLETE
 * @description Dynamic AI agent config editor — loads/saves per-agent settings via server action
 * @dataSource server-action: getAgentConfig, upsertAgentConfig
 * @lastAudit 2026-03-22
 */
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Bot } from "lucide-react";
import Link from "next/link";
import { useOrg } from "@/lib/hooks/use-org";
import { getAgentConfig, upsertAgentConfig } from "@/app/actions/ai-agent";

const KNOWN_AGENTS = ["phone", "ads", "social", "reputation", "dispatch"] as const;

const AGENT_REDIRECTS: Record<string, string> = {
  phone: "/dashboard/ai-agent/phone",
  ads: "/dashboard/ai-agent/ads",
  social: "/dashboard/ai-agent/social",
  reputation: "/dashboard/ai-agent/reputation",
};

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId } = useOrg();
  const agentId = params.agentId as string;
  const [isPending, startTransition] = useTransition();
  const [fatigueHours, setFatigueHours] = useState("45");
  const [triageWeight, setTriageWeight] = useState("1.2");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    const redirectPath = AGENT_REDIRECTS[agentId];
    if (redirectPath) {
      router.replace(redirectPath);
      return;
    }
  }, [agentId, router]);

  const isKnown = KNOWN_AGENTS.includes(agentId as (typeof KNOWN_AGENTS)[number]);

  useEffect(() => {
    if (agentId !== "dispatch" || !orgId) return;
    startTransition(async () => {
      const { data } = await getAgentConfig(orgId);
      const knowledge = data?.knowledge_base;
      const custom = knowledge?.startsWith("dispatch_custom_settings:")
        ? JSON.parse(knowledge.replace("dispatch_custom_settings:", ""))
        : {};
      if (custom?.sentinel_fatigue_hours != null) {
        setFatigueHours(String(custom.sentinel_fatigue_hours));
      }
      if (custom?.dispatch_triage_weight != null) {
        setTriageWeight(String(custom.dispatch_triage_weight));
      }
    });
  }, [agentId, orgId]);

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      <div className="sticky top-0 z-10 border-b border-white/5 bg-[var(--background)]/95 backdrop-blur-xl">
        <div className="flex items-center gap-4 px-6 py-4">
          <Link href="/dashboard/ai-agent" className="flex items-center gap-1.5 text-[12px] text-zinc-500 transition-colors hover:text-white">
            <ChevronLeft size={14} /> AI Workforce
          </Link>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/5 bg-violet-500/10">
            <Bot size={24} className="text-violet-400" />
          </div>
          <h2 className="text-[16px] font-semibold text-white">
            {isKnown ? `${agentId.replace(/_/g, " ")} agent` : "Agent"}
          </h2>
          <p className="mt-2 max-w-[280px] text-[12px] text-zinc-500">
            {agentId === "dispatch"
              ? "Tune sentinel fatigue thresholds and dispatch triage weighting for your organization."
              : "Configuration for this agent is coming soon. Only the AI Phone Receptionist is configurable today."}
          </p>
          {agentId === "dispatch" ? (
            <div className="mt-5 w-full max-w-sm space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left">
              <label className="block text-[11px] text-zinc-400">
                Fatigue Alert Threshold (hours/week)
                <input
                  value={fatigueHours}
                  onChange={(e) => setFatigueHours(e.target.value)}
                  className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"
                />
              </label>
              <label className="block text-[11px] text-zinc-400">
                Drop & Cover Triage Weight
                <input
                  value={triageWeight}
                  onChange={(e) => setTriageWeight(e.target.value)}
                  className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"
                />
              </label>
              <button
                onClick={() =>
                  startTransition(async () => {
                    if (!orgId) return;
                    await upsertAgentConfig(orgId, {
                      enabled: true,
                      knowledge_base: `dispatch_custom_settings:${JSON.stringify({
                        sentinel_fatigue_hours: Number(fatigueHours || 45),
                        dispatch_triage_weight: Number(triageWeight || 1),
                      })}`,
                    });
                    setSaved("Saved dispatch agent settings.");
                  })
                }
                className="w-full rounded border border-emerald-400/40 bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-200"
              >
                {isPending ? "Saving..." : "Save Settings"}
              </button>
              {saved ? <p className="text-[11px] text-emerald-300">{saved}</p> : null}
            </div>
          ) : null}
          <Link href="/dashboard/ai-agent" className="mt-6 rounded-xl border border-white/10 px-4 py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">
            Back to AI Workforce
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
