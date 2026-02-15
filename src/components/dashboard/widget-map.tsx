"use client";

import { motion } from "framer-motion";
import { ArrowRight, MapPin, Radio } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { WidgetShell } from "./widget-shell";

const pins = [
  { id: "1", name: "Mike T.", task: "Boiler Repair", status: "on_job" as const, x: "28%", y: "35%" },
  { id: "2", name: "Sarah C.", task: "Pipe Inspection", status: "on_job" as const, x: "55%", y: "55%" },
  { id: "3", name: "James O.", task: "Emergency Call", status: "en_route" as const, x: "72%", y: "28%" },
  { id: "4", name: "Tom L.", task: "Maintenance", status: "idle" as const, x: "40%", y: "70%" },
];

const statusConfig = {
  on_job: { color: "bg-emerald-500", ring: "ring-emerald-500/30", label: "On Job" },
  en_route: { color: "bg-blue-500", ring: "ring-blue-500/30", label: "En Route" },
  idle: { color: "bg-zinc-500", ring: "ring-zinc-500/30", label: "Idle" },
};

export function WidgetMap() {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const activeCount = pins.filter((p) => p.status !== "idle").length;

  return (
    <WidgetShell
      delay={0.05}
      header={
        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-1.5">
            <Radio size={14} className="text-zinc-400" />
            <span className="text-[13px] font-medium text-zinc-300">Live Dispatch</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {activeCount} Active
          </span>
        </div>
      }
      action={
        <button
          onClick={() => router.push("/dashboard/schedule")}
          className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Open Dispatch
          <ArrowRight size={12} />
        </button>
      }
    >
      <div className="relative h-[260px] overflow-hidden">
        {/* Dark map grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Road-like lines */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]">
          <line x1="20%" y1="0" x2="20%" y2="100%" stroke="white" strokeWidth="2" />
          <line x1="60%" y1="0" x2="60%" y2="100%" stroke="white" strokeWidth="2" />
          <line x1="0" y1="40%" x2="100%" y2="40%" stroke="white" strokeWidth="2" />
          <line x1="0" y1="75%" x2="100%" y2="75%" stroke="white" strokeWidth="1" />
          <path d="M 10% 20% Q 35% 50%, 70% 30%" fill="none" stroke="white" strokeWidth="3" />
          <path d="M 5% 60% Q 45% 40%, 85% 65%" fill="none" stroke="white" strokeWidth="1.5" />
        </svg>

        {/* Radar sweep from HQ */}
        <div className="absolute" style={{ left: "48%", top: "48%", transform: "translate(-50%, -50%)" }}>
          {/* HQ marker */}
          <div className="relative z-10 flex h-4 w-4 items-center justify-center rounded-sm border border-zinc-600 bg-zinc-800">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
          {/* Radar circles */}
          {[80, 140, 200].map((r) => (
            <div
              key={r}
              className="absolute rounded-full border border-zinc-800/60"
              style={{
                width: r * 2,
                height: r * 2,
                left: `calc(50% - ${r}px)`,
                top: `calc(50% - ${r}px)`,
              }}
            />
          ))}
          {/* Radar sweep arm */}
          <motion.div
            className="absolute left-1/2 top-1/2 origin-bottom-left"
            style={{ width: 200, height: 1, marginTop: -0.5 }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            <div
              className="h-full w-full rounded-full"
              style={{
                background: "linear-gradient(90deg, rgba(99,102,241,0.3) 0%, transparent 100%)",
              }}
            />
          </motion.div>
          {/* Sweep cone */}
          <motion.div
            className="absolute left-1/2 top-1/2"
            style={{
              width: 200,
              height: 200,
              marginLeft: -100,
              marginTop: -100,
              background: "conic-gradient(from 0deg, rgba(99,102,241,0.06) 0deg, transparent 40deg)",
              borderRadius: "50%",
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* Technician pins */}
        {pins.map((pin) => {
          const cfg = statusConfig[pin.status];
          return (
            <div
              key={pin.id}
              className="absolute z-20"
              style={{ left: pin.x, top: pin.y }}
              onMouseEnter={() => setHovered(pin.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Pulse ring for active techs */}
              {pin.status !== "idle" && (
                <motion.div
                  animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`absolute inset-0 rounded-full ${cfg.color}`}
                  style={{ width: 12, height: 12, margin: "-2px" }}
                />
              )}

              {/* Dot */}
              <div
                className={`relative h-3 w-3 cursor-pointer rounded-full ${cfg.color} ring-2 ring-black transition-transform hover:scale-150`}
              />

              {/* Tooltip */}
              {hovered === pin.id && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${cfg.color}`} />
                    <span className="text-[11px] font-medium text-zinc-200">{pin.name}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-500">
                    {pin.task} · {cfg.label}
                  </div>
                  <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-zinc-700 bg-zinc-900" />
                </motion.div>
              )}
            </div>
          );
        })}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> On Job
          </span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> En Route
          </span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> Idle
          </span>
        </div>

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0C0C0C] to-transparent" />
      </div>
    </WidgetShell>
  );
}
