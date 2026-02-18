"use client";

import { motion } from "framer-motion";
import { BarChart3, Check } from "lucide-react";
import { useMessengerStore, type Message } from "@/lib/stores/messenger-store";

interface PollMessageProps {
  message: Message;
  userId: string;
}

export function PollMessage({ message, userId }: PollMessageProps) {
  const { votePoll } = useMessengerStore();
  const options: string[] = message.metadata?.options || [];
  const votes: Record<string, string[]> = message.metadata?.votes || {};

  const totalVotes = Object.values(votes).reduce(
    (sum, v) => sum + v.length,
    0,
  );
  const userVotedOption = Object.entries(votes).find(([, users]) =>
    users.includes(userId),
  )?.[0];

  return (
    <div className="mt-1.5 max-w-sm rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4 backdrop-blur-sm">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] text-zinc-500">
        <BarChart3 size={12} strokeWidth={1.5} className="text-amber-500/80" />
        <span className="font-semibold tracking-wider uppercase">Poll</span>
      </div>
      <p className="mb-3 text-[13px] font-semibold text-zinc-100">
        {message.content}
      </p>

      <div className="space-y-1.5">
        {options.map((opt, i) => {
          const optKey = String(i);
          const voteCount = (votes[optKey] || []).length;
          const pct = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
          const isSelected = userVotedOption === optKey;

          return (
            <button
              key={i}
              onClick={() => votePoll(message.id, i)}
              className={`relative flex w-full items-center justify-between overflow-hidden rounded-lg border px-3.5 py-2.5 text-[12px] transition-all duration-200 ${
                isSelected
                  ? "border-emerald-500/25 text-zinc-100"
                  : "border-white/[0.04] text-zinc-400 hover:border-white/[0.08] hover:text-zinc-300"
              }`}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={`absolute inset-y-0 left-0 rounded-lg ${
                  isSelected ? "bg-emerald-500/12" : "bg-white/[0.02]"
                }`}
              />
              <span className="relative flex items-center gap-2">
                {isSelected && (
                  <Check size={11} className="text-emerald-500" />
                )}
                <span className="font-medium">{opt}</span>
              </span>
              <span className="relative font-mono text-[11px] text-zinc-600">
                {totalVotes > 0 ? `${Math.round(pct)}%` : ""}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 font-mono text-[10px] text-zinc-700">
        {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
