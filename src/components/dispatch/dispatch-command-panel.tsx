"use client";

import { motion } from "framer-motion";
import { Radio, MapPin, Route, Footprints } from "lucide-react";

interface DispatchCommandPanelProps {
  showFleet: boolean;
  showUnassignedJobs: boolean;
  showActiveRoutes: boolean;
  showFootprints: boolean;
  onToggleFleet: () => void;
  onToggleUnassignedJobs: () => void;
  onToggleActiveRoutes: () => void;
  onToggleFootprints: () => void;
}

/** PRD: Glassmorphic panel, stealth toggles. */
export function DispatchCommandPanel({
  showFleet,
  showUnassignedJobs,
  showActiveRoutes,
  showFootprints,
  onToggleFleet,
  onToggleUnassignedJobs,
  onToggleActiveRoutes,
  onToggleFootprints,
}: DispatchCommandPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute left-4 top-4 z-10 w-52 rounded-xl border border-white/5 bg-zinc-950/80 p-3 shadow-xl backdrop-blur-md"
    >
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Layers
      </div>
      <div className="space-y-1.5">
        <StealthToggle
          label="Show Fleet"
          icon={<Radio size={12} className="text-zinc-500" />}
          on={showFleet}
          onToggle={onToggleFleet}
        />
        <StealthToggle
          label="Show Unassigned Jobs"
          icon={<MapPin size={12} className="text-zinc-500" />}
          on={showUnassignedJobs}
          onToggle={onToggleUnassignedJobs}
        />
        <StealthToggle
          label="Show Active Routes"
          icon={<Route size={12} className="text-zinc-500" />}
          on={showActiveRoutes}
          onToggle={onToggleActiveRoutes}
        />
        <StealthToggle
          label="Show Footprints"
          icon={<Footprints size={12} className="text-zinc-500" />}
          on={showFootprints}
          onToggle={onToggleFootprints}
        />
      </div>
    </motion.div>
  );
}

function StealthToggle({
  label,
  icon,
  on,
  onToggle,
}: {
  label: string;
  icon: React.ReactNode;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-white/5"
    >
      <span className="shrink-0">{icon}</span>
      <span className={on ? "text-zinc-200" : "text-zinc-500"}>{label}</span>
      <span className="ml-auto">
        <span
          className={`block h-5 w-9 rounded-full border transition-colors ${
            on
              ? "border-emerald-500/50 bg-emerald-500/20"
              : "border-white/10 bg-white/5"
          }`}
        >
          <span
            className={`mt-0.5 block h-4 w-4 rounded-full bg-white/90 transition-transform ${
              on ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
      </span>
    </button>
  );
}
