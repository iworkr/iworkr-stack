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

  const totalVotes = Object.values(votes).reduce((sum, v) => sum + v.length, 0);
  const userVotedOption = Object.entries(votes).find(([, users]) =>
    users.includes(userId)
  )?.[0];

  return (
    <div className="mt-1 max-w-sm rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3">
      <div className="mb-2 flex items-center gap-2 text-[12px] text-zinc-400">
        <BarChart3 size={12} />
        <span className="font-medium">Poll</span>
      </div>
      <p className="mb-3 text-[13px] font-medium text-zinc-200">{message.content}</p>

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
              className={`relative flex w-full items-center justify-between overflow-hidden rounded-md border px-3 py-2 text-[12px] transition-all ${
                isSelected
                  ? "border-[#00E676]/30 text-zinc-200"
                  : "border-[rgba(255,255,255,0.06)] text-zinc-400 hover:border-[rgba(255,255,255,0.15)]"
              }`}
            >
              {/* Progress bar */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`absolute inset-y-0 left-0 ${
                  isSelected ? "bg-[rgba(0,230,118,0.1)]" : "bg-[rgba(255,255,255,0.03)]"
                }`}
              />
              <span className="relative flex items-center gap-1.5">
                {isSelected && <Check size={11} className="text-[#00E676]" />}
                {opt}
              </span>
              <span className="relative text-zinc-600">
                {totalVotes > 0 ? `${Math.round(pct)}%` : ""}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] text-zinc-700">
        {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
