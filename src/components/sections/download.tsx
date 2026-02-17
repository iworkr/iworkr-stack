"use client";

import { motion } from "framer-motion";
import { Monitor, Apple, Smartphone } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/fade-in";
import { Section, SectionHeader } from "@/components/ui/section";

const platforms = [
  {
    id: "macos",
    name: "macOS",
    icon: Apple,
    subtitle: "Apple Silicon & Intel",
    badge: "Recommended",
    size: "68 MB",
    gradient: "from-zinc-400 to-zinc-600",
    hoverBorder: "hover:border-zinc-400/30",
    hoverBg: "hover:bg-zinc-400/5",
  },
  {
    id: "windows",
    name: "Windows",
    icon: Monitor,
    subtitle: "Windows 10+",
    badge: null,
    size: "74 MB",
    gradient: "from-[#00E676] to-[#00C853]",
    hoverBorder: "hover:border-[rgba(0,230,118,0.3)]",
    hoverBg: "hover:bg-[rgba(0,230,118,0.05)]",
  },
  {
    id: "ios",
    name: "iOS",
    icon: Smartphone,
    subtitle: "iPhone & iPad",
    badge: "Field App",
    size: "42 MB",
    gradient: "from-zinc-400 to-zinc-600",
    hoverBorder: "hover:border-zinc-400/30",
    hoverBg: "hover:bg-zinc-400/5",
  },
  {
    id: "android",
    name: "Android",
    icon: Smartphone,
    subtitle: "Phone & Tablet",
    badge: "Field App",
    size: "38 MB",
    gradient: "from-emerald-400 to-emerald-600",
    hoverBorder: "hover:border-emerald-400/30",
    hoverBg: "hover:bg-emerald-400/5",
  },
];

export function DownloadSection() {
  return (
    <Section id="download" className="relative overflow-hidden">
      {/* Dot grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <FadeIn>
        <SectionHeader
          label="Download"
          title="Available everywhere you work."
          description="Desktop app for the office. Mobile app for the field. Real-time sync across all devices."
          className="mx-auto text-center"
        />
      </FadeIn>

      <StaggerContainer
        className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2"
        staggerDelay={0.08}
      >
        {platforms.map((platform) => {
          const Icon = platform.icon;
          return (
            <StaggerItem key={platform.id}>
              <motion.a
                href="/auth"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className={`group relative flex flex-col overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-6 transition-all duration-300 ${platform.hoverBorder} ${platform.hoverBg}`}
              >
                {/* Top glow */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="mb-4 flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${platform.gradient} shadow-lg`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  {platform.badge && (
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[9px] font-medium text-zinc-400">
                      {platform.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-medium text-zinc-100">
                  {platform.name}
                </h3>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {platform.subtitle}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] pt-4">
                  <span className="text-[11px] text-zinc-600">
                    {platform.size}
                  </span>
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 transition-colors group-hover:text-zinc-200">
                    Download
                    <motion.span
                      className="inline-block"
                      initial={{ y: 0 }}
                      whileHover={{ y: 2 }}
                    >
                      ↓
                    </motion.span>
                  </span>
                </div>
              </motion.a>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </Section>
  );
}
