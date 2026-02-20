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
}: {
  agent: (typeof AGENTS)[number];
  isActive: boolean;
  onActivate?: () => void;
}) {
  const Icon = agent.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={`group relative overflow-hidden rounded-xl border bg-zinc-900/40 p-5 transition-all duration-200 ${
        isActive
          ? "border-violet-500/20 shadow-lg shadow-violet-500/5"
          : "border-white/5 hover:border-violet-500/30 hover:shadow-xl hover:shadow-black/20"
      }`}
    >
      {/* PRD 60: "Synapse" pulse behind icon when active */}
      {isActive && (
        <motion.div
          className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-violet-500/10"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.4, 0.15, 0.4],
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
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                isActive
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
                  : "border-white/5 bg-white/[0.02] text-zinc-500 group-hover:border-violet-500/20 group-hover:text-violet-400/80"
              }`}
            >
              <Icon size={18} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-white">
                {agent.name}
              </h3>
              {isActive && (
                <span className="relative mt-0.5 flex items-center gap-1">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-medium text-emerald-400">
                    Active
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-zinc-500">
          {agent.description}
        </p>

        <div className="mt-auto flex items-center gap-2">
          {isActive ? (
            <Link
              href={agent.href}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[11px] font-medium text-black transition-colors hover:bg-zinc-200"
            >
              Configure
              <ChevronRight size={12} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onActivate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
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
    <div className="flex h-full flex-col bg-[#050505]">
      {/* PRD 60: Hub Header */}
      <div className="sticky top-0 z-10 border-b border-white/5 bg-[#050505]/95 backdrop-blur-xl">
        <div className="px-6 py-5">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            AI Workforce
          </h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            Deploy synthetic agents to automate your operations.
          </p>
          {/* Micro-metric bar */}
          <div className="mt-4 flex items-center gap-4 font-mono text-[11px]">
            <span className="text-zinc-500">
              Active Agents:{" "}
              <span className="text-zinc-300">{activeCount}/{maxAgents}</span>
            </span>
            <span className="text-zinc-700">•</span>
            <span className="text-zinc-500">
              Tasks Automated Today:{" "}
              <span className="text-violet-400/90">{tasksToday}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Agent Grid — PRD 60: responsive, Obsidian cards */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
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
  );
}
