"use client";

import { ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";
import { SpotlightButton } from "@/components/ui/spotlight-button";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-32 md:py-40">
      {/* Massive logo background */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="text-[280px] font-bold leading-none tracking-tighter select-none sm:text-[400px] md:text-[600px]"
          style={{ color: "var(--cta-bg-text)" }}
        >
          iW
        </div>
      </div>

      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, var(--glow-soft) 0%, transparent 60%)`,
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 text-center md:px-12">
        <FadeIn>
          <h2 className="mx-auto max-w-3xl text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            <span
              style={{
                backgroundImage: `linear-gradient(to bottom, var(--hero-grad-from), var(--hero-grad-to))`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Built for the future of trade.
            </span>
            <br />
            <span className="text-[var(--text-muted)]">Available today.</span>
          </h2>
        </FadeIn>

        <FadeIn delay={0.15}>
          <p className="mx-auto mt-6 max-w-lg text-base text-[var(--text-muted)]">
            Join 2,000+ service businesses already running on iWorkr.
            14-day free trial. No credit card required.
          </p>
        </FadeIn>

        <FadeIn delay={0.25}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <SpotlightButton size="lg" href="/auth">
              Start free trial
              <ArrowRight size={16} />
            </SpotlightButton>
            <SpotlightButton variant="secondary" size="lg" href="mailto:sales@iworkr.com">
              Contact sales
            </SpotlightButton>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
