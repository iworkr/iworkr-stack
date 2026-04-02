/**
 * @component components/site-editor/blocks/index.ts
 * @status STABLE
 * @description Loom site builder — index
 * @lastReview 2026-03-28
 */
import type { SiteBlockType, SiteBlockRendererProps } from "../types";
import { EditorHero } from "./EditorHero";
import { EditorFeatureGrid } from "./EditorFeatureGrid";
import { EditorServicesGrid } from "./EditorServicesGrid";
import { EditorAboutSection } from "./EditorAboutSection";
import { EditorTeamSection } from "./EditorTeamSection";
import { EditorTestimonials } from "./EditorTestimonials";
import { EditorTrustBadges } from "./EditorTrustBadges";
import { EditorStatsCounter } from "./EditorStatsCounter";
import { EditorLeadCaptureForm } from "./EditorLeadCaptureForm";
import { EditorEmbedDaedalusForm } from "./EditorEmbedDaedalusForm";
import { EditorBookingWidget } from "./EditorBookingWidget";
import { EditorCtaBanner } from "./EditorCtaBanner";
import { EditorTextSection } from "./EditorTextSection";
import { EditorImageGallery } from "./EditorImageGallery";
import { EditorVideoEmbed } from "./EditorVideoEmbed";
import { EditorFaqAccordion } from "./EditorFaqAccordion";
import { EditorSiteHeader } from "./EditorSiteHeader";
import { EditorSiteFooter } from "./EditorSiteFooter";
import { EditorSpacer } from "./EditorSpacer";
import { EditorDivider } from "./EditorDivider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditorBlock = React.ComponentType<SiteBlockRendererProps<any>>;

export const EDITOR_BLOCK_REGISTRY: Record<SiteBlockType, AnyEditorBlock> = {
  hero: EditorHero,
  feature_grid: EditorFeatureGrid,
  services_grid: EditorServicesGrid,
  about_section: EditorAboutSection,
  team_section: EditorTeamSection,
  testimonials: EditorTestimonials,
  trust_badges: EditorTrustBadges,
  stats_counter: EditorStatsCounter,
  lead_capture_form: EditorLeadCaptureForm,
  embed_daedalus_form: EditorEmbedDaedalusForm,
  booking_widget: EditorBookingWidget,
  cta_banner: EditorCtaBanner,
  text_section: EditorTextSection,
  image_gallery: EditorImageGallery,
  video_embed: EditorVideoEmbed,
  faq_accordion: EditorFaqAccordion,
  site_header: EditorSiteHeader,
  site_footer: EditorSiteFooter,
  spacer: EditorSpacer,
  divider: EditorDivider,
};
