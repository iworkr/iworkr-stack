/**
 * @component components/site-renderer/blocks/index.ts
 * @status STABLE
 * @description Public Loom site render — index
 * @lastReview 2026-03-28
 */
import type { SiteBlockType, SiteGlobalStyles, SiteBlock } from "@/components/site-editor/types";
import { PublicHero } from "./PublicHero";
import { PublicFeatureGrid } from "./PublicFeatureGrid";
import { PublicServicesGrid } from "./PublicServicesGrid";
import { PublicAboutSection } from "./PublicAboutSection";
import { PublicTeamSection } from "./PublicTeamSection";
import { PublicTestimonials } from "./PublicTestimonials";
import { PublicTrustBadges } from "./PublicTrustBadges";
import { PublicStatsCounter } from "./PublicStatsCounter";
import { PublicLeadCaptureForm } from "./PublicLeadCaptureForm";
import { PublicEmbedDaedalusForm } from "./PublicEmbedDaedalusForm";
import { PublicBookingWidget } from "./PublicBookingWidget";
import { PublicCtaBanner } from "./PublicCtaBanner";
import { PublicTextSection } from "./PublicTextSection";
import { PublicImageGallery } from "./PublicImageGallery";
import { PublicVideoEmbed } from "./PublicVideoEmbed";
import { PublicFaqAccordion } from "./PublicFaqAccordion";
import { PublicSiteHeader } from "./PublicSiteHeader";
import { PublicSiteFooter } from "./PublicSiteFooter";
import { PublicSpacer } from "./PublicSpacer";
import { PublicDivider } from "./PublicDivider";

export interface PublicBlockProps<T extends SiteBlockType = SiteBlockType> {
  block: SiteBlock<T>;
  globalStyles: SiteGlobalStyles;
  siteName: string;
  workspaceId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPublicBlock = React.ComponentType<PublicBlockProps<any>>;

export const PUBLIC_BLOCK_REGISTRY: Record<SiteBlockType, AnyPublicBlock> = {
  hero: PublicHero,
  feature_grid: PublicFeatureGrid,
  services_grid: PublicServicesGrid,
  about_section: PublicAboutSection,
  team_section: PublicTeamSection,
  testimonials: PublicTestimonials,
  trust_badges: PublicTrustBadges,
  stats_counter: PublicStatsCounter,
  lead_capture_form: PublicLeadCaptureForm,
  embed_daedalus_form: PublicEmbedDaedalusForm,
  booking_widget: PublicBookingWidget,
  cta_banner: PublicCtaBanner,
  text_section: PublicTextSection,
  image_gallery: PublicImageGallery,
  video_embed: PublicVideoEmbed,
  faq_accordion: PublicFaqAccordion,
  site_header: PublicSiteHeader,
  site_footer: PublicSiteFooter,
  spacer: PublicSpacer,
  divider: PublicDivider,
};
