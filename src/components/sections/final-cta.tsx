"use client";

import { ArrowRight, LayoutDashboard } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";
import { SpotlightButton } from "@/components/ui/spotlight-button";
import { useAuthStore } from "@/lib/auth-store";

export function FinalCTA() {
  const { user, initialized } = useAuthStore();
  const isAuthenticated = initialized && !!user;
  return (
    <section className="relative overflow-hidden py-32 md:py-40">
      {/* Line grid background */}
      <div className="pointer-events-none absolute inset-0 bg-line-grid opacity-[0.3]" />

      {/* Massive logo background */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="text-[280px] font-bold leading-none tracking-tighter select-none sm:text-[400px] md:text-[600px]"
          style={{ color: "var(--cta-bg-text)" }}
        >
          iW
        </div>
      </div>

      {/* Primary emerald glow — commanding brand presence */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(16, 185, 129, 0.06) 0%, transparent 70%)",
        }}
      />

      {/* Secondary radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, var(--glow-soft) 0%, transparent 60%)`,
        }}
      />

      {/* Noise overlay */}
      <div className="stealth-noise" />

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
            {isAuthenticated
              ? "Your workspace is ready. Pick up where you left off."
              : "Join 2,000+ service businesses already running on iWorkr. 14-day free trial. No credit card required."}
          </p>
        </FadeIn>

        <FadeIn delay={0.25}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {isAuthenticated ? (
              <SpotlightButton size="lg" href="/dashboard">
                <LayoutDashboard size={16} />
                Open Dashboard
              </SpotlightButton>
            ) : (
              <>
                <SpotlightButton
                  size="lg"
                  href="/auth"
                  style={{
                    background: "var(--brand)",
                    color: "#fff",
                    borderColor: "transparent",
                    boxShadow: "0 0 30px -8px rgba(16, 185, 129, 0.4)",
                  }}
                >
                  Start free trial
                  <ArrowRight size={16} />
                </SpotlightButton>
                <SpotlightButton variant="secondary" size="lg" href="mailto:sales@iworkr.com">
                  Contact sales
                </SpotlightButton>
              </>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
