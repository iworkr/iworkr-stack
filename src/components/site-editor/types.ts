/**
 * @component components/site-editor/types.ts
 * @status STABLE
 * @description Loom site builder — types
 * @lastReview 2026-03-28
 */
/* ─── Project Loom-Space: Site Editor Type System ──────────────────────────── */

export type SiteBlockType =
  | "hero"
  | "feature_grid"
  | "services_grid"
  | "about_section"
  | "team_section"
  | "testimonials"
  | "trust_badges"
  | "stats_counter"
  | "lead_capture_form"
  | "embed_daedalus_form"
  | "booking_widget"
  | "cta_banner"
  | "text_section"
  | "image_gallery"
  | "video_embed"
  | "faq_accordion"
  | "site_header"
  | "site_footer"
  | "spacer"
  | "divider";

/* ─── Per-block content interfaces ─────────────────────────────────────────── */

export interface HeroContent {
  headline: string;
  subheadline: string;
  backgroundType: "image" | "video" | "gradient";
  backgroundUrl: string;
  gradientFrom: string;
  gradientTo: string;
  ctaLabel: string;
  ctaUrl: string;
  ctaStyle: "solid" | "outline" | "ghost";
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  alignment: "left" | "center" | "right";
  overlayOpacity: number;
}

export interface FeatureGridContent {
  heading: string;
  subheading: string;
  columns: 2 | 3 | 4;
  features: { id: string; icon: string; title: string; description: string }[];
}

export interface ServicesGridContent {
  heading: string;
  services: { id: string; title: string; description: string; icon: string; imageUrl: string }[];
  columns: 2 | 3;
  showImages: boolean;
}

export interface AboutSectionContent {
  heading: string;
  body: string;
  imageUrl: string;
  imagePosition: "left" | "right";
  showStats: boolean;
  stats: { id: string; value: string; label: string }[];
}

export interface TeamSectionContent {
  heading: string;
  members: { id: string; name: string; role: string; photoUrl: string; bio: string }[];
  layout: "grid" | "carousel";
}

export interface TestimonialsContent {
  heading: string;
  testimonials: { id: string; name: string; role: string; company: string; text: string; rating: number; photoUrl: string }[];
  layout: "grid" | "carousel" | "masonry";
}

export interface TrustBadgesContent {
  heading: string;
  badges: { id: string; imageUrl: string; label: string; url: string }[];
  layout: "row" | "grid";
  grayscale: boolean;
}

export interface StatsCounterContent {
  stats: { id: string; value: string; label: string; prefix: string; suffix: string }[];
  backgroundColor: string;
}

export interface LeadCaptureContent {
  widgetId: string | null;
  heading: string;
  description: string;
  fields: { name: boolean; email: boolean; phone: boolean; message: boolean; serviceType: boolean };
  serviceOptions: string[];
  submitLabel: string;
  successMessage: string;
}

export interface EmbedDaedalusFormContent {
  templateId: string | null;
  showTitle: boolean;
  heading: string;
}

export interface BookingWidgetContent {
  heading: string;
  description: string;
  enabled: boolean;
}

export interface CtaBannerContent {
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaUrl: string;
  ctaStyle: "solid" | "outline";
  backgroundColor: string;
  textColor: string;
}

export interface TextSectionContent {
  heading: string;
  body: string;
  alignment: "left" | "center" | "right";
  maxWidth: "narrow" | "medium" | "full";
}

export interface ImageGalleryContent {
  heading: string;
  images: { id: string; url: string; alt: string; caption: string }[];
  columns: 2 | 3 | 4;
  aspectRatio: "square" | "landscape" | "portrait";
}

export interface VideoEmbedContent {
  heading: string;
  videoUrl: string;
  autoplay: boolean;
  aspectRatio: "16:9" | "4:3" | "1:1";
}

export interface FaqAccordionContent {
  heading: string;
  faqs: { id: string; question: string; answer: string }[];
}

export interface SiteHeaderContent {
  logoUrl: string;
  showPhone: boolean;
  phone: string;
  ctaLabel: string;
  ctaUrl: string;
  navLinks: { id: string; label: string; href: string }[];
  sticky: boolean;
}

export interface SiteFooterContent {
  companyName: string;
  description: string;
  columns: { id: string; heading: string; links: { id: string; label: string; href: string }[] }[];
  socialLinks: { facebook: string; instagram: string; linkedin: string; twitter: string; youtube: string };
  showCopyright: boolean;
  copyrightText: string;
}

export interface SiteSpacerContent {
  height: number;
}

export interface SiteDividerContent {
  thickness: number;
  color: string;
  maxWidth: "full" | "medium" | "narrow";
}

/* ─── Content Map ──────────────────────────────────────────────────────────── */

export type SiteBlockContentMap = {
  hero: HeroContent;
  feature_grid: FeatureGridContent;
  services_grid: ServicesGridContent;
  about_section: AboutSectionContent;
  team_section: TeamSectionContent;
  testimonials: TestimonialsContent;
  trust_badges: TrustBadgesContent;
  stats_counter: StatsCounterContent;
  lead_capture_form: LeadCaptureContent;
  embed_daedalus_form: EmbedDaedalusFormContent;
  booking_widget: BookingWidgetContent;
  cta_banner: CtaBannerContent;
  text_section: TextSectionContent;
  image_gallery: ImageGalleryContent;
  video_embed: VideoEmbedContent;
  faq_accordion: FaqAccordionContent;
  site_header: SiteHeaderContent;
  site_footer: SiteFooterContent;
  spacer: SiteSpacerContent;
  divider: SiteDividerContent;
};

/* ─── Block Model ──────────────────────────────────────────────────────────── */

export interface SiteBlock<T extends SiteBlockType = SiteBlockType> {
  id: string;
  type: T;
  content: SiteBlockContentMap[T];
  locked?: boolean;
  deletable?: boolean;
}

/* ─── Global Styles ────────────────────────────────────────────────────────── */

export interface SiteGlobalStyles {
  primaryColor: string;
  secondaryColor: string;
  fontHeading: string;
  fontBody: string;
  buttonRadius: number;
  headerStyle: "sticky" | "static" | "transparent";
  footerStyle: "standard" | "minimal" | "centered";
}

/* ─── Site Settings ────────────────────────────────────────────────────────── */

export interface SiteSettings {
  name: string;
  subdomain: string;
  customDomain: string | null;
  isPublished: boolean;
  domainVerified: boolean;
}

/* ─── Page Model ───────────────────────────────────────────────────────────── */

export interface SitePage {
  id: string;
  slug: string;
  title: string;
  seoMetadata: { title?: string; description?: string; ogImage?: string };
  sortOrder: number;
  isDraft: boolean;
}

/* ─── Renderer Props ───────────────────────────────────────────────────────── */

export interface SiteBlockRendererProps<T extends SiteBlockType = SiteBlockType> {
  block: SiteBlock<T>;
  isActive: boolean;
  isEditing: boolean;
  globalStyles: SiteGlobalStyles;
  onContentChange: (content: Partial<SiteBlockContentMap[T]>) => void;
}

/* ─── Labels ───────────────────────────────────────────────────────────────── */

export const SITE_BLOCK_LABELS: Record<SiteBlockType, string> = {
  hero: "Hero Section",
  feature_grid: "Feature Grid",
  services_grid: "Services Grid",
  about_section: "About Section",
  team_section: "Team Section",
  testimonials: "Testimonials",
  trust_badges: "Trust Badges",
  stats_counter: "Stats Counter",
  lead_capture_form: "Lead Capture Form",
  embed_daedalus_form: "Embedded Form",
  booking_widget: "Booking Widget",
  cta_banner: "CTA Banner",
  text_section: "Text Section",
  image_gallery: "Image Gallery",
  video_embed: "Video Embed",
  faq_accordion: "FAQ Accordion",
  site_header: "Header",
  site_footer: "Footer",
  spacer: "Spacer",
  divider: "Divider",
};

/* ─── ID Generator ─────────────────────────────────────────────────────────── */

let _siteBlockCounter = 0;
export function makeSiteBlockId(): string {
  return `sblk_${Date.now()}_${(++_siteBlockCounter).toString(36)}`;
}

/* ─── postMessage Protocol ─────────────────────────────────────────────────── */

export type EditorToIframeMessage =
  | { type: "UPDATE_LAYOUT"; payload: SiteBlock[] }
  | { type: "SET_ACTIVE_BLOCK"; payload: string | null }
  | { type: "SET_EDITING_BLOCK"; payload: string | null }
  | { type: "UPDATE_GLOBAL_STYLES"; payload: SiteGlobalStyles };

export type IframeToEditorMessage =
  | { type: "BLOCK_CLICKED"; payload: string }
  | { type: "BLOCK_CONTENT_CHANGED"; payload: { blockId: string; patch: Record<string, unknown> } }
  | { type: "CANVAS_CLICKED" }
  | { type: "IFRAME_READY" };
