"use client";

import { motion } from "framer-motion";
import {
  Phone,
  Megaphone,
  MessageCircle,
  Star,
  Route,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { useEffect, useState } from "react";
import { getAgentConfig } from "@/app/actions/ai-agent";
import { FeatureGate } from "@/components/app/feature-gate";
import { useIndustryLexicon } from "@/lib/industry-lexicon";

/* ── PRD 60: Agent definitions (The Synthetic Roster) ───── */

const AGENTS = [
  {
    id: "phone",
    name: "AI Phone Receptionist",
    description: "Answers calls 24/7, books jobs, and handles FAQs via Vapi/Twilio.",
    icon: Phone,
    href: "/dashboard/ai-agent/phone",
  },
  {
    id: "ads",
    name: "Meta Ads Optimizer",
    description: "Monitors Facebook/IG ad spend, pauses losing campaigns, and generates A/B ad copy.",
    icon: Megaphone,
    href: "/dashboard/ai-agent/ads",
  },
  {
    id: "social",
    name: "Social Sales Agent",
    description: "Auto-replies to Instagram DMs and Facebook Messenger, qualifying leads into the Triage inbox.",
    icon: MessageCircle,
    href: "/dashboard/ai-agent/social",
  },
  {
    id: "reputation",
    name: "Reputation Manager",
    description: "Monitors Google Reviews, drafts professional replies, and texts clients for reviews 24hrs post-job.",
    icon: Star,
    href: "/dashboard/ai-agent/reputation",
  },
  {
    id: "dispatch",
    name: "Dispatch Copilot",
    description: "Analyzes schedule density and suggests optimal routing and reassignment to reduce windshield time.",
    icon: Route,
    href: "/dashboard/ai-agent/dispatch",
  },
] as const;

/* ── Card with Synapse pulse when active ────────────────── */

function AgentCard({
  agent,
  isActive,
  onActivate,
  index,
  t,
}: {
  agent: (typeof AGENTS)[number];
  isActive: boolean;
  onActivate?: () => void;
  index: number;
  t?: (key: string) => string;
}) {
  const Icon = agent.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative overflow-hidden rounded-[var(--radius-card)] border p-5 transition-all duration-200 ${
        isActive
          ? "border-violet-500/15 bg-violet-500/[0.04] shadow-[0_0_24px_-8px_rgba(139,92,246,0.08)]"
          : "border-[var(--border-base)] bg-white/[0.02] hover:border-violet-500/15 hover:bg-violet-500/[0.02]"
      }`}
      style={{ boxShadow: isActive ? undefined : "var(--shadow-inset-bevel)" }}
    >
      {/* PRD 60: "Synapse" pulse behind icon when active */}
      {isActive && (
        <motion.div
          className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-violet-500/[0.08]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.4, 0.1, 0.4],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      <div className="relative flex flex-col">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] border transition-colors ${
                isActive
                  ? "border-violet-500/20 bg-violet-500/[0.08] text-violet-400"
                  : "border-[var(--border-base)] bg-white/[0.02] text-zinc-500 group-hover:border-violet-500/15 group-hover:text-violet-400/70"
              }`}
            >
              <Icon size={18} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-[13px] font-medium tracking-tight text-zinc-200">
                {t ? t(agent.name) : agent.name}
              </h3>
              {isActive && (
                <span className="relative mt-0.5 flex items-center gap-1">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                  <span className="text-[10px] font-medium text-[var(--brand)]">
                    Active
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {t ? t(agent.description) : agent.description}
        </p>

        <div className="mt-auto flex items-center gap-2">
          {isActive ? (
            <Link
              href={agent.href}
              className="stealth-btn-primary gap-1.5 px-3.5 py-2 text-[11px]"
            >
              Configure
              <ChevronRight size={12} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onActivate}
              className="stealth-btn-ghost gap-1.5 px-3.5 py-2 text-[11px]"
            >
              Activate
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Hub Page ───────────────────────────────────────────── */

export default function AIWorkforceHubPage() {
  const { currentOrg } = useAuthStore();
  const { t } = useIndustryLexicon();
  const [phoneEnabled, setPhoneEnabled] = useState(false);
  const [tasksToday] = useState(142);

  useEffect(() => {
    if (!currentOrg?.id) return;
    getAgentConfig(currentOrg.id).then(({ data }) => {
      if (data?.enabled) setPhoneEnabled(true);
    });
  }, [currentOrg?.id]);

  const activeCount = phoneEnabled ? 1 : 0;
  const maxAgents = 5;

  return (
    <FeatureGate
      requiredTier="business"
      featureTitle={t("AI Workforce Hub")}
      featureDescription={t("Deploy synthetic receptionists and automated dispatchers to scale your operations without scaling payroll.")}
    >
      <div className="relative flex h-full flex-col bg-[var(--background)]">
        {/* Noise texture */}
        <div className="stealth-noise" />

        {/* Atmospheric glow — subtle violet top-center */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
          style={{
            width: 600,
            height: 300,
            background: "radial-gradient(ellipse at center, rgba(139,92,246,0.04) 0%, transparent 70%)",
          }}
        />

        {/* PRD 60: Hub Header — mono overline pattern */}
        <div className="sticky top-0 z-10 border-b border-[var(--border-base)] px-4 pb-4 pt-4 md:px-6 md:pt-5" style={{ background: "var(--header-bg)", backdropFilter: "blur(var(--header-blur))" }}>
          <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            AI Workforce
          </p>
          <h1 className="text-[15px] font-medium tracking-tight text-zinc-200">
            {t("The Synthetic Roster")}
          </h1>
          <p className="mt-0.5 text-[12px] text-zinc-600">
            {t("Deploy synthetic agents to automate your operations.")}
          </p>
          {/* Micro-metric bar */}
          <div className="mt-3 flex items-center gap-4 font-mono text-[11px]">
            <span className="text-zinc-500">
              Active:{" "}
              <span className="font-medium text-zinc-300">{activeCount}/{maxAgents}</span>
            </span>
            <span className="text-zinc-800">·</span>
            <span className="text-zinc-500">
              Tasks Today:{" "}
              <span className="font-medium text-violet-400/80">{tasksToday}</span>
            </span>
          </div>
        </div>

        {/* Agent Grid — PRD 60: responsive, Obsidian cards */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((agent, i) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                index={i}
                t={t}
                isActive={
                  agent.id === "phone" ? phoneEnabled : false
                }
                onActivate={
                  agent.id !== "phone"
                    ? () => {}
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
