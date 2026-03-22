/**
 * @component StepSector
 * @status COMPLETE
 * @description Onboarding step for selecting industry type (Trades or Care)
 * @lastAudit 2026-03-22
 */
"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useOnboardingStore, type IndustryType } from "@/lib/onboarding-store";
import {
  Wrench,
  Heart,
} from "lucide-react";

const sectors = [
  {
    id: "trades" as IndustryType,
    label: "Trades & Field Service",
    description: "Plumbing, electrical, HVAC, cleaning, landscaping, and general contracting.",
    icon: Wrench,
    accent: "#10B981",
  },
  {
    id: "care" as IndustryType,
    label: "Care & Support",
    description: "NDIS, aged care, home care, disability support, and allied health services.",
    icon: Heart,
    accent: "#3B82F6",
  },
];

export function StepSector() {
  const { industryType, setIndustryType, advanceStep } = useOnboardingStore();
  const [selected, setSelected] = useState<IndustryType | null>(industryType);

  function handleSelect(sectorId: IndustryType) {
    setSelected(sectorId);
    setIndustryType(sectorId);

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
          What kind of work do you do?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm text-zinc-500"
        >
          This shapes your entire workspace — terminology, compliance, and features.
        </motion.p>
      </div>

      {/* Sector Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {sectors.map((sector, i) => {
          const isSelected = selected === sector.id;
          const isOtherSelected = selected !== null && !isSelected;
          const Icon = sector.icon;

          return (
            <motion.button
              key={sector.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{
                opacity: isOtherSelected ? 0.15 : 1,
                y: 0,
                scale: isSelected ? 1.02 : 1,
              }}
              transition={{
                delay: 0.35 + i * 0.08,
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={
                !selected
                  ? {
                      scale: 1.02,
                      y: -3,
                      borderColor: "rgba(255,255,255,0.2)",
                    }
                  : {}
              }
              whileTap={!selected ? { scale: 0.98 } : {}}
              onClick={() => !selected && handleSelect(sector.id)}
              className={`group relative flex flex-col items-start gap-4 rounded-2xl border px-6 py-8 text-left transition-all duration-200 ${
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
                className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200 ${
                  isSelected
                    ? "bg-black/10"
                    : "bg-[rgba(255,255,255,0.04)]"
                }`}
              >
                <Icon
                  size={24}
                  strokeWidth={1.5}
                  className={`transition-all duration-200 ${
                    isSelected
                      ? "text-black"
                      : "text-zinc-500 group-hover:text-zinc-300"
                  }`}
                />
              </motion.div>

              <div className="space-y-1.5">
                <span
                  className={`text-lg font-medium ${
                    isSelected ? "text-black" : "text-zinc-200"
                  }`}
                >
                  {sector.label}
                </span>
                <p
                  className={`text-sm leading-relaxed ${
                    isSelected ? "text-black/60" : "text-zinc-500"
                  }`}
                >
                  {sector.description}
                </p>
              </div>

              {/* Accent glow on hover */}
              {!selected && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(ellipse at center, ${sector.accent}08, transparent 70%)`,
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
