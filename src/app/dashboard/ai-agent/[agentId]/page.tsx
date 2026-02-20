"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Bot } from "lucide-react";
import Link from "next/link";

const KNOWN_AGENTS = ["phone", "ads", "social", "reputation", "dispatch"] as const;

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;

  useEffect(() => {
    if (agentId === "phone") {
      router.replace("/dashboard/ai-agent/phone");
      return;
    }
  }, [agentId, router]);

  if (agentId === "phone") {
    return null;
  }

  const isKnown = KNOWN_AGENTS.includes(agentId as any);

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      <div className="sticky top-0 z-10 border-b border-white/5 bg-[#050505]/95 backdrop-blur-xl">
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
            Configuration for this agent is coming soon. Only the AI Phone Receptionist is configurable today.
          </p>
          <Link href="/dashboard/ai-agent" className="mt-6 rounded-xl border border-white/10 px-4 py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">
            Back to AI Workforce
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
