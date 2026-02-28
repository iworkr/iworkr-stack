"use client";

import { FadeIn } from "@/components/ui/fade-in";

const logos = [
  { name: "FlowTech", accent: "#3B82F6" },
  { name: "Summit", accent: "#10B981" },
  { name: "Apex", accent: "#F59E0B" },
  { name: "ClearWater", accent: "#06B6D4" },
  { name: "GridLine", accent: "#8B5CF6" },
  { name: "TrueLevel", accent: "#EF4444" },
  { name: "PipeWorks", accent: "#EC4899" },
  { name: "VoltEdge", accent: "#14B8A6" },
];

function LogoMark({ name, accent }: { name: string; accent: string }) {
  return (
    <div className="flex items-center gap-2.5 opacity-40 transition-opacity duration-300 hover:opacity-100">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill={accent} fillOpacity="0.15" />
        <text
          x="12"
          y="16"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={accent}
        >
          {name.charAt(0)}
        </text>
      </svg>
      <span className="whitespace-nowrap text-sm font-medium tracking-tight text-[var(--text-muted)]">
        {name}
      </span>
    </div>
  );
}

export function SocialProof() {
  return (
    <section className="relative overflow-hidden border-y border-[var(--card-border)] py-12">
      <FadeIn>
        <p className="mb-8 text-center text-xs tracking-widest text-[var(--text-dim)] uppercase">
          Trusted by 2,000+ service businesses
        </p>
      </FadeIn>

      <div className="relative">
        {/* Gradient edges */}
        <div
          className="pointer-events-none absolute top-0 left-0 z-10 h-full w-24"
          style={{ background: `linear-gradient(to right, var(--section-fade), transparent)` }}
        />
        <div
          className="pointer-events-none absolute top-0 right-0 z-10 h-full w-24"
          style={{ background: `linear-gradient(to left, var(--section-fade), transparent)` }}
        />

        <div className="animate-marquee flex items-center gap-12">
          {[...logos, ...logos].map((logo, i) => (
            <LogoMark
              key={`${logo.name}-${i}`}
              name={logo.name}
              accent={logo.accent}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
