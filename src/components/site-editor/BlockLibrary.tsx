/**
 * @component components/site-editor/BlockLibrary.tsx
 * @status STABLE
 * @description Loom site builder — BlockLibrary
 * @lastReview 2026-03-28
 */
"use client";

import { useState } from "react";
import {
  Plus,
  X,
  Layout,
  Star,
  Shield,
  BarChart3,
  FileText,
  Image as ImageIcon,
  Video,
  HelpCircle,
  Navigation,
  Footprints,
  ArrowUpDown,
  Minus,
  Type,
  FormInput,
  CalendarDays,
  Megaphone,
  Users,
  Grid3X3,
  Briefcase,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SiteBlockType, SiteBlockContentMap } from "./types";
import { makeSiteBlockId } from "./types";
import { useSiteEditorStore } from "@/lib/stores/site-editor-store";

interface BlockOption {
  type: SiteBlockType;
  label: string;
  icon: React.ReactNode;
  description: string;
  defaultContent: SiteBlockContentMap[SiteBlockType];
  category: "layout" | "social" | "conversion" | "content" | "structure";
}

const BLOCK_OPTIONS: BlockOption[] = [
  {
    type: "site_header", label: "Header", icon: <Navigation size={14} />,
    description: "Site navigation bar",
    defaultContent: { logoUrl: "", showPhone: true, phone: "", ctaLabel: "Contact Us", ctaUrl: "#contact", navLinks: [{ id: makeSiteBlockId(), label: "Home", href: "/" }, { id: makeSiteBlockId(), label: "Services", href: "#services" }, { id: makeSiteBlockId(), label: "About", href: "#about" }], sticky: true },
    category: "structure",
  },
  {
    type: "hero", label: "Hero Section", icon: <Layout size={14} />,
    description: "Full-width hero with CTA",
    defaultContent: { headline: "Your Business, Online", subheadline: "Professional services you can trust", backgroundType: "gradient", backgroundUrl: "", gradientFrom: "#10B981", gradientTo: "#0D9488", ctaLabel: "Get a Quote", ctaUrl: "#contact", ctaStyle: "solid", secondaryCtaLabel: "Our Services", secondaryCtaUrl: "#services", alignment: "center", overlayOpacity: 0.5 },
    category: "layout",
  },
  {
    type: "feature_grid", label: "Feature Grid", icon: <Grid3X3 size={14} />,
    description: "Grid of feature cards",
    defaultContent: { heading: "Why Choose Us", subheading: "What makes us different", columns: 3, features: [] },
    category: "layout",
  },
  {
    type: "services_grid", label: "Services Grid", icon: <Briefcase size={14} />,
    description: "Showcase your services",
    defaultContent: { heading: "Our Services", services: [], columns: 3, showImages: true },
    category: "layout",
  },
  {
    type: "about_section", label: "About Section", icon: <Users size={14} />,
    description: "Image + text about block",
    defaultContent: { heading: "About Us", body: "", imageUrl: "", imagePosition: "right", showStats: false, stats: [] },
    category: "layout",
  },
  {
    type: "team_section", label: "Team", icon: <Users size={14} />,
    description: "Team member cards",
    defaultContent: { heading: "Meet the Team", members: [], layout: "grid" },
    category: "layout",
  },
  {
    type: "testimonials", label: "Testimonials", icon: <Star size={14} />,
    description: "Client reviews and quotes",
    defaultContent: { heading: "What Our Clients Say", testimonials: [], layout: "grid" },
    category: "social",
  },
  {
    type: "trust_badges", label: "Trust Badges", icon: <Shield size={14} />,
    description: "Certification and partner logos",
    defaultContent: { heading: "Trusted By", badges: [], layout: "row", grayscale: true },
    category: "social",
  },
  {
    type: "stats_counter", label: "Stats Counter", icon: <BarChart3 size={14} />,
    description: "Key numbers and metrics",
    defaultContent: { stats: [], backgroundColor: "" },
    category: "social",
  },
  {
    type: "lead_capture_form", label: "Lead Capture", icon: <FormInput size={14} />,
    description: "Contact form → CRM",
    defaultContent: { widgetId: null, heading: "Get in Touch", description: "Fill out the form and we'll get back to you.", fields: { name: true, email: true, phone: true, message: true, serviceType: false }, serviceOptions: [], submitLabel: "Get a Quote", successMessage: "Thanks! We'll be in touch shortly." },
    category: "conversion",
  },
  {
    type: "embed_daedalus_form", label: "Custom Form", icon: <FileText size={14} />,
    description: "Embed a Daedalus form",
    defaultContent: { templateId: null, showTitle: true, heading: "" },
    category: "conversion",
  },
  {
    type: "booking_widget", label: "Booking Widget", icon: <CalendarDays size={14} />,
    description: "Online booking (Phase 2)",
    defaultContent: { heading: "Book Online", description: "Schedule a service", enabled: true },
    category: "conversion",
  },
  {
    type: "cta_banner", label: "CTA Banner", icon: <Megaphone size={14} />,
    description: "Full-width call to action",
    defaultContent: { headline: "Ready to Get Started?", subheadline: "Contact us today for a free quote", ctaLabel: "Get Started", ctaUrl: "#contact", ctaStyle: "solid", backgroundColor: "", textColor: "#ffffff" },
    category: "conversion",
  },
  {
    type: "text_section", label: "Text Section", icon: <Type size={14} />,
    description: "Rich text content block",
    defaultContent: { heading: "", body: "", alignment: "left", maxWidth: "medium" },
    category: "content",
  },
  {
    type: "image_gallery", label: "Image Gallery", icon: <ImageIcon size={14} />,
    description: "Photo grid gallery",
    defaultContent: { heading: "Our Work", images: [], columns: 3, aspectRatio: "square" },
    category: "content",
  },
  {
    type: "video_embed", label: "Video", icon: <Video size={14} />,
    description: "YouTube or Vimeo embed",
    defaultContent: { heading: "", videoUrl: "", autoplay: false, aspectRatio: "16:9" },
    category: "content",
  },
  {
    type: "faq_accordion", label: "FAQ", icon: <HelpCircle size={14} />,
    description: "Expandable Q&A section",
    defaultContent: { heading: "Frequently Asked Questions", faqs: [] },
    category: "content",
  },
  {
    type: "site_footer", label: "Footer", icon: <Footprints size={14} />,
    description: "Site footer with links",
    defaultContent: { companyName: "", description: "", columns: [{ id: makeSiteBlockId(), heading: "Services", links: [] }, { id: makeSiteBlockId(), heading: "Company", links: [] }], socialLinks: { facebook: "", instagram: "", linkedin: "", twitter: "", youtube: "" }, showCopyright: true, copyrightText: "" },
    category: "structure",
  },
  {
    type: "spacer", label: "Spacer", icon: <ArrowUpDown size={14} />,
    description: "Vertical spacing",
    defaultContent: { height: 48 },
    category: "structure",
  },
  {
    type: "divider", label: "Divider", icon: <Minus size={14} />,
    description: "Horizontal line",
    defaultContent: { thickness: 1, color: "#e5e7eb", maxWidth: "full" },
    category: "structure",
  },
];

const CATEGORIES = [
  { id: "structure", label: "Structure" },
  { id: "layout", label: "Layout" },
  { id: "social", label: "Social Proof" },
  { id: "conversion", label: "Conversion" },
  { id: "content", label: "Content" },
];

export function SiteBlockLibrary() {
  const [open, setOpen] = useState(false);
  const addBlock = useSiteEditorStore((s) => s.addBlock);

  function handleAdd(option: BlockOption) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addBlock(option.type, option.defaultContent as any);
    setOpen(false);
  }

  return (
    <>
      <div className="flex w-12 flex-col items-center border-r border-[var(--border-base)] bg-[var(--surface-0)] py-3">
        <button
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-emerald-400"
          title="Add Block"
        >
          <Plus size={16} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="fixed left-12 top-0 z-50 h-full w-[280px] border-r border-[var(--border-base)] bg-[var(--surface-1)] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-base)]">
                <h3 className="text-sm font-semibold text-zinc-200">Block Library</h3>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-3 space-y-4">
                {CATEGORIES.map((cat) => {
                  const options = BLOCK_OPTIONS.filter((o) => o.category === cat.id);
                  if (options.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <div className="mb-2 font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
                        {cat.label}
                      </div>
                      <div className="space-y-1">
                        {options.map((opt) => (
                          <button
                            key={opt.type}
                            onClick={() => handleAdd(opt)}
                            className="flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-[var(--border-active)] hover:bg-white/[0.03]"
                          >
                            <div className="mt-0.5 shrink-0 text-zinc-500">{opt.icon}</div>
                            <div>
                              <div className="text-[11px] font-medium text-zinc-300">{opt.label}</div>
                              <div className="text-[10px] text-zinc-600">{opt.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
