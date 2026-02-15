"use client";

import { FadeIn } from "@/components/ui/fade-in";

const logos = [
  { name: "FlowTech Services", width: 120 },
  { name: "Summit Plumbing Co", width: 140 },
  { name: "Apex Electric", width: 110 },
  { name: "ClearWater HVAC", width: 130 },
  { name: "GridLine Contractors", width: 140 },
  { name: "TrueLevel Builds", width: 120 },
  { name: "PipeWorks Pro", width: 115 },
  { name: "VoltEdge Systems", width: 130 },
];

function LogoPlaceholder({ name, width }: { name: string; width: number }) {
  return (
    <div
      className="flex items-center gap-2 opacity-40 transition-opacity duration-300 hover:opacity-100"
      style={{ width }}
    >
      <div className="h-5 w-5 rounded-md border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)]" />
      <span className="whitespace-nowrap text-sm font-medium tracking-tight text-zinc-400">
        {name}
      </span>
    </div>
  );
}

export function SocialProof() {
  return (
    <section className="relative overflow-hidden border-y border-[rgba(255,255,255,0.06)] py-12">
      <FadeIn>
        <p className="mb-8 text-center text-xs tracking-widest text-zinc-600 uppercase">
          Trusted by 2,000+ service businesses
        </p>
      </FadeIn>

      <div className="relative">
        {/* Gradient edges */}
        <div className="pointer-events-none absolute top-0 left-0 z-10 h-full w-24 bg-gradient-to-r from-black to-transparent" />
        <div className="pointer-events-none absolute top-0 right-0 z-10 h-full w-24 bg-gradient-to-l from-black to-transparent" />

        <div className="animate-marquee flex items-center gap-12">
          {[...logos, ...logos].map((logo, i) => (
            <LogoPlaceholder
              key={`${logo.name}-${i}`}
              name={logo.name}
              width={logo.width}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
