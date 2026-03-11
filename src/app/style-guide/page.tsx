"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, ArrowRight, Check, X, AlertTriangle, AlertCircle, Lock, Crown,
  Search, Plus, Loader2, Inbox, Briefcase, Calendar, Users, Banknote,
  Zap, Shield, CreditCard, MapPin, Send, Bot, Settings, Download,
  LayoutDashboard, CheckCircle2, Copy, ChevronDown, Moon, Sun, Eye,
} from "lucide-react";
import { SpotlightButton } from "@/components/ui/spotlight-button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Shimmer, ShimmerCircle, ShimmerBlock, ShimmerTeamRow } from "@/components/ui/shimmer";

/* ── Helpers ──────────────────────────────────────────── */

function SectionAnchor({ id, label, title, description }: { id: string; label: string; title: string; description?: string }) {
  return (
    <div id={id} className="scroll-mt-20 mb-10">
      <span className="mb-3 inline-block font-mono text-[9px] font-bold tracking-widest text-emerald-500/70 uppercase">{label}</span>
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      {description && <p className="mt-1.5 text-[13px] text-zinc-500 max-w-lg">{description}</p>}
    </div>
  );
}

function ShowcaseRow({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="mb-8">
      {label && <p className="mb-3 text-[11px] font-semibold tracking-wider text-zinc-600 uppercase">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative mt-3 rounded-lg border border-white/[0.06] bg-[#0A0A0A] overflow-x-auto">
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-2 right-2 z-10 rounded-md border border-white/[0.06] bg-zinc-900 p-1.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <pre className="p-4 text-[11px] leading-relaxed text-zinc-400 font-mono overflow-x-auto"><code>{code}</code></pre>
    </div>
  );
}

function ColorSwatch({ color, label, hex, border }: { color: string; label: string; hex: string; border?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`h-14 w-14 rounded-xl ${border ? "border border-white/10" : ""}`} style={{ background: color }} />
      <span className="text-[10px] font-medium text-zinc-400">{label}</span>
      <span className="font-mono text-[9px] text-zinc-600">{hex}</span>
    </div>
  );
}

/* ── Side Nav ─────────────────────────────────────────── */

const NAV_SECTIONS = [
  { id: "brand", label: "Brand" },
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing & Radius" },
  { id: "buttons", label: "Buttons" },
  { id: "inputs", label: "Inputs" },
  { id: "status", label: "Status System" },
  { id: "badges", label: "Badges & Tags" },
  { id: "cards", label: "Cards" },
  { id: "modals", label: "Modals & Toasts" },
  { id: "menus", label: "Menus & Popovers" },
  { id: "loading", label: "Loading States" },
  { id: "empty", label: "Empty States" },
  { id: "animations", label: "Animations" },
  { id: "textures", label: "Textures & Effects" },
  { id: "icons", label: "Icon System" },
  { id: "shadows", label: "Shadows & Elevation" },
];

/* ── MAIN PAGE ────────────────────────────────────────── */

export default function StyleGuidePage() {
  const [activeSection, setActiveSection] = useState("brand");
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoToastVisible, setDemoToastVisible] = useState(false);
  const [demoToggle, setDemoToggle] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  function scrollTo(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex min-h-screen bg-[#050505]">
      {/* ── Sidebar Nav ── */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-white/[0.05] bg-[#050505] px-4 py-6">
        <div className="mb-8">
          <h1 className="text-[15px] font-semibold tracking-tight text-white">iWorkr</h1>
          <p className="text-[11px] text-zinc-600">Style & Brand Guide</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-[12px] transition-all duration-150 ${
                activeSection === s.id
                  ? "bg-white/[0.05] text-white font-medium"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t border-white/[0.05]">
          <a href="/dashboard" className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
            <ArrowRight size={10} className="rotate-180" /> Back to app
          </a>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main ref={mainRef} className="ml-56 flex-1 px-12 py-12 max-w-4xl">

        {/* ══════════════════════════════════════════════════ */}
        {/* BRAND IDENTITY */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="brand" label="01" title="Brand Identity" description="The visual DNA of iWorkr — the Field Operating System." />

        <GlassCard className="p-6 mb-6">
          <div className="flex items-start gap-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white">
              <span className="text-lg font-bold text-black">iW</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white tracking-tight">iWorkr</h3>
              <p className="text-[13px] text-zinc-500 mt-1">The Field Operating System</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-400">Premium</span>
                <span className="rounded-full bg-zinc-500/10 border border-zinc-500/20 px-3 py-1 text-[10px] font-semibold text-zinc-400">Minimal</span>
                <span className="rounded-full bg-zinc-500/10 border border-zinc-500/20 px-3 py-1 text-[10px] font-semibold text-zinc-400">Keyboard-first</span>
                <span className="rounded-full bg-zinc-500/10 border border-zinc-500/20 px-3 py-1 text-[10px] font-semibold text-zinc-400">Dark by Default</span>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase mb-2">Design System</p>
            <p className="text-[14px] font-medium text-white">&quot;Obsidian&quot; / Stealth Mode</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase mb-2">Inspiration</p>
            <p className="text-[14px] font-medium text-white">Linear, Vercel, Raycast</p>
          </div>
        </div>

        <div className="rounded-lg border border-rose-500/10 bg-rose-500/[0.03] p-4 mb-16">
          <p className="text-[11px] font-semibold text-rose-400 mb-1">Anti-patterns</p>
          <p className="text-[12px] text-zinc-500">Never cluttered. Never neon-overloaded. Never playful/bubbly. Never use color for decoration. Never exceed 3 levels of card nesting.</p>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* COLORS */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="colors" label="02" title="Color System" description="Monochrome + one accent. Signal Green for focus, zinc for everything else." />

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Brand Colors</p>
        <ShowcaseRow>
          <ColorSwatch color="#10B981" label="Signal Green" hex="#10B981" />
          <ColorSwatch color="#059669" label="Green Dark" hex="#059669" />
          <ColorSwatch color="rgba(16,185,129,0.4)" label="Green Glow" hex="rgba(16,185,129,0.4)" />
          <ColorSwatch color="rgba(16,185,129,0.15)" label="Green Dim" hex="rgba(16,185,129,0.15)" />
        </ShowcaseRow>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Surface Layers (Dark)</p>
        <ShowcaseRow>
          <ColorSwatch color="#050505" label="Void / BG" hex="#050505" border />
          <ColorSwatch color="#0A0A0A" label="Surface 1" hex="#0A0A0A" border />
          <ColorSwatch color="#141414" label="Surface 2" hex="#141414" border />
          <ColorSwatch color="rgba(255,255,255,0.02)" label="Card BG" hex="white/2%" border />
          <ColorSwatch color="rgba(255,255,255,0.04)" label="Subtle" hex="white/4%" border />
          <ColorSwatch color="rgba(255,255,255,0.06)" label="Subtle Hover" hex="white/6%" border />
        </ShowcaseRow>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Text Colors</p>
        <div className="flex flex-wrap gap-6 mb-8">
          <div><p className="text-[16px] text-[#ededed]">Primary</p><span className="font-mono text-[9px] text-zinc-600">#EDEDED</span></div>
          <div><p className="text-[16px] text-[#a1a1aa]">Body</p><span className="font-mono text-[9px] text-zinc-600">#A1A1AA</span></div>
          <div><p className="text-[16px] text-[#71717a]">Muted</p><span className="font-mono text-[9px] text-zinc-600">#71717A</span></div>
          <div><p className="text-[16px] text-[#52525b]">Dim</p><span className="font-mono text-[9px] text-zinc-600">#52525B</span></div>
        </div>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Semantic Status Colors</p>
        <ShowcaseRow>
          <ColorSwatch color="#10B981" label="Success" hex="emerald-500" />
          <ColorSwatch color="#F59E0B" label="Warning" hex="amber-500" />
          <ColorSwatch color="#F43F5E" label="Danger" hex="rose-500" />
          <ColorSwatch color="#38BDF8" label="Info" hex="sky-400" />
          <ColorSwatch color="#8B5CF6" label="Violet" hex="violet-500" />
          <ColorSwatch color="#3B82F6" label="Blue" hex="blue-500" />
          <ColorSwatch color="#6366F1" label="AI/Indigo" hex="indigo-500" />
          <ColorSwatch color="#71717A" label="Neutral" hex="zinc-500" />
        </ShowcaseRow>

        <div className="mb-16" />

        {/* ══════════════════════════════════════════════════ */}
        {/* TYPOGRAPHY */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="typography" label="03" title="Typography" description="Inter for UI, JetBrains Mono for data. Tight tracking on headings." />

        <div className="space-y-6 mb-8">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5 space-y-5">
            <div><p className="text-[9px] text-zinc-600 mb-1">Page Title — 24px / Semibold / Tight</p><p className="text-2xl font-semibold tracking-tight text-white">The Field Operating System</p></div>
            <div><p className="text-[9px] text-zinc-600 mb-1">Section Title — 20px / Semibold / Tight</p><p className="text-xl font-semibold tracking-tight text-white">Job Pipeline Overview</p></div>
            <div><p className="text-[9px] text-zinc-600 mb-1">Card Heading — 17px / Semibold / Tight</p><p className="text-[17px] font-semibold tracking-tight text-white">Active Jobs</p></div>
            <div><p className="text-[9px] text-zinc-600 mb-1">Subheading — 14px / Medium</p><p className="text-[14px] font-medium text-white">Recent Activity</p></div>
            <div><p className="text-[9px] text-zinc-600 mb-1">Body — 13px / Regular / zinc-400</p><p className="text-[13px] text-zinc-400">Service scheduled for Tuesday at 9:30 AM. Technician assigned: Mark Reynolds.</p></div>
            <div><p className="text-[9px] text-zinc-600 mb-1">Small — 12px / Regular / zinc-500</p><p className="text-[12px] text-zinc-500">Last updated 3 minutes ago</p></div>
            <div><p className="text-[9px] text-zinc-600 mb-1">Label / Overline — 9px / Bold / Widest / Uppercase</p><p className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">Section Label</p></div>
            <div><p className="text-[9px] text-zinc-600 mb-1">Mono — 12px / JetBrains Mono</p><p className="font-mono text-[12px] text-zinc-400">JOB-2847 · $1,249.00 · 14:32:07</p></div>
            <div><p className="text-[9px] text-zinc-600 mb-1">Kbd — 9px / Mono / Border</p><div className="flex gap-1.5"><kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">⌘</kbd><kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">K</kbd></div></div>
          </div>
        </div>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-3">Landing Page Scale</p>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-6 mb-16 space-y-4">
          <p className="text-5xl font-semibold tracking-tighter text-white">Hero Headline</p>
          <p className="text-3xl font-medium tracking-tight text-white">Section Title</p>
          <p className="font-mono text-xs tracking-widest text-zinc-500 uppercase">Section Overline</p>
          <p className="text-lg leading-relaxed text-zinc-400">Body paragraph text for landing page sections with a comfortable leading for readability.</p>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* SPACING & RADIUS */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="spacing" label="04" title="Spacing & Border Radius" description="Consistent 4px base grid. Strict radius scale." />

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Spacing Scale</p>
        <div className="flex flex-wrap items-end gap-3 mb-8">
          {[4, 8, 12, 16, 24, 32, 48, 64].map((px) => (
            <div key={px} className="flex flex-col items-center gap-1.5">
              <div className="bg-emerald-500/20 border border-emerald-500/30" style={{ width: px, height: px }} />
              <span className="font-mono text-[9px] text-zinc-600">{px}</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Border Radius Scale</p>
        <div className="flex flex-wrap items-center gap-4 mb-16">
          {[
            { r: 4, label: "xs" }, { r: 6, label: "sm" }, { r: 8, label: "md" },
            { r: 12, label: "lg" }, { r: 16, label: "xl" }, { r: 9999, label: "full" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1.5">
              <div className="h-12 w-12 border border-emerald-500/30 bg-emerald-500/10" style={{ borderRadius: item.r }} />
              <span className="font-mono text-[9px] text-zinc-600">{item.label} · {item.r === 9999 ? "full" : `${item.r}px`}</span>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* BUTTONS */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="buttons" label="05" title="Button System" description="SpotlightButton for CTAs. ObsidianButton for modals. Micro-interaction on press." />

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">SpotlightButton — Variants</p>
        <ShowcaseRow>
          <SpotlightButton variant="primary" size="md">Primary</SpotlightButton>
          <SpotlightButton variant="secondary" size="md">Secondary</SpotlightButton>
          <SpotlightButton variant="ghost" size="md">Ghost</SpotlightButton>
        </ShowcaseRow>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">SpotlightButton — Sizes</p>
        <ShowcaseRow>
          <SpotlightButton variant="primary" size="sm">Small</SpotlightButton>
          <SpotlightButton variant="primary" size="md">Medium</SpotlightButton>
          <SpotlightButton variant="primary" size="lg">Large</SpotlightButton>
        </ShowcaseRow>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">SpotlightButton — With Icons</p>
        <ShowcaseRow>
          <SpotlightButton variant="primary" size="md"><Plus size={14} /> New Job</SpotlightButton>
          <SpotlightButton variant="secondary" size="md"><Download size={14} /> Export</SpotlightButton>
          <SpotlightButton variant="ghost" size="sm"><Settings size={14} /> Settings</SpotlightButton>
        </ShowcaseRow>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Obsidian Buttons (Modal Pattern)</p>
        <ShowcaseRow>
          <button className="rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98]">Primary</button>
          <button className="rounded-xl bg-transparent px-4 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">Ghost</button>
          <button className="rounded-xl border border-rose-500/20 bg-transparent px-4 py-2 text-[13px] font-medium text-rose-500 transition-colors hover:bg-rose-500/10">Danger</button>
          <button className="rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-black opacity-50 cursor-not-allowed">Disabled</button>
        </ShowcaseRow>

        <CodeBlock code={`<SpotlightButton variant="primary" size="md">
  <Plus size={14} /> New Job
</SpotlightButton>

// Modal buttons
<button className={obsidianButtonPrimary}>Save</button>
<button className={obsidianButtonGhost}>Cancel</button>
<button className={obsidianButtonDanger}>Delete</button>`} />

        <div className="mb-16" />

        {/* ══════════════════════════════════════════════════ */}
        {/* INPUTS */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="inputs" label="06" title="Input & Form Elements" description="Minimal inputs. Transparent by default, border on focus." />

        <div className="max-w-md space-y-4 mb-8">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Standard Input</label>
            <input className="w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[rgba(255,255,255,0.15)] focus:bg-[rgba(255,255,255,0.02)] transition-all" placeholder="Enter job title..." />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Search Input</label>
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-transparent px-3 py-2">
              <Search size={14} className="text-zinc-600" />
              <input className="flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600" placeholder="Search jobs..." />
              <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">⌘K</kbd>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Textarea</label>
            <textarea className="w-full resize-none rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-[13px] text-zinc-400 outline-none placeholder:text-zinc-600 focus:border-[rgba(255,255,255,0.15)] transition-all" rows={3} placeholder="Add a description..." />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Toggle</label>
            <button
              onClick={() => setDemoToggle(!demoToggle)}
              className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${demoToggle ? "bg-emerald-500" : "bg-zinc-700"}`}
            >
              <motion.div
                animate={{ x: demoToggle ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>
        </div>

        <div className="mb-16" />

        {/* ══════════════════════════════════════════════════ */}
        {/* STATUS SYSTEM */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="status" label="07" title="Status System" description="Ghost-tint pills: 10% bg + colored text + 20% border. 13 job states." />

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Status Pills</p>
        <ShowcaseRow>
          {["urgent", "backlog", "todo", "scheduled", "en_route", "on_site", "in_progress", "done", "completed", "invoiced", "on_hold", "archived", "cancelled"].map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </ShowcaseRow>

        <CodeBlock code={`<StatusPill status="scheduled" />
<StatusPill status="in_progress" />
<StatusPill status="completed" />

// Ghost-tint formula:
// bg-{color}-500/10 text-{color}-400 border border-{color}-500/20`} />

        <div className="mb-16" />

        {/* ══════════════════════════════════════════════════ */}
        {/* BADGES & TAGS */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="badges" label="08" title="Badges & Tags" description="Badge for announcements, ProBadge for upgrade indicators, tags for metadata." />

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Badge Component</p>
        <ShowcaseRow>
          <Badge><Sparkles size={12} /> New feature</Badge>
          <Badge glow><Zap size={12} /> Upgraded</Badge>
          <Badge><Bot size={12} /> AI powered</Badge>
        </ShowcaseRow>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Pro Badge & Lock</p>
        <ShowcaseRow>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold text-amber-400"><Crown size={8} /> PRO</span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/10 px-1.5 py-px text-[8px] font-semibold text-amber-400">PRO</span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400/10"><Lock size={8} className="text-amber-400" /></span>
        </ShowcaseRow>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Tags & Labels</p>
        <ShowcaseRow>
          <span className="rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[10px] text-zinc-500">Plumbing</span>
          <span className="rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[10px] text-zinc-500">HVAC</span>
          <span className="rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[10px] text-zinc-500">Emergency</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.03] px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500">STARTER</span>
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500/15 px-1 font-mono text-[9px] font-medium text-rose-400">3</span>
          <span className="rounded-full bg-[rgba(0,230,118,0.12)] px-1.5 py-0.5 text-[9px] font-medium text-[#00E676]">NEW</span>
        </ShowcaseRow>

        <div className="mb-16" />

        {/* ══════════════════════════════════════════════════ */}
        {/* CARDS */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="cards" label="09" title="Card System" description="GlassCard with cursor spotlight. WidgetShell for dashboard. Standard cards for content." />

        <div className="grid grid-cols-2 gap-4 mb-6">
          <GlassCard className="p-5">
            <p className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase mb-2">GlassCard</p>
            <p className="text-[14px] font-medium text-white mb-1">Cursor Spotlight</p>
            <p className="text-[12px] text-zinc-500">Hover to see the radial spotlight follow your cursor with spring physics.</p>
          </GlassCard>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-all hover:border-white/10">
            <p className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase mb-2">Standard Card</p>
            <p className="text-[14px] font-medium text-white mb-1">Simple Container</p>
            <p className="text-[12px] text-zinc-500">Border + inset bevel. Border brightens on hover.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 p-5 transition-all hover:border-white/10 mb-6" style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.05)", background: "radial-gradient(120% 150% at 50% -20%, rgba(16,185,129,0.04) 0%, transparent 50%), #09090b" }}>
          <p className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase mb-2">Widget Shell</p>
          <p className="text-[14px] font-medium text-white mb-1">Dashboard Widget</p>
          <p className="text-[12px] text-zinc-500">Green light cone from top + widget-glass surface + noise overlay. Used in the bento dashboard grid.</p>
        </div>

        <div className="mb-16" />

        {/* ══════════════════════════════════════════════════ */}
        {/* MODALS & TOASTS */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="modals" label="10" title="Modals & Toasts" description="ObsidianModal for dialogs. ActionToast for confirmations." />

        <ShowcaseRow label="Interactive Demos">
          <button onClick={() => setDemoModalOpen(true)} className="rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98]">Open Modal</button>
          <button onClick={() => { setDemoToastVisible(true); setTimeout(() => setDemoToastVisible(false), 3000); }} className="rounded-xl border border-white/[0.08] bg-transparent px-4 py-2 text-[13px] font-medium text-zinc-300 transition-colors hover:bg-white/5">Show Toast</button>
        </ShowcaseRow>

        {/* Demo Modal */}
        <AnimatePresence>
          {demoModalOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setDemoModalOpen(false)} />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.15, ease: "easeOut" }} className="w-full max-w-md overflow-hidden rounded-2xl border border-white/5 bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="p-8">
                    <div className="flex items-start justify-between gap-4 pb-6">
                      <div>
                        <h3 className="font-display text-[17px] font-semibold tracking-tight text-white">ObsidianModal</h3>
                        <p className="mt-0.5 text-[12px] text-zinc-500">This is the standard modal pattern</p>
                      </div>
                      <button onClick={() => setDemoModalOpen(false)} className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><X size={16} /></button>
                    </div>
                    <div className="space-y-4">
                      <div><label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Job Title</label><input className="w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[rgba(255,255,255,0.15)] transition-all" placeholder="e.g. Hot water system install" /></div>
                      <div><label className="mb-1.5 block text-[11px] font-medium text-zinc-500">Description</label><textarea className="w-full resize-none rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-[13px] text-zinc-400 outline-none placeholder:text-zinc-600 focus:border-[rgba(255,255,255,0.15)] transition-all" rows={3} placeholder="Describe the job..." /></div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-6">
                      <button onClick={() => setDemoModalOpen(false)} className="rounded-xl bg-transparent px-4 py-2 text-[13px] font-medium text-zinc-400 hover:bg-white/5 hover:text-white">Cancel</button>
                      <button onClick={() => setDemoModalOpen(false)} className="rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-black hover:bg-zinc-200 active:scale-[0.98]">Create Job</button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

        {/* Demo Toast */}
        <AnimatePresence>
          {demoToastVisible && (
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }} className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/15 bg-[#0A0A0A]/95 px-4 py-2.5 shadow-lg backdrop-blur-md">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-[13px] text-zinc-200">Job created successfully</span>
                <button className="ml-2 text-[12px] font-medium text-zinc-500 hover:text-white">Undo</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-4" />
        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-3">Toast Variants</p>
        <div className="space-y-2 mb-16">
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/15 bg-[#0A0A0A] px-4 py-2.5"><CheckCircle2 size={14} className="text-emerald-400" /><span className="text-[13px] text-zinc-200">Success toast</span></div>
          <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/15 bg-[#0A0A0A] px-4 py-2.5"><AlertCircle size={14} className="text-rose-400" /><span className="text-[13px] text-zinc-200">Error toast</span></div>
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-[#0A0A0A] px-4 py-2.5"><CheckCircle2 size={14} className="text-zinc-400" /><span className="text-[13px] text-zinc-200">Info toast</span></div>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* MENUS & POPOVERS */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="menus" label="11" title="Menus & Popovers" description="Context menus, dropdown selects, command palette styling." />

        <div className="grid grid-cols-2 gap-4 mb-16">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-3">Context Menu</p>
            <div className="w-52 overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.8)]">
              {[
                { icon: <Eye size={12} />, label: "View details", shortcut: "Enter" },
                { icon: <Search size={12} />, label: "Edit job", shortcut: "E" },
                { icon: <Copy size={12} />, label: "Duplicate", shortcut: "⌘D" },
                { divider: true },
                { icon: <X size={12} />, label: "Delete", shortcut: "⌫", danger: true },
              ].map((item, i) =>
                "divider" in item ? (
                  <div key={i} className="my-1 h-px bg-white/[0.08]" />
                ) : (
                  <div key={i} className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] ${item.danger ? "text-red-400 hover:bg-red-500/10" : "text-zinc-400 hover:bg-white/[0.04]"}`}>
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    <span className="font-mono text-[10px] text-zinc-700">{item.shortcut}</span>
                  </div>
                )
              )}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-3">Dropdown / Popover</p>
            <div className="w-52 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-white/[0.06] mb-1">
                <Search size={12} className="text-zinc-600" />
                <span className="text-[12px] text-zinc-600">Search...</span>
              </div>
              {["Scheduled", "In Progress", "Completed", "On Hold"].map((item, i) => (
                <div key={item} className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] ${i === 1 ? "bg-white/[0.06] text-zinc-200" : "text-zinc-400 hover:bg-white/[0.04]"}`}>
                  {i === 1 && <Check size={12} className="text-emerald-500" />}
                  {i !== 1 && <span className="w-3" />}
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* LOADING */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="loading" label="12" title="Loading States" description="Shimmer skeletons for every shape. Spinner for actions." />

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="space-y-4">
            <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase">Shimmer Primitives</p>
            <div className="space-y-3">
              <div><span className="text-[10px] text-zinc-600 block mb-1">Text (Shimmer)</span><Shimmer className="h-3 w-32" /></div>
              <div><span className="text-[10px] text-zinc-600 block mb-1">Avatar (ShimmerCircle)</span><ShimmerCircle className="h-8 w-8" /></div>
              <div><span className="text-[10px] text-zinc-600 block mb-1">Card (ShimmerBlock)</span><ShimmerBlock className="h-16 w-full" /></div>
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase">Composite</p>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
              <ShimmerTeamRow />
              <ShimmerTeamRow />
              <ShimmerTeamRow />
            </div>
            <div className="flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-zinc-500" />
              <span className="text-[12px] text-zinc-500">Spinner</span>
            </div>
          </div>
        </div>

        <div className="mb-16" />

        {/* ══════════════════════════════════════════════════ */}
        {/* EMPTY STATES */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="empty" label="13" title="Empty States" description="Zen breathing pattern: pulsing ring + breathing icon + descriptive text." />

        <div className="grid grid-cols-3 gap-4 mb-16">
          {[
            { icon: <Inbox size={20} className="text-zinc-600" />, title: "Inbox Zero", desc: "All clear. Nice work." },
            { icon: <Calendar size={20} className="text-zinc-600" />, title: "No Events", desc: "Schedule is clear today." },
            { icon: <Briefcase size={20} className="text-zinc-600" />, title: "No Jobs", desc: "Create your first job." },
          ].map((item) => (
            <div key={item.title} className="flex flex-col items-center py-10 text-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="relative mb-5">
                <div className="animate-zen-ring absolute inset-0 rounded-full border border-zinc-800" />
                <div className="animate-zen-breathe flex h-12 w-12 items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]">
                  {item.icon}
                </div>
              </div>
              <h3 className="text-[13px] font-medium text-zinc-300">{item.title}</h3>
              <p className="mt-1 text-[11px] text-zinc-600">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* ANIMATIONS */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="animations" label="14" title="Animation System" description="Three easing curves. Framer Motion for JS, CSS keyframes for pure CSS." />

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Easing Curves</p>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { name: "Ease Out Expo", curve: "cubic-bezier(0.16, 1, 0.3, 1)", desc: "Default. Page transitions, modals.", css: "--ease-out-expo" },
            { name: "Snappy", curve: "cubic-bezier(0.2, 0.8, 0.2, 1)", desc: "Buttons, hover effects, grid.", css: "--ease-snappy" },
            { name: "Spring", curve: "cubic-bezier(0.175, 0.885, 0.32, 1.275)", desc: "Celebrations, overshoot.", css: "--ease-spring" },
          ].map((easing) => (
            <div key={easing.name} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[13px] font-medium text-white">{easing.name}</p>
              <p className="font-mono text-[9px] text-emerald-500/60 mt-1">{easing.css}</p>
              <p className="text-[11px] text-zinc-500 mt-2">{easing.desc}</p>
              <p className="font-mono text-[9px] text-zinc-600 mt-1">{easing.curve}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">CSS Keyframe Demos</p>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { name: "Shimmer", el: <div className="h-3 w-20 rounded bg-zinc-800/80 relative overflow-hidden"><div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-zinc-700/30 to-transparent" /></div> },
            { name: "Zen Breathe", el: <div className="animate-zen-breathe h-6 w-6 rounded-lg border border-white/10 bg-white/[0.03]" /> },
            { name: "Pulse Dot", el: <div className="animate-pulse-dot h-3 w-3 rounded-full bg-emerald-500" /> },
            { name: "Orbit", el: <div className="relative h-8 w-8"><div className="animate-orbit absolute inset-0 rounded-full border border-zinc-700" /><div className="absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-emerald-500" /></div> },
            { name: "Radar Sweep", el: <div className="animate-radar-sweep h-6 w-6 rounded-full border-t-2 border-emerald-500/50" /> },
            { name: "Backlog Idle", el: <div className="animate-backlog-idle h-4 w-8 rounded bg-zinc-700" /> },
            { name: "Spinner", el: <Loader2 size={18} className="animate-spin text-zinc-400" /> },
            { name: "Typing Dots", el: <div className="flex gap-1">{[0, 1, 2].map((i) => <div key={i} className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-zinc-500" style={{ animationDelay: `${i * 0.2}s` }} />)}</div> },
          ].map((anim) => (
            <div key={anim.name} className="flex flex-col items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex h-10 items-center justify-center">{anim.el}</div>
              <span className="text-[10px] text-zinc-500">{anim.name}</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Framer Motion Patterns</p>
        <div className="grid grid-cols-2 gap-3 mb-16">
          {[
            { name: "FadeIn (Scroll)", code: "initial={{ opacity: 0, y: 20 }}\nanimate={{ opacity: 1, y: 0 }}\n{ duration: 0.5, ease: [0.16,1,0.3,1] }" },
            { name: "Modal Scale-In", code: "initial={{ opacity: 0, scale: 0.95 }}\nanimate={{ opacity: 1, scale: 1 }}\n{ duration: 0.15, ease: 'easeOut' }" },
            { name: "Spring Panel", code: "initial={{ x: '100%' }}\nanimate={{ x: 0 }}\n{ type: 'spring', stiffness: 400, damping: 36 }" },
            { name: "Toast", code: "initial={{ opacity: 0, y: 12, scale: 0.98 }}\nanimate={{ opacity: 1, y: 0, scale: 1 }}\n{ duration: 0.15, ease: [0.16,1,0.3,1] }" },
            { name: "Stagger List", code: "parent: { staggerChildren: 0.06 }\nchild: initial={{ opacity: 0, y: 12 }}\nvisible={{ opacity: 1, y: 0 }}" },
            { name: "Cursor Spotlight", code: "useSpring(mouseX, { stiffness: 300, damping: 30 })\nradial-gradient(350px circle at ...)" },
          ].map((p) => (
            <div key={p.name} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[12px] font-medium text-white mb-2">{p.name}</p>
              <pre className="text-[10px] leading-relaxed text-zinc-500 font-mono whitespace-pre-wrap">{p.code}</pre>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* TEXTURES */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="textures" label="15" title="Textures & Effects" description="Noise grain, radial glows, grid patterns, backdrop blur, diagonal stripes." />

        <div className="grid grid-cols-3 gap-4 mb-16">
          <div className="relative h-32 overflow-hidden rounded-xl border border-white/[0.06] bg-[#050505]">
            <div className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
            <div className="flex h-full items-center justify-center"><span className="text-[11px] text-zinc-500">Noise Grain</span></div>
          </div>
          <div className="relative h-32 overflow-hidden rounded-xl border border-white/[0.06] bg-[#050505]">
            <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(16,185,129,0.08) 0%, transparent 60%)" }} />
            <div className="flex h-full items-center justify-center"><span className="text-[11px] text-zinc-500">Radial Glow</span></div>
          </div>
          <div className="relative h-32 overflow-hidden rounded-xl border border-white/[0.06] bg-[#050505]">
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="flex h-full items-center justify-center"><span className="text-[11px] text-zinc-500">Line Grid</span></div>
          </div>
          <div className="relative h-32 overflow-hidden rounded-xl border border-white/[0.06] bg-[#050505]">
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
            <div className="flex h-full items-center justify-center"><span className="text-[11px] text-zinc-500">Dot Grid</span></div>
          </div>
          <div className="relative h-32 overflow-hidden rounded-xl border border-white/[0.06] bg-[#050505]">
            <div className="pointer-events-none absolute inset-0 backdrop-blur-md bg-white/[0.03]" />
            <div className="flex h-full items-center justify-center relative z-10"><span className="text-[11px] text-zinc-400">Backdrop Blur</span></div>
          </div>
          <div className="relative h-32 overflow-hidden rounded-xl border border-white/[0.06] bg-[#050505]">
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(244,63,94,0.06) 4px, rgba(244,63,94,0.06) 5px)" }} />
            <div className="flex h-full items-center justify-center"><span className="text-[11px] text-zinc-500">Urgent Stripe</span></div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* ICONS */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="icons" label="16" title="Icon System" description="Lucide React. 120+ icons. 11 size levels from 8px to 32px." />

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Top Icons (Lucide React)</p>
        <div className="flex flex-wrap gap-3 mb-8">
          {[
            { icon: <X size={16} />, name: "X" }, { icon: <ArrowRight size={16} />, name: "ArrowRight" },
            { icon: <Check size={16} />, name: "Check" }, { icon: <AlertTriangle size={16} />, name: "AlertTriangle" },
            { icon: <Loader2 size={16} />, name: "Loader2" }, { icon: <Plus size={16} />, name: "Plus" },
            { icon: <Search size={16} />, name: "Search" }, { icon: <Lock size={16} />, name: "Lock" },
            { icon: <MapPin size={16} />, name: "MapPin" }, { icon: <Sparkles size={16} />, name: "Sparkles" },
            { icon: <Users size={16} />, name: "Users" }, { icon: <Send size={16} />, name: "Send" },
            { icon: <Crown size={16} />, name: "Crown" }, { icon: <Download size={16} />, name: "Download" },
            { icon: <Inbox size={16} />, name: "Inbox" }, { icon: <Calendar size={16} />, name: "Calendar" },
            { icon: <Briefcase size={16} />, name: "Briefcase" }, { icon: <Banknote size={16} />, name: "Banknote" },
            { icon: <LayoutDashboard size={16} />, name: "Dashboard" }, { icon: <Settings size={16} />, name: "Settings" },
            { icon: <Zap size={16} />, name: "Zap" }, { icon: <Shield size={16} />, name: "Shield" },
            { icon: <CreditCard size={16} />, name: "CreditCard" }, { icon: <Bot size={16} />, name: "Bot" },
          ].map((item) => (
            <div key={item.name} className="flex flex-col items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 w-[72px] hover:border-white/10 transition-colors">
              <div className="text-zinc-400">{item.icon}</div>
              <span className="text-[8px] text-zinc-600 truncate w-full text-center">{item.name}</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] font-bold tracking-widest text-zinc-600 uppercase mb-4">Icon Size Scale</p>
        <div className="flex items-end gap-5 mb-16">
          {[8, 10, 12, 14, 16, 18, 20, 24, 32].map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <Sparkles size={s} className="text-zinc-400" />
              <span className="font-mono text-[9px] text-zinc-600">{s}px</span>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* SHADOWS */}
        {/* ══════════════════════════════════════════════════ */}
        <SectionAnchor id="shadows" label="17" title="Shadows & Elevation" description="Inset bevel for depth. Deep floats for overlays. Emerald glow for focus." />

        <div className="grid grid-cols-2 gap-4 mb-16">
          {[
            { name: "Inset Bevel", style: { boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.05)" }, bg: "bg-zinc-900" },
            { name: "Dropdown", style: { boxShadow: "0 16px 48px -8px rgba(0,0,0,0.6)" }, bg: "bg-zinc-900" },
            { name: "Brand Glow", style: { boxShadow: "0 0 20px rgba(16,185,129,0.3)" }, bg: "bg-zinc-900" },
            { name: "Focus Ring", style: { boxShadow: "0 0 0 2px #050505, 0 0 0 4px rgba(16,185,129,0.4)" }, bg: "bg-zinc-900" },
            { name: "Brand Subtle", style: { boxShadow: "0 0 12px -5px rgba(16,185,129,0.2)" }, bg: "bg-zinc-900" },
            { name: "Context Menu", style: { boxShadow: "0 16px 48px -8px rgba(0,0,0,0.8)" }, bg: "bg-zinc-900" },
          ].map((s) => (
            <div key={s.name} className="flex items-center gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className={`h-12 w-12 rounded-lg ${s.bg}`} style={s.style} />
              <div>
                <p className="text-[12px] font-medium text-white">{s.name}</p>
                <p className="font-mono text-[9px] text-zinc-600 mt-0.5 max-w-[200px] break-all">{s.style.boxShadow}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.05] pt-8 mt-16">
          <p className="text-[11px] text-zinc-600">iWorkr Style & Brand Guide · v3.0 · March 2026</p>
          <p className="text-[10px] text-zinc-700 mt-1">Source of truth: <code className="font-mono text-emerald-500/50">src/app/globals.css</code> + <code className="font-mono text-emerald-500/50">docs/STYLE_GUIDE.md</code></p>
        </div>

        <div className="h-24" />
      </main>
    </div>
  );
}
