/**
 * @component components/site-editor/SitePropertyPanel.tsx
 * @status STABLE
 * @description Loom site builder — SitePropertyPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { SITE_BLOCK_LABELS } from "./types";
import { GlobalStylesPanel } from "./panels/GlobalStylesPanel";
import { HeroPanel } from "./panels/HeroPanel";
import { FeatureGridPanel } from "./panels/FeatureGridPanel";
import { ServicesGridPanel } from "./panels/ServicesGridPanel";
import { AboutPanel } from "./panels/AboutPanel";
import { TeamPanel } from "./panels/TeamPanel";
import { TestimonialsPanel } from "./panels/TestimonialsPanel";
import { TrustBadgesPanel } from "./panels/TrustBadgesPanel";
import { StatsCounterPanel } from "./panels/StatsCounterPanel";
import { LeadCapturePanel } from "./panels/LeadCapturePanel";
import { EmbedDaedalusFormPanel } from "./panels/EmbedDaedalusFormPanel";
import { CtaBannerPanel } from "./panels/CtaBannerPanel";
import { TextSectionPanel } from "./panels/TextSectionPanel";
import { ImageGalleryPanel } from "./panels/ImageGalleryPanel";
import { VideoEmbedPanel } from "./panels/VideoEmbedPanel";
import { FaqAccordionPanel } from "./panels/FaqAccordionPanel";
import { HeaderPanel } from "./panels/HeaderPanel";
import { FooterPanel } from "./panels/FooterPanel";
import { SiteSpacerPanel } from "./panels/SiteSpacerPanel";
import { SiteDividerPanel } from "./panels/SiteDividerPanel";

export function SitePropertyPanel() {
  const activeBlockId = useSiteEditorStore((s) => s.activeBlockId);
  const blocks = useSiteEditorStore((s) => s.blocks);
  const activeBlock = activeBlockId ? blocks.find((b) => b.id === activeBlockId) : null;

  if (!activeBlock) {
    return (
      <div className="h-full overflow-y-auto border-l border-[var(--border-base)] bg-[var(--surface-0)] w-[320px]">
        <GlobalStylesPanel />
      </div>
    );
  }

  const label = SITE_BLOCK_LABELS[activeBlock.type] ?? activeBlock.type;

  function renderPanel() {
    if (!activeBlock) return null;
    switch (activeBlock.type) {
      case "hero": return <HeroPanel blockId={activeBlock.id} />;
      case "feature_grid": return <FeatureGridPanel blockId={activeBlock.id} />;
      case "services_grid": return <ServicesGridPanel blockId={activeBlock.id} />;
      case "about_section": return <AboutPanel blockId={activeBlock.id} />;
      case "team_section": return <TeamPanel blockId={activeBlock.id} />;
      case "testimonials": return <TestimonialsPanel blockId={activeBlock.id} />;
      case "trust_badges": return <TrustBadgesPanel blockId={activeBlock.id} />;
      case "stats_counter": return <StatsCounterPanel blockId={activeBlock.id} />;
      case "lead_capture_form": return <LeadCapturePanel blockId={activeBlock.id} />;
      case "embed_daedalus_form": return <EmbedDaedalusFormPanel blockId={activeBlock.id} />;
      case "cta_banner": return <CtaBannerPanel blockId={activeBlock.id} />;
      case "text_section": return <TextSectionPanel blockId={activeBlock.id} />;
      case "image_gallery": return <ImageGalleryPanel blockId={activeBlock.id} />;
      case "video_embed": return <VideoEmbedPanel blockId={activeBlock.id} />;
      case "faq_accordion": return <FaqAccordionPanel blockId={activeBlock.id} />;
      case "site_header": return <HeaderPanel blockId={activeBlock.id} />;
      case "site_footer": return <FooterPanel blockId={activeBlock.id} />;
      case "spacer": return <SiteSpacerPanel blockId={activeBlock.id} />;
      case "divider": return <SiteDividerPanel blockId={activeBlock.id} />;
      default: return <div className="p-4 text-xs text-zinc-500">No settings for this block</div>;
    }
  }

  return (
    <div className="h-full overflow-y-auto border-l border-[var(--border-base)] bg-[var(--surface-0)] w-[320px]">
      <div className="sticky top-0 z-10 border-b border-[var(--border-base)] bg-[var(--surface-0)] p-4">
        <div className="flex items-center gap-2">
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            {label}
          </span>
        </div>
      </div>
      {renderPanel()}
    </div>
  );
}
