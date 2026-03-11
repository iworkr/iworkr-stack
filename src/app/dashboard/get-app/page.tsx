"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import {
  Smartphone,
  Apple,
  Monitor,
  QrCode,
  Send,
  Check,
  Loader2,
  Download,
  Shield,
  Zap,
  MapPin,
  Camera,
  Bell,
} from "lucide-react";
import { sendAppDownloadLink } from "@/app/actions/sms";

const FEATURES = [
  { icon: MapPin, label: "GPS Tracking", desc: "Real-time technician location" },
  { icon: Camera, label: "Photo Upload", desc: "Capture job site photos" },
  { icon: Bell, label: "Push Notifications", desc: "Instant dispatch alerts" },
  { icon: Zap, label: "Offline Mode", desc: "Works without internet" },
];

export default function GetAppPage() {
  const [smsNumber, setSmsNumber] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);

  async function handleSendSMS() {
    if (!smsNumber.trim()) return;
    setSmsSending(true);
    setSmsError(null);
    const result = await sendAppDownloadLink(smsNumber.trim());
    setSmsSending(false);
    if (result.error) {
      setSmsError(result.error);
    } else {
      setSmsSent(true);
      setTimeout(() => setSmsSent(false), 3000);
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Noise texture overlay */}
      <div className="stealth-noise" />

      {/* Atmospheric glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[350px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-500/[0.03] blur-[120px]" />

      {/* Header */}
      <div className="relative z-10 border-b border-[var(--border-base)] bg-[var(--header-bg)] px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-hover)]">
            <Smartphone size={18} className="text-black" />
          </div>
          <div>
            <span className="block font-mono text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Distribution</span>
            <h1 className="text-[15px] font-medium text-[var(--text-primary)]">Get the App</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 text-center"
          >
            <span className="mb-3 inline-block font-mono text-[10px] font-bold tracking-widest text-[var(--brand)] uppercase">Field-ready apps</span>
            <h2 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)]">
              Your workspace in your pocket.
            </h2>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">
              Dispatch jobs, track crews, and capture photos — all from the field.
            </p>
          </motion.div>

          {/* Download Cards */}
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* iOS */}
            <motion.a
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              href="https://apps.apple.com/app/iworkr"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 transition-all hover:border-[var(--card-border-hover)] hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.15)]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5">
                <Apple size={28} className="text-zinc-300" />
              </div>
              <div className="flex-1">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Download on the</p>
                <p className="text-[18px] font-semibold text-[var(--text-primary)]">App Store</p>
              </div>
              <Download size={16} className="text-[var(--text-muted)] transition-colors group-hover:text-[var(--brand)]" />
            </motion.a>

            {/* Android */}
            <motion.a
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              href="https://play.google.com/store/apps/details?id=com.iworkr.app"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 transition-all hover:border-[var(--card-border-hover)] hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.15)]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5">
                <svg viewBox="0 0 24 24" className="h-7 w-7 fill-zinc-300">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 010 1.381l-2.302 2.302-2.533-2.533 2.533-2.452zM5.864 2.658L16.8 9.006l-2.302 2.302L5.864 2.658z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Get it on</p>
                <p className="text-[18px] font-semibold text-[var(--text-primary)]">Google Play</p>
              </div>
              <Download size={16} className="text-[var(--text-muted)] transition-colors group-hover:text-[var(--brand)]" />
            </motion.a>
          </div>

          {/* QR Code + SMS */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2"
          >
            {/* QR Code */}
            <div className="flex flex-col items-center rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
              <QrCode size={14} className="mb-2 text-[var(--text-muted)]" />
              <p className="mb-4 text-[11px] text-[var(--text-muted)]">Scan with your phone camera</p>
              <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-[var(--border-active)] bg-white p-3">
                {/* QR code placeholder — in production, use qrcode.react */}
                <svg viewBox="0 0 200 200" className="h-full w-full">
                  <rect width="200" height="200" fill="white" />
                  {/* Simplified QR pattern */}
                  <rect x="20" y="20" width="60" height="60" fill="black" rx="4" />
                  <rect x="30" y="30" width="40" height="40" fill="white" rx="2" />
                  <rect x="38" y="38" width="24" height="24" fill="black" rx="2" />
                  <rect x="120" y="20" width="60" height="60" fill="black" rx="4" />
                  <rect x="130" y="30" width="40" height="40" fill="white" rx="2" />
                  <rect x="138" y="38" width="24" height="24" fill="black" rx="2" />
                  <rect x="20" y="120" width="60" height="60" fill="black" rx="4" />
                  <rect x="30" y="130" width="40" height="40" fill="white" rx="2" />
                  <rect x="38" y="138" width="24" height="24" fill="black" rx="2" />
                  {/* Data cells */}
                  <rect x="90" y="20" width="10" height="10" fill="black" />
                  <rect x="90" y="40" width="10" height="10" fill="black" />
                  <rect x="90" y="60" width="10" height="10" fill="black" />
                  <rect x="90" y="90" width="20" height="20" fill="#10B981" rx="3" />
                  <rect x="120" y="90" width="10" height="10" fill="black" />
                  <rect x="140" y="90" width="10" height="10" fill="black" />
                  <rect x="160" y="90" width="10" height="10" fill="black" />
                  <rect x="90" y="120" width="10" height="10" fill="black" />
                  <rect x="90" y="140" width="10" height="10" fill="black" />
                  <rect x="120" y="120" width="60" height="60" fill="black" rx="4" />
                  <rect x="130" y="130" width="40" height="40" fill="white" rx="2" />
                  <rect x="140" y="140" width="20" height="20" fill="#10B981" rx="3" />
                </svg>
              </div>
              <p className="mt-3 text-[10px] text-[var(--text-dim)]">Auto-detects iOS / Android</p>
            </div>

            {/* SMS Link */}
            <div className="flex flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
              <Send size={14} className="mb-2 text-[var(--text-muted)]" />
              <p className="mb-1 text-[12px] font-medium text-[var(--text-primary)]">Text me the link</p>
              <p className="mb-4 text-[11px] text-[var(--text-muted)]">
                We&apos;ll send a download link to your phone.
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={smsNumber}
                  onChange={(e) => setSmsNumber(e.target.value)}
                  placeholder="+61 400 000 000"
                  className="flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2.5 text-[12px] text-[var(--text-primary)] placeholder-zinc-700 outline-none transition-all focus:border-[var(--brand)]/30 focus:shadow-[0_0_12px_-4px_rgba(16,185,129,0.15)]"
                />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSendSMS}
                  disabled={!smsNumber.trim() || smsSending}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-[var(--brand)] to-[var(--brand-hover)] px-4 py-2 text-[11px] font-semibold text-black disabled:opacity-50"
                >
                  {smsSending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : smsSent ? (
                    <Check size={12} />
                  ) : (
                    <Send size={12} />
                  )}
                  {smsSent ? "Sent!" : "Send"}
                </motion.button>
              </div>

              <div className="mt-auto pt-6">
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border-base)] bg-[var(--subtle-bg)] p-3">
                  <Shield size={12} className="text-[var(--text-muted)]" />
                  <p className="text-[10px] text-[var(--text-muted)]">
                    We&apos;ll only send the download link. No spam, ever.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Desktop App */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-10"
          >
            <h3 className="mb-4 text-center font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Desktop App
            </h3>
            <a
              href="/download"
              className="group flex items-center gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 transition-all hover:border-[var(--card-border-hover)] hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.15)]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5">
                <Monitor size={28} className="text-zinc-300" />
              </div>
              <div className="flex-1">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Available for</p>
                <p className="text-[18px] font-semibold text-[var(--text-primary)]">macOS & Windows</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  Native desktop app for dispatchers & managers
                </p>
              </div>
              <Download size={16} className="text-[var(--text-muted)] transition-colors group-hover:text-[var(--brand)]" />
            </a>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="mb-4 text-center font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Mobile Features
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.05 }}
                  className="flex flex-col items-center rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-center transition-colors hover:border-[var(--card-border-hover)]"
                >
                  <f.icon size={20} className="mb-2 text-[var(--brand)]" />
                  <p className="text-[12px] font-medium text-[var(--text-primary)]">{f.label}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
