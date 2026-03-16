"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Monitor,
  Apple,
  Download,
  Shield,
  Zap,
  Bell,
  Lock,
  Cpu,
  WifiOff,
  ArrowRight,
  Check,
  ChevronDown,
} from "lucide-react";

type Platform = "mac-arm" | "mac-intel" | "windows" | "linux" | "unknown";

interface VersionInfo {
  version: string;
  releaseDate: string;
  macArmUrl: string;
  macIntelUrl: string;
  winUrl: string;
  linuxUrl: string;
}

const FEATURES = [
  {
    icon: Zap,
    label: "Instant Launch",
    desc: "Opens in under 200ms. No browser overhead.",
  },
  {
    icon: Bell,
    label: "Native Notifications",
    desc: "Rich alerts that bounce your dock icon.",
  },
  {
    icon: Lock,
    label: "Biometric Auth",
    desc: "TouchID and Windows Hello support.",
  },
  {
    icon: WifiOff,
    label: "Offline Ready",
    desc: "Keep working when the connection drops.",
  },
  {
    icon: Shield,
    label: "Signed & Notarized",
    desc: "Apple notarized. Microsoft signed. Zero warnings.",
  },
  {
    icon: Cpu,
    label: "Native Performance",
    desc: "Dedicated process. No tab competition.",
  },
];

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() ?? "";

  if (ua.includes("mac") || platform.includes("mac")) {
    // @ts-expect-error — userAgentData is not yet in TS lib
    const arch = navigator.userAgentData?.architecture;
    if (arch === "arm" || ua.includes("arm64")) return "mac-arm";
    return "mac-arm"; // Default to Apple Silicon for modern Macs
  }
  if (ua.includes("win") || platform.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "unknown";
}

export default function DownloadPage() {
  const [platform] = useState<Platform>(() => detectPlatform());
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);

  useEffect(() => {
    fetch("/api/desktop/version")
      .then((r) => r.json())
      .then(setVersionInfo)
      .catch(() => {});
  }, []);

  const primaryDownload = getPrimaryDownload(platform, versionInfo);

  return (
    <div className="relative min-h-screen bg-[var(--background)]">
      {/* Noise texture overlay */}
      <div className="stealth-noise" />

      {/* Atmospheric glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-emerald-500/[0.04] blur-[120px]" />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-base)] bg-[var(--header-bg)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)] to-[var(--brand-hover)]">
              <span className="text-sm font-bold text-black">W</span>
            </div>
            <span className="text-[15px] font-semibold text-[var(--text-primary)]">Workspace</span>
          </Link>
          <a
            href="/auth"
            className="rounded-[var(--radius-button)] bg-[var(--subtle-bg)] px-4 py-2 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--subtle-bg-hover)]"
          >
            Sign In
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-40 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            <Monitor size={28} className="text-[var(--brand)]" />
          </div>

          <span className="mb-3 inline-block font-mono text-[9px] font-bold tracking-widest text-[var(--brand)] uppercase">The Obsidian Monolith</span>
          <h1 className="text-[42px] font-bold leading-tight tracking-tight text-[var(--text-heading)]">
            Desktop App
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-[var(--text-muted)]">
            A dedicated command center. No browser distractions.
            Native notifications. Always one click away.
          </p>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 flex flex-col items-center gap-3"
          >
            <a
              href={primaryDownload.url}
              className="group flex items-center gap-3 rounded-[var(--radius-button)] bg-gradient-to-b from-[var(--brand)] to-[var(--brand-hover)] px-8 py-4 text-[15px] font-semibold text-black shadow-[var(--brand-glow)] transition-all hover:shadow-[0_0_60px_-10px_rgba(16,185,129,0.5)]"
            >
              <Download size={18} />
              {primaryDownload.label}
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </a>

            <div className="flex items-center gap-4 font-mono text-[10px] text-[var(--text-dim)]">
              {versionInfo && (
                <span className="flex items-center gap-1">
                  <Check size={10} className="text-[var(--brand)]" />
                  v{versionInfo.version}
                </span>
              )}
              <span>{primaryDownload.meta}</span>
              <span className="flex items-center gap-1">
                <Shield size={10} />
                Signed & Notarized
              </span>
            </div>
          </motion.div>

          {/* Other platforms */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6"
          >
            <button
              onClick={() => setShowAllPlatforms(!showAllPlatforms)}
              className="flex items-center gap-1 text-[12px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] mx-auto"
            >
              Other platforms
              <ChevronDown
                size={12}
                className={`transition-transform ${showAllPlatforms ? "rotate-180" : ""}`}
              />
            </button>

            {showAllPlatforms && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 flex flex-wrap items-center justify-center gap-3"
              >
                <PlatformLink
                  icon={<Apple size={14} />}
                  label="macOS (Apple Silicon)"
                  href={versionInfo?.macArmUrl ?? "#"}
                  active={platform === "mac-arm"}
                />
                <PlatformLink
                  icon={<Apple size={14} />}
                  label="macOS (Intel)"
                  href={versionInfo?.macIntelUrl ?? "#"}
                  active={platform === "mac-intel"}
                />
                <PlatformLink
                  icon={<WindowsIcon />}
                  label="Windows (x64)"
                  href={versionInfo?.winUrl ?? "#"}
                  active={platform === "windows"}
                />
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        {/* Window Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mx-auto mt-16 w-full max-w-4xl"
        >
          <div className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--surface-1)] shadow-2xl">
            {/* Fake title bar */}
            <div className="flex h-10 items-center border-b border-[var(--border-base)] px-4">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <div className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="ml-4 text-[11px] text-[var(--text-dim)]">Workspace</span>
            </div>
            {/* Content area */}
            <div className="flex h-[340px]">
              {/* Sidebar skeleton */}
              <div className="w-[200px] border-r border-[var(--border-base)] p-4">
                <div className="mb-4 h-8 w-8 rounded-lg bg-white/[0.04]" />
                <div className="space-y-2">
                  <div className="h-7 w-[70%] rounded-md bg-white/[0.06]" />
                  <div className="h-7 w-[55%] rounded-md bg-white/[0.03]" />
                  <div className="h-7 w-[80%] rounded-md bg-white/[0.03]" />
                  <div className="h-7 w-[45%] rounded-md bg-white/[0.03]" />
                  <div className="my-3 h-px bg-white/[0.06]" />
                  <div className="h-7 w-[60%] rounded-md bg-white/[0.03]" />
                  <div className="h-7 w-[75%] rounded-md bg-white/[0.03]" />
                </div>
              </div>
              {/* Main content skeleton */}
              <div className="flex-1 p-6">
                <div className="mb-4 h-5 w-48 rounded bg-white/[0.06]" />
                <div className="mb-6 h-3 w-80 rounded bg-white/[0.03]" />
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-28 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="mb-2 h-3 w-16 rounded bg-white/[0.06]" />
                      <div className="mt-3 h-8 w-12 rounded bg-[#10B981]/10" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="h-24 rounded-xl border border-white/[0.06] bg-white/[0.02]" />
                  <div className="h-24 rounded-xl border border-white/[0.06] bg-white/[0.02]" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-20">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-2 text-center font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]"
        >
          Why Desktop?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-12 text-center text-[24px] font-bold text-[var(--text-heading)]"
        >
          Built for operators who live in their workspace.
        </motion.p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 transition-colors hover:border-[var(--card-border-hover)]"
            >
              <f.icon size={20} className="mb-3 text-[var(--brand)]" />
              <p className="text-[14px] font-medium text-[var(--text-primary)]">{f.label}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* System Requirements */}
      <section className="relative z-10 border-t border-[var(--border-base)] py-16">
        <div className="mx-auto max-w-4xl px-6">
          <span className="mb-2 block text-center font-mono text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Compatibility</span>
          <h3 className="mb-8 text-center text-[18px] font-semibold text-[var(--text-primary)]">
            System Requirements
          </h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
              <div className="mb-3 flex items-center gap-2">
                <Apple size={16} className="text-[var(--text-muted)]" />
                <span className="text-[14px] font-medium text-[var(--text-primary)]">macOS</span>
              </div>
              <ul className="space-y-1.5 text-[12px] text-[var(--text-muted)]">
                <li>macOS 12 Monterey or later</li>
                <li>Apple Silicon (M1+) or Intel</li>
                <li>200 MB disk space</li>
                <li>Signed & Notarized by Apple</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
              <div className="mb-3 flex items-center gap-2">
                <WindowsIcon />
                <span className="text-[14px] font-medium text-[var(--text-primary)]">Windows</span>
              </div>
              <ul className="space-y-1.5 text-[12px] text-[var(--text-muted)]">
                <li>Windows 10 version 1903 or later</li>
                <li>x64 or ARM64 processor</li>
                <li>200 MB disk space</li>
                <li>EV Code Signed</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative z-10 border-t border-[var(--border-base)] py-16">
        <div className="text-center">
          <p className="text-[12px] text-[var(--text-dim)]">
            Also available on{" "}
            <a href="/dashboard/get-app" className="text-[var(--text-muted)] underline hover:text-[var(--text-primary)]">
              iOS & Android
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}

function PlatformLink({
  icon,
  label,
  href,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[12px] font-medium transition-all ${
        active
          ? "border-[var(--brand)]/30 bg-[rgba(16,185,129,0.06)] text-[var(--text-primary)]"
          : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:border-[var(--card-border-hover)]"
      }`}
    >
      {icon}
      {label}
      <Download size={12} className="ml-1 opacity-50" />
    </a>
  );
}

function WindowsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-400">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}

function getPrimaryDownload(
  platform: Platform,
  info: VersionInfo | null
): { url: string; label: string; meta: string } {
  const base = {
    "mac-arm": {
      url: info?.macArmUrl ?? "#",
      label: "Download for Mac (Apple Silicon)",
      meta: "macOS 12+ · ARM64 · .dmg",
    },
    "mac-intel": {
      url: info?.macIntelUrl ?? "#",
      label: "Download for Mac (Intel)",
      meta: "macOS 12+ · x64 · .dmg",
    },
    windows: {
      url: info?.winUrl ?? "#",
      label: "Download for Windows",
      meta: "Windows 10+ · x64 · .exe",
    },
    linux: {
      url: info?.linuxUrl ?? "#",
      label: "Download for Linux",
      meta: "Ubuntu/Debian · x64 · .AppImage",
    },
    unknown: {
      url: info?.macArmUrl ?? "#",
      label: "Download for Mac",
      meta: "macOS 12+ · .dmg",
    },
  };

  return base[platform];
}
