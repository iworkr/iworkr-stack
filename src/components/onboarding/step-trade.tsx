"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useOnboardingStore } from "@/lib/onboarding-store";
import {
  Wrench,
  Zap,
  Fan,
  SprayCan,
  Hammer,
  ClipboardList,
} from "lucide-react";

const trades = [
  { id: "plumbing", label: "Plumbing", icon: Wrench },
  { id: "electrical", label: "Electrical", icon: Zap },
  { id: "hvac", label: "HVAC", icon: Fan },
  { id: "cleaning", label: "Cleaning", icon: SprayCan },
  { id: "carpentry", label: "Carpentry", icon: Hammer },
  { id: "general", label: "General", icon: ClipboardList },
];

export function StepTrade() {
  const { selectedTrade, setTrade, advanceStep } = useOnboardingStore();
  const [selected, setSelected] = useState<string | null>(selectedTrade);

  function handleSelect(tradeId: string) {
    setSelected(tradeId);
    setTrade(tradeId);

    // Pause 400ms for the selection to register, then auto-advance
    setTimeout(() => {
      advanceStep();
    }, 500);
  }

  return (
    <div className="space-y-8">
      {/* Question */}
      <div className="space-y-2">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-2xl font-medium tracking-tight text-zinc-100 md:text-3xl"
        >
          What is your primary trade?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm text-zinc-500"
        >
          This configures your default templates, job types, and terminology.
        </motion.p>
      </div>

      {/* Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {trades.map((trade, i) => {
          const isSelected = selected === trade.id;
          const isOtherSelected = selected !== null && !isSelected;
          const Icon = trade.icon;

          return (
            <motion.button
              key={trade.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{
                opacity: isOtherSelected ? 0.2 : 1,
                y: 0,
                scale: isSelected ? 1.02 : 1,
              }}
              transition={{
                delay: 0.35 + i * 0.06,
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={
                !selected
                  ? {
                      scale: 1.03,
                      y: -2,
                      borderColor: "rgba(255,255,255,0.25)",
                    }
                  : {}
              }
              whileTap={!selected ? { scale: 0.97 } : {}}
              onClick={() => !selected && handleSelect(trade.id)}
              className={`group relative flex flex-col items-center justify-center gap-3 rounded-xl border px-4 py-6 transition-all duration-300 ${
                isSelected
                  ? "border-white bg-white text-black"
                  : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-zinc-400"
              }`}
            >
              <motion.div
                animate={
                  isSelected ? { rotate: [0, -10, 10, -5, 0] } : { rotate: 0 }
                }
                transition={{ duration: 0.4 }}
              >
                <Icon
                  size={24}
                  strokeWidth={1.5}
                  className={`transition-all duration-300 ${
                    isSelected
                      ? "text-black"
                      : "text-zinc-500 group-hover:scale-110 group-hover:text-zinc-300"
                  }`}
                />
              </motion.div>
              <span
                className={`text-sm font-medium ${
                  isSelected ? "text-black" : ""
                }`}
              >
                {trade.label}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
