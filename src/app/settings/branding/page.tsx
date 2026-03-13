"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Upload,
  Globe,
  CheckCircle2,
  Copy,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Eye,
  Sun,
  Moon,
  X,
  Loader2,
  Sparkles,
  Shield,
  Mail,
  ExternalLink,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useBrandingStore, type WorkspaceBranding } from "@/lib/stores/branding-store";
import { useToastStore } from "@/components/app/action-toast";
import {
  createCustomDomain,
  verifyCustomDomain,
  removeCustomDomain,
} from "@/app/actions/branding";
import { createClient } from "@/lib/supabase/client";

/* ── Color presets ────────────────────────────────── */
const PRESETS = [
  { hex: "#10B981", label: "Emerald" },
  { hex: "#3B82F6", label: "Blue" },
  { hex: "#8B5CF6", label: "Violet" },
  { hex: "#F43F5E", label: "Rose" },
  { hex: "#F59E0B", label: "Amber" },
  { hex: "#EC4899", label: "Pink" },
  { hex: "#06B6D4", label: "Cyan" },
  { hex: "#14B8A6", label: "Teal" },
  { hex: "#6366F1", label: "Indigo" },
  { hex: "#EF4444", label: "Red" },
  { hex: "#84CC16", label: "Lime" },
  { hex: "#F97316", label: "Orange" },
];

/* ── Helpers ──────────────────────────────────────── */
function getContrastYIQ(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#FFFFFF";
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#FFFFFF";
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

/* ── Main Page ────────────────────────────────────── */
export default function BrandingPage() {
  const { currentOrg } = useAuthStore();
  const orgId = currentOrg?.id;
  const branding = useBrandingStore((s) => s.branding);
  const loadFromServer = useBrandingStore((s) => s.loadFromServer);
  const updateColor = useBrandingStore((s) => s.updateColor);
  const uploadLogo = useBrandingStore((s) => s.uploadLogo);
  const { addToast } = useToastStore();

  const [colorInput, setColorInput] = useState("#10B981");
  const [savingColor, setSavingColor] = useState(false);
  const [uploadingLight, setUploadingLight] = useState(false);
  const [uploadingDark, setUploadingDark] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"dark" | "light">("dark");

  const lightLogoRef = useRef<HTMLInputElement>(null);
  const darkLogoRef = useRef<HTMLInputElement>(null);
  const colorDebounce = useRef<NodeJS.Timeout | null>(null);

  // Load branding on mount
  useEffect(() => {
    if (orgId) loadFromServer(orgId);
  }, [orgId, loadFromServer]);

  // Sync color input from store
  useEffect(() => {
    if (branding?.primary_color_hex) {
      setColorInput(branding.primary_color_hex);
    }
  }, [branding?.primary_color_hex]);

  // Debounced color save
  const handleColorChange = useCallback(
    (hex: string) => {
      setColorInput(hex);
      if (colorDebounce.current) clearTimeout(colorDebounce.current);
      if (!orgId || !isValidHex(hex)) return;

      colorDebounce.current = setTimeout(async () => {
        setSavingColor(true);
        const result = await updateColor(orgId, hex);
        setSavingColor(false);
        if (result.error) addToast(result.error);
      }, 500);
    },
    [orgId, updateColor, addToast]
  );

  // Logo upload handler
  const handleLogoUpload = async (file: File, variant: "light" | "dark") => {
    if (!orgId) return;
    const setUploading = variant === "light" ? setUploadingLight : setUploadingDark;
    setUploading(true);

    const result = await uploadLogo(orgId, file, variant);
    setUploading(false);

    if (result.error) {
      addToast(result.error);
    } else {
      addToast(`${variant === "light" ? "Dark mode" : "Light mode"} logo updated`);
    }
  };

  // Domain handlers
  const handleAddDomain = async () => {
    if (!orgId || !domainInput.trim()) return;
    setAddingDomain(true);
    const result = await createCustomDomain(orgId, domainInput.trim());
    setAddingDomain(false);
    if (result.error) {
      addToast(result.error);
    } else {
      addToast("Domain created — add the DNS records below");
      loadFromServer(orgId);
    }
  };

  const handleVerifyDomain = async () => {
    if (!orgId) return;
    setVerifying(true);
    const result = await verifyCustomDomain(orgId);
    setVerifying(false);
    if (result.error) {
      addToast(result.error);
    } else if ((result as any).verified) {
      addToast("Domain verified! Emails will now send from your domain.");
    } else {
      addToast("DNS records still propagating. Try again in a few minutes.");
    }
    loadFromServer(orgId);
  };

  const handleRemoveDomain = async () => {
    if (!orgId) return;
    setRemoving(true);
    const result = await removeCustomDomain(orgId);
    setRemoving(false);
    if (result.error) {
      addToast(result.error);
    } else {
      addToast("Custom domain removed");
      setDomainInput("");
    }
    loadFromServer(orgId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast("Copied to clipboard");
  };

  const brandHex = colorInput || "#10B981";
  const brandText = getContrastYIQ(brandHex);

  return (
    <>
      {/* ─── Page Header ─── */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
            Settings
          </span>
          <ChevronRight size={10} className="text-zinc-600" />
          <span className="font-mono text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
            Branding
          </span>
        </div>
        <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          Brand Identity
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Customize your workspace colors, logos, and email domain. Your brand identity is applied across the web app, mobile app, PDFs, and client-facing portals.
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Section 1: Brand Color ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={15} className="text-[var(--text-muted)]" />
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Brand Color</h2>
          {savingColor && (
            <Loader2 size={13} className="animate-spin text-[var(--text-muted)]" />
          )}
        </div>

        <div className="rounded-lg border border-[var(--border-base)] bg-[var(--surface-1)] p-5">
          {/* Color picker row */}
          <div className="flex items-start gap-6 mb-5">
            {/* Native color input + hex */}
            <div className="flex items-center gap-3">
              <div
                className="relative h-12 w-12 overflow-hidden rounded-lg border border-[var(--border-active)] cursor-pointer"
                style={{ backgroundColor: brandHex }}
              >
                <input
                  type="color"
                  value={brandHex}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
              <div>
                <input
                  value={colorInput}
                  onChange={(e) => {
                    const val = e.target.value.startsWith("#")
                      ? e.target.value
                      : `#${e.target.value}`;
                    handleColorChange(val.slice(0, 7));
                  }}
                  maxLength={7}
                  className="w-[100px] rounded-md border border-[var(--border-base)] bg-[var(--surface-2)] px-3 py-1.5 text-[13px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--brand)]/40"
                  placeholder="#10B981"
                />
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                  Text: {brandText === "#FFFFFF" ? "White" : "Black"} (auto WCAG)
                </p>
              </div>
            </div>

            {/* Live preview */}
            <div className="flex-1">
              <p className="mb-2 text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Live Preview
              </p>
              <div className="flex items-center gap-3">
                <button
                  className="rounded-md px-4 py-2 text-[13px] font-medium transition-all hover:brightness-110"
                  style={{ backgroundColor: brandHex, color: brandText }}
                >
                  Primary Button
                </button>
                <button
                  className="rounded-md border px-4 py-2 text-[13px] font-medium transition-all"
                  style={{ borderColor: brandHex, color: brandHex }}
                >
                  Outline
                </button>
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                  style={{
                    backgroundColor: `${brandHex}15`,
                    color: brandHex,
                  }}
                >
                  Badge
                </span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: brandHex }}
                  />
                  <span className="text-[12px] text-[var(--text-muted)]">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preset swatches */}
          <div>
            <p className="mb-2 text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Presets
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  onClick={() => handleColorChange(preset.hex)}
                  className={`group relative h-8 w-8 rounded-md border transition-all hover:scale-110 ${
                    colorInput?.toUpperCase() === preset.hex.toUpperCase()
                      ? "border-white/40 ring-1 ring-white/20"
                      : "border-[var(--border-base)] hover:border-white/20"
                  }`}
                  style={{ backgroundColor: preset.hex }}
                  title={preset.label}
                >
                  {colorInput?.toUpperCase() === preset.hex.toUpperCase() && (
                    <CheckCircle2
                      size={12}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ color: getContrastYIQ(preset.hex) }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Section 2: Logo Upload ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon size={15} className="text-[var(--text-muted)]" />
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Logo</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Dark mode logo (logo_light — displayed on dark backgrounds) */}
          <div className="rounded-lg border border-[var(--border-base)] bg-[var(--surface-1)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Moon size={13} className="text-zinc-400" />
              <p className="text-[12px] font-medium text-[var(--text-muted)]">Dark mode logo</p>
            </div>
            <p className="mb-4 text-[11px] text-zinc-600">
              Shown on dark backgrounds (dashboard, app). Use a light/white logo with transparent background.
            </p>
            <div
              className="relative flex h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border-active)] bg-[#050505] cursor-pointer transition-all hover:border-white/20"
              onClick={() => lightLogoRef.current?.click()}
            >
              {branding?.logo_light_url ? (
                <img
                  src={branding.logo_light_url}
                  alt="Dark mode logo"
                  className="max-h-16 max-w-[200px] object-contain"
                />
              ) : uploadingLight ? (
                <Loader2 size={20} className="animate-spin text-zinc-500" />
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload size={18} className="text-zinc-600" />
                  <span className="text-[11px] text-zinc-600">Click to upload</span>
                </div>
              )}
            </div>
            <input
              ref={lightLogoRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file, "light");
                e.target.value = "";
              }}
            />
          </div>

          {/* Light mode logo (logo_dark — displayed on light/white backgrounds) */}
          <div className="rounded-lg border border-[var(--border-base)] bg-[var(--surface-1)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sun size={13} className="text-zinc-400" />
              <p className="text-[12px] font-medium text-[var(--text-muted)]">Light mode logo</p>
            </div>
            <p className="mb-4 text-[11px] text-zinc-600">
              Used on invoices, emails, and white-background portals. Use a dark/colored logo.
            </p>
            <div
              className="relative flex h-24 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-[#FAFAFA] cursor-pointer transition-all hover:border-zinc-400"
              onClick={() => darkLogoRef.current?.click()}
            >
              {branding?.logo_dark_url ? (
                <img
                  src={branding.logo_dark_url}
                  alt="Light mode logo"
                  className="max-h-16 max-w-[200px] object-contain"
                />
              ) : uploadingDark ? (
                <Loader2 size={20} className="animate-spin text-zinc-400" />
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload size={18} className="text-zinc-400" />
                  <span className="text-[11px] text-zinc-400">Click to upload</span>
                </div>
              )}
            </div>
            <input
              ref={darkLogoRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file, "dark");
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <p className="mt-2 text-[10px] text-zinc-600">
          Recommended: PNG or SVG with transparent background. Max 5MB. Will be displayed at 32px height in navigation.
        </p>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Section 3: Live Brand Preview ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Eye size={15} className="text-[var(--text-muted)]" />
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Brand Preview</h2>
          <div className="ml-auto flex items-center rounded-md border border-[var(--border-base)] bg-[var(--surface-2)]">
            <button
              onClick={() => setPreviewMode("dark")}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-l-md transition-colors ${
                previewMode === "dark"
                  ? "bg-[rgba(255,255,255,0.08)] text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Moon size={10} /> Dark
            </button>
            <button
              onClick={() => setPreviewMode("light")}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-r-md transition-colors ${
                previewMode === "light"
                  ? "bg-[rgba(255,255,255,0.08)] text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Sun size={10} /> Light
            </button>
          </div>
        </div>

        {/* Preview card */}
        <div
          className="rounded-lg border overflow-hidden"
          style={{
            backgroundColor: previewMode === "dark" ? "#050505" : "#FAFAFA",
            borderColor: previewMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
          }}
        >
          {/* Simulated header */}
          <div
            className="flex items-center gap-3 px-5 py-3 border-b"
            style={{
              backgroundColor: previewMode === "dark" ? "#0A0A0A" : "#FFFFFF",
              borderColor: previewMode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
            }}
          >
            {branding?.logo_light_url && previewMode === "dark" ? (
              <img src={branding.logo_light_url} alt="Logo" className="h-6 object-contain" />
            ) : branding?.logo_dark_url && previewMode === "light" ? (
              <img src={branding.logo_dark_url} alt="Logo" className="h-6 object-contain" />
            ) : (
              <div
                className="h-6 w-6 rounded-md"
                style={{ backgroundColor: brandHex }}
              />
            )}
            <span
              className="text-[13px] font-semibold"
              style={{ color: previewMode === "dark" ? "#EDEDED" : "#18181B" }}
            >
              {currentOrg?.name || "Your Company"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: brandHex }}
              />
              <span
                className="text-[11px]"
                style={{ color: previewMode === "dark" ? "#71717A" : "#A1A1AA" }}
              >
                Online
              </span>
            </div>
          </div>

          {/* Simulated content */}
          <div className="px-5 py-5">
            <div className="flex items-center gap-3 mb-4">
              <button
                className="rounded-md px-4 py-2 text-[12px] font-medium"
                style={{ backgroundColor: brandHex, color: brandText }}
              >
                Create Job
              </button>
              <button
                className="rounded-md px-4 py-2 text-[12px] font-medium border"
                style={{
                  borderColor: previewMode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                  color: previewMode === "dark" ? "#EDEDED" : "#18181B",
                }}
              >
                View Schedule
              </button>
            </div>
            <div className="flex gap-3">
              {["Active", "Pending", "Completed"].map((status, i) => (
                <span
                  key={status}
                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                  style={{
                    backgroundColor: i === 0 ? `${brandHex}15` : previewMode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                    color: i === 0 ? brandHex : previewMode === "dark" ? "#71717A" : "#A1A1AA",
                  }}
                >
                  {status}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Section 4: Custom Email Domain ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={15} className="text-[var(--text-muted)]" />
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Custom Email Domain</h2>
          <span className="ml-1 rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[9px] font-bold text-[var(--brand)] uppercase tracking-wider">
            Enterprise
          </span>
        </div>
        <p className="mb-4 text-[12px] text-[var(--text-muted)]">
          Send invoices, reminders, and notifications from your own domain instead of <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-mono">notifications@mail.iworkr.com</code>
        </p>

        <div className="rounded-lg border border-[var(--border-base)] bg-[var(--surface-1)] p-5">
          {branding?.dns_status === "unconfigured" || !branding?.custom_email_domain ? (
            /* ─ No domain configured ─ */
            <div>
              <div className="flex items-center gap-3">
                <input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="acmeplumbing.com.au"
                  className="flex-1 rounded-md border border-[var(--border-base)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--brand)]/40 font-mono"
                />
                <button
                  onClick={handleAddDomain}
                  disabled={addingDomain || !domainInput.trim()}
                  className="flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ backgroundColor: brandHex, color: brandText }}
                >
                  {addingDomain ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Globe size={13} />
                  )}
                  Connect Domain
                </button>
              </div>
              <p className="mt-2 text-[10px] text-zinc-600">
                You'll need access to your domain's DNS settings (GoDaddy, Cloudflare, Route53, etc.)
              </p>
            </div>
          ) : (
            /* ─ Domain configured — show DNS records ─ */
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-[var(--text-muted)]" />
                  <span className="text-[14px] font-medium text-[var(--text-primary)] font-mono">
                    {branding.custom_email_domain}
                  </span>
                  <DnsStatusBadge status={branding.dns_status} />
                </div>
                <div className="flex items-center gap-2">
                  {branding.dns_status !== "verified" && (
                    <button
                      onClick={handleVerifyDomain}
                      disabled={verifying}
                      className="flex items-center gap-1.5 rounded-md border border-[var(--border-base)] px-3 py-1.5 text-[12px] text-[var(--text-muted)] transition-colors hover:text-white hover:border-white/20"
                    >
                      {verifying ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RefreshCw size={12} />
                      )}
                      Verify DNS
                    </button>
                  )}
                  <button
                    onClick={handleRemoveDomain}
                    disabled={removing}
                    className="flex items-center gap-1.5 rounded-md border border-red-500/20 px-3 py-1.5 text-[12px] text-red-400/80 transition-colors hover:bg-red-500/10"
                  >
                    {removing ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                    Remove
                  </button>
                </div>
              </div>

              {/* DNS Records Table */}
              {branding.dns_records && branding.dns_records.length > 0 && (
                <div className="overflow-hidden rounded-md border border-[var(--border-base)]">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-[var(--border-base)] bg-[var(--surface-2)]">
                        <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">Type</th>
                        <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">Name</th>
                        <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">Value</th>
                        <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">Status</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {branding.dns_records.map((record, i) => (
                        <tr
                          key={i}
                          className="border-b border-[var(--border-base)] last:border-0"
                        >
                          <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-primary)]">
                            {record.type}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-muted)] max-w-[200px] truncate">
                            {record.name}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-[var(--text-muted)] max-w-[300px] truncate">
                            {record.value}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                record.status === "verified"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              {record.status || "pending"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => copyToClipboard(record.value)}
                              className="rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300"
                              title="Copy value"
                            >
                              <Copy size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {branding.dns_status === "verified" && (
                <div className="mt-4 flex items-center gap-2 rounded-md bg-emerald-500/5 border border-emerald-500/10 px-4 py-3">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-[12px] font-medium text-emerald-400">Domain verified</p>
                    <p className="text-[11px] text-zinc-500">
                      All system emails now send from{" "}
                      <code className="text-[10px] font-mono text-emerald-300">
                        dispatch@{branding.custom_email_domain}
                      </code>
                    </p>
                  </div>
                </div>
              )}

              {branding.dns_status === "pending" && (
                <div className="mt-4 flex items-center gap-2 rounded-md bg-amber-500/5 border border-amber-500/10 px-4 py-3">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                  <div>
                    <p className="text-[12px] font-medium text-amber-400">Waiting for DNS propagation</p>
                    <p className="text-[11px] text-zinc-500">
                      Add the records above to your DNS provider. Propagation can take up to 24 hours.
                    </p>
                  </div>
                </div>
              )}

              {branding.dns_status === "failed" && (
                <div className="mt-4 flex items-center gap-2 rounded-md bg-red-500/5 border border-red-500/10 px-4 py-3">
                  <AlertTriangle size={15} className="text-red-400 shrink-0" />
                  <div>
                    <p className="text-[12px] font-medium text-red-400">DNS verification failed</p>
                    <p className="text-[11px] text-zinc-500">
                      Your DNS records may have changed. Please check your provider and try again.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="mb-10">
        <div className="rounded-lg border border-[var(--border-base)] bg-[var(--surface-1)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-[var(--text-muted)]" />
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
              Where your brand appears
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                icon: <Eye size={16} />,
                title: "Dashboard",
                desc: "Buttons, active states, badges, and status indicators use your brand color.",
              },
              {
                icon: <Mail size={16} />,
                title: "Emails",
                desc: "Invoices, reminders, and notifications display your logo and brand color.",
              },
              {
                icon: <Shield size={16} />,
                title: "Client Portals",
                desc: "Payment links and tracking pages show your logo — zero iWorkr branding.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-md bg-[var(--surface-2)] p-3">
                <div className="flex items-center gap-2 mb-1 text-[var(--text-muted)]">
                  {item.icon}
                  <span className="text-[12px] font-medium text-[var(--text-primary)]">
                    {item.title}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* ── DNS Status Badge ──────────────────────────────── */
function DnsStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    unconfigured: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400", label: "Not configured" },
    pending: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400 animate-pulse", label: "Pending" },
    verified: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", label: "Verified" },
    failed: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400", label: "Failed" },
  };
  const c = configs[status] || configs.unconfigured;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
