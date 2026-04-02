/**
 * @component components/site-editor/themes.ts
 * @status STABLE
 * @description Loom site builder — themes
 * @lastReview 2026-03-28
 */
import type { SiteBlock, SiteGlobalStyles } from "./types";
import { makeSiteBlockId } from "./types";

export interface SiteTheme {
  id: string;
  name: string;
  description: string;
  sector: "trades" | "care";
  globalStyles: SiteGlobalStyles;
  pages: { slug: string; title: string; blocks: SiteBlock[] }[];
}

function id() { return makeSiteBlockId(); }

export const SITE_THEMES: SiteTheme[] = [
  /* ─── TRADES ─────────────────────────────────────────────────────────── */
  {
    id: "emergency-responder",
    name: "Emergency Responder",
    description: "Bold, urgency-focused. Sticky header with tap-to-call.",
    sector: "trades",
    globalStyles: {
      primaryColor: "#DC2626",
      secondaryColor: "#EA580C",
      fontHeading: "Plus Jakarta Sans",
      fontBody: "DM Sans",
      buttonRadius: 8,
      headerStyle: "sticky",
      footerStyle: "standard",
    },
    pages: [
      {
        slug: "/",
        title: "Home",
        blocks: [
          { id: id(), type: "site_header", content: { logoUrl: "", showPhone: true, phone: "1300 000 000", ctaLabel: "Emergency Call", ctaUrl: "tel:1300000000", navLinks: [{ id: id(), label: "Services", href: "#services" }, { id: id(), label: "About", href: "#about" }, { id: id(), label: "Contact", href: "#contact" }], sticky: true } },
          { id: id(), type: "hero", content: { headline: "24/7 Emergency Plumbing", subheadline: "Fast response. Licensed professionals. No call-out fee.", backgroundType: "gradient", backgroundUrl: "", gradientFrom: "#DC2626", gradientTo: "#EA580C", ctaLabel: "Call Now", ctaUrl: "tel:1300000000", ctaStyle: "solid", secondaryCtaLabel: "Request Quote", secondaryCtaUrl: "#contact", alignment: "center", overlayOpacity: 0.5 } },
          { id: id(), type: "services_grid", content: { heading: "Our Services", services: [{ id: id(), title: "Blocked Drains", description: "Fast unblocking with CCTV inspection", icon: "🔧", imageUrl: "" }, { id: id(), title: "Hot Water", description: "Repairs and installations, all brands", icon: "🔥", imageUrl: "" }, { id: id(), title: "Gas Fitting", description: "Licensed gas plumber, compliance certificates", icon: "⛽", imageUrl: "" }, { id: id(), title: "Burst Pipes", description: "Emergency response within 60 minutes", icon: "💧", imageUrl: "" }], columns: 2, showImages: false } },
          { id: id(), type: "stats_counter", content: { stats: [{ id: id(), value: "15", label: "Years Experience", prefix: "", suffix: "+" }, { id: id(), value: "10000", label: "Jobs Completed", prefix: "", suffix: "+" }, { id: id(), value: "4.9", label: "Google Rating", prefix: "", suffix: "★" }, { id: id(), value: "60", label: "Min Response", prefix: "<", suffix: "" }], backgroundColor: "#DC2626" } },
          { id: id(), type: "testimonials", content: { heading: "What Our Clients Say", testimonials: [{ id: id(), name: "Sarah M.", role: "Homeowner", company: "", text: "They arrived within 30 minutes and fixed our burst pipe. Absolutely lifesaving!", rating: 5, photoUrl: "" }, { id: id(), name: "Dave K.", role: "Property Manager", company: "", text: "Reliable, professional, and reasonably priced. Our go-to plumber.", rating: 5, photoUrl: "" }], layout: "grid" } },
          { id: id(), type: "lead_capture_form", content: { widgetId: null, heading: "Request a Quote", description: "Describe your issue and we'll get back to you ASAP.", fields: { name: true, email: true, phone: true, message: true, serviceType: true }, serviceOptions: ["Blocked Drains", "Hot Water", "Gas Fitting", "Burst Pipes", "General Plumbing"], submitLabel: "Request Quote", successMessage: "Thanks! We'll call you back within 15 minutes." } },
          { id: id(), type: "site_footer", content: { companyName: "Acme Plumbing", description: "Licensed emergency plumbing services.", columns: [{ id: id(), heading: "Services", links: [{ id: id(), label: "Blocked Drains", href: "#services" }, { id: id(), label: "Hot Water", href: "#services" }, { id: id(), label: "Gas Fitting", href: "#services" }] }, { id: id(), heading: "Company", links: [{ id: id(), label: "About Us", href: "#about" }, { id: id(), label: "Contact", href: "#contact" }] }], socialLinks: { facebook: "", instagram: "", linkedin: "", twitter: "", youtube: "" }, showCopyright: true, copyrightText: "" } },
        ] as SiteBlock[],
      },
    ],
  },
  {
    id: "premium-builder",
    name: "Premium Builder",
    description: "Dark charcoal + gold. Portfolio-style hero for high-end builders.",
    sector: "trades",
    globalStyles: {
      primaryColor: "#D4A843",
      secondaryColor: "#1F2937",
      fontHeading: "Playfair Display",
      fontBody: "DM Sans",
      buttonRadius: 4,
      headerStyle: "static",
      footerStyle: "standard",
    },
    pages: [
      {
        slug: "/",
        title: "Home",
        blocks: [
          { id: id(), type: "site_header", content: { logoUrl: "", showPhone: false, phone: "", ctaLabel: "Get Quote", ctaUrl: "#contact", navLinks: [{ id: id(), label: "Portfolio", href: "#portfolio" }, { id: id(), label: "Services", href: "#services" }, { id: id(), label: "About", href: "#about" }, { id: id(), label: "Contact", href: "#contact" }], sticky: false } },
          { id: id(), type: "hero", content: { headline: "Building Excellence, Delivering Dreams", subheadline: "Premium residential and commercial construction", backgroundType: "gradient", backgroundUrl: "", gradientFrom: "#1F2937", gradientTo: "#111827", ctaLabel: "View Portfolio", ctaUrl: "#portfolio", ctaStyle: "solid", secondaryCtaLabel: "Contact Us", secondaryCtaUrl: "#contact", alignment: "center", overlayOpacity: 0.7 } },
          { id: id(), type: "feature_grid", content: { heading: "Why Choose Us", subheading: "Quality craftsmanship in every detail", columns: 3, features: [{ id: id(), icon: "🏗️", title: "Licensed & Insured", description: "Fully licensed builders with comprehensive insurance" }, { id: id(), icon: "🏆", title: "Award Winning", description: "Multiple HIA award-winning projects" }, { id: id(), icon: "📐", title: "Custom Design", description: "Bespoke designs tailored to your vision" }] } },
          { id: id(), type: "cta_banner", content: { headline: "Ready to Build Your Dream?", subheadline: "Let's discuss your project today", ctaLabel: "Schedule Consultation", ctaUrl: "#contact", ctaStyle: "solid", backgroundColor: "#D4A843", textColor: "#ffffff" } },
          { id: id(), type: "lead_capture_form", content: { widgetId: null, heading: "Start Your Project", description: "Tell us about your vision and we'll be in touch.", fields: { name: true, email: true, phone: true, message: true, serviceType: false }, serviceOptions: [], submitLabel: "Request Consultation", successMessage: "Thank you. We'll be in touch within 24 hours." } },
          { id: id(), type: "site_footer", content: { companyName: "Premium Builders", description: "Excellence in construction since 2005.", columns: [{ id: id(), heading: "Services", links: [{ id: id(), label: "New Builds", href: "#" }, { id: id(), label: "Renovations", href: "#" }] }], socialLinks: { facebook: "", instagram: "", linkedin: "", twitter: "", youtube: "" }, showCopyright: true, copyrightText: "" } },
        ] as SiteBlock[],
      },
    ],
  },
  {
    id: "local-handyman",
    name: "Local Handyman",
    description: "Friendly, approachable. Trust badges and local focus.",
    sector: "trades",
    globalStyles: {
      primaryColor: "#2563EB",
      secondaryColor: "#10B981",
      fontHeading: "Plus Jakarta Sans",
      fontBody: "Inter",
      buttonRadius: 12,
      headerStyle: "sticky",
      footerStyle: "standard",
    },
    pages: [
      {
        slug: "/",
        title: "Home",
        blocks: [
          { id: id(), type: "site_header", content: { logoUrl: "", showPhone: true, phone: "0400 000 000", ctaLabel: "Book Now", ctaUrl: "#contact", navLinks: [{ id: id(), label: "Services", href: "#services" }, { id: id(), label: "About", href: "#about" }, { id: id(), label: "Contact", href: "#contact" }], sticky: true } },
          { id: id(), type: "hero", content: { headline: "Your Local Handyman", subheadline: "Reliable repairs and maintenance for your home", backgroundType: "gradient", backgroundUrl: "", gradientFrom: "#2563EB", gradientTo: "#10B981", ctaLabel: "Get a Free Quote", ctaUrl: "#contact", ctaStyle: "solid", secondaryCtaLabel: "", secondaryCtaUrl: "", alignment: "center", overlayOpacity: 0.5 } },
          { id: id(), type: "trust_badges", content: { heading: "Licensed & Trusted", badges: [{ id: id(), imageUrl: "", label: "Fully Insured", url: "" }, { id: id(), imageUrl: "", label: "Police Checked", url: "" }, { id: id(), imageUrl: "", label: "5★ Google", url: "" }], layout: "row", grayscale: false } },
          { id: id(), type: "lead_capture_form", content: { widgetId: null, heading: "Get a Free Quote", description: "No job too small! Tell us what you need.", fields: { name: true, email: true, phone: true, message: true, serviceType: false }, serviceOptions: [], submitLabel: "Send Request", successMessage: "Thanks! I'll get back to you today." } },
          { id: id(), type: "site_footer", content: { companyName: "Local Handyman", description: "Your trusted home repair specialist.", columns: [], socialLinks: { facebook: "", instagram: "", linkedin: "", twitter: "", youtube: "" }, showCopyright: true, copyrightText: "" } },
        ] as SiteBlock[],
      },
    ],
  },

  /* ─── CARE ───────────────────────────────────────────────────────────── */
  {
    id: "ndis-core-supports",
    name: "NDIS Core Supports",
    description: "Accessible, compliant. NDIS registration badges, soft palette.",
    sector: "care",
    globalStyles: {
      primaryColor: "#0891B2",
      secondaryColor: "#6366F1",
      fontHeading: "DM Sans",
      fontBody: "Inter",
      buttonRadius: 8,
      headerStyle: "sticky",
      footerStyle: "standard",
    },
    pages: [
      {
        slug: "/",
        title: "Home",
        blocks: [
          { id: id(), type: "site_header", content: { logoUrl: "", showPhone: true, phone: "1800 000 000", ctaLabel: "Make a Referral", ctaUrl: "#referral", navLinks: [{ id: id(), label: "Services", href: "#services" }, { id: id(), label: "About", href: "#about" }, { id: id(), label: "Referrals", href: "#referral" }, { id: id(), label: "Contact", href: "#contact" }], sticky: true } },
          { id: id(), type: "hero", content: { headline: "Supporting Independence, Every Day", subheadline: "Registered NDIS provider delivering person-centred care", backgroundType: "gradient", backgroundUrl: "", gradientFrom: "#0891B2", gradientTo: "#6366F1", ctaLabel: "Enquire Now", ctaUrl: "#contact", ctaStyle: "solid", secondaryCtaLabel: "Our Services", secondaryCtaUrl: "#services", alignment: "center", overlayOpacity: 0.5 } },
          { id: id(), type: "trust_badges", content: { heading: "Accredited & Registered", badges: [{ id: id(), imageUrl: "", label: "NDIS Registered", url: "" }, { id: id(), imageUrl: "", label: "NDIS Quality & Safeguards", url: "" }, { id: id(), imageUrl: "", label: "ISO 9001", url: "" }], layout: "row", grayscale: false } },
          { id: id(), type: "services_grid", content: { heading: "Our Support Services", services: [{ id: id(), title: "Daily Personal Activities", description: "Support with daily living and personal care", icon: "🤝", imageUrl: "" }, { id: id(), title: "Community Participation", description: "Social and community engagement support", icon: "🌏", imageUrl: "" }, { id: id(), title: "Transport", description: "Safe, reliable transport to appointments", icon: "🚗", imageUrl: "" }, { id: id(), title: "Household Tasks", description: "Help with cleaning, cooking, and maintenance", icon: "🏠", imageUrl: "" }], columns: 2, showImages: false } },
          { id: id(), type: "about_section", content: { heading: "About Our Organisation", body: "We are a registered NDIS provider committed to empowering participants through high-quality, person-centred supports. Our team of qualified support workers are dedicated to helping you achieve your goals.", imageUrl: "", imagePosition: "right", showStats: true, stats: [{ id: id(), value: "200+", label: "Participants" }, { id: id(), value: "50+", label: "Support Workers" }, { id: id(), value: "98%", label: "Satisfaction" }] } },
          { id: id(), type: "lead_capture_form", content: { widgetId: null, heading: "Make a Referral", description: "For participants, families, support coordinators, and plan managers.", fields: { name: true, email: true, phone: true, message: true, serviceType: true }, serviceOptions: ["Daily Personal Activities", "Community Participation", "Transport", "Household Tasks", "Other"], submitLabel: "Submit Referral", successMessage: "Thank you for your referral. Our intake team will be in touch within 1 business day." } },
          { id: id(), type: "site_footer", content: { companyName: "NDIS Support Services", description: "Registered NDIS provider. ABN 00 000 000 000.", columns: [{ id: id(), heading: "Services", links: [{ id: id(), label: "Daily Activities", href: "#services" }, { id: id(), label: "Community Access", href: "#services" }, { id: id(), label: "Transport", href: "#services" }] }, { id: id(), heading: "Quick Links", links: [{ id: id(), label: "About Us", href: "#about" }, { id: id(), label: "Referrals", href: "#referral" }, { id: id(), label: "Contact", href: "#contact" }] }], socialLinks: { facebook: "", instagram: "", linkedin: "", twitter: "", youtube: "" }, showCopyright: true, copyrightText: "" } },
        ] as SiteBlock[],
      },
    ],
  },
  {
    id: "allied-health-clinic",
    name: "Allied Health Clinic",
    description: "Clean, clinical professionalism. White + green palette.",
    sector: "care",
    globalStyles: {
      primaryColor: "#059669",
      secondaryColor: "#0D9488",
      fontHeading: "DM Sans",
      fontBody: "Inter",
      buttonRadius: 8,
      headerStyle: "sticky",
      footerStyle: "minimal",
    },
    pages: [
      {
        slug: "/",
        title: "Home",
        blocks: [
          { id: id(), type: "site_header", content: { logoUrl: "", showPhone: true, phone: "(02) 0000 0000", ctaLabel: "Book Appointment", ctaUrl: "#booking", navLinks: [{ id: id(), label: "Services", href: "#services" }, { id: id(), label: "Team", href: "#team" }, { id: id(), label: "Contact", href: "#contact" }], sticky: true } },
          { id: id(), type: "hero", content: { headline: "Expert Allied Health Care", subheadline: "Physiotherapy, occupational therapy, and psychology under one roof", backgroundType: "gradient", backgroundUrl: "", gradientFrom: "#059669", gradientTo: "#0D9488", ctaLabel: "Book Now", ctaUrl: "#booking", ctaStyle: "solid", secondaryCtaLabel: "Our Services", secondaryCtaUrl: "#services", alignment: "center", overlayOpacity: 0.5 } },
          { id: id(), type: "feature_grid", content: { heading: "Our Disciplines", subheading: "Comprehensive allied health services", columns: 3, features: [{ id: id(), icon: "🦴", title: "Physiotherapy", description: "Musculoskeletal and rehabilitation" }, { id: id(), icon: "🧠", title: "Psychology", description: "Mental health and wellbeing" }, { id: id(), icon: "🧩", title: "Occupational Therapy", description: "Functional independence and daily living" }] } },
          { id: id(), type: "lead_capture_form", content: { widgetId: null, heading: "Book an Appointment", description: "New patients welcome. NDIS, Medicare, and private health accepted.", fields: { name: true, email: true, phone: true, message: true, serviceType: true }, serviceOptions: ["Physiotherapy", "Psychology", "Occupational Therapy"], submitLabel: "Request Appointment", successMessage: "We'll call to confirm your appointment within 24 hours." } },
          { id: id(), type: "site_footer", content: { companyName: "Allied Health Clinic", description: "Evidence-based allied health care.", columns: [], socialLinks: { facebook: "", instagram: "", linkedin: "", twitter: "", youtube: "" }, showCopyright: true, copyrightText: "" } },
        ] as SiteBlock[],
      },
    ],
  },
  {
    id: "supported-living",
    name: "Supported Independent Living",
    description: "Warm earth tones. Compassionate imagery for SIL providers.",
    sector: "care",
    globalStyles: {
      primaryColor: "#D97706",
      secondaryColor: "#92400E",
      fontHeading: "Lora",
      fontBody: "DM Sans",
      buttonRadius: 12,
      headerStyle: "sticky",
      footerStyle: "standard",
    },
    pages: [
      {
        slug: "/",
        title: "Home",
        blocks: [
          { id: id(), type: "site_header", content: { logoUrl: "", showPhone: true, phone: "1300 000 000", ctaLabel: "Enquire", ctaUrl: "#contact", navLinks: [{ id: id(), label: "Our Homes", href: "#homes" }, { id: id(), label: "About", href: "#about" }, { id: id(), label: "Contact", href: "#contact" }], sticky: true } },
          { id: id(), type: "hero", content: { headline: "A Place to Call Home", subheadline: "Supported Independent Living for NDIS participants", backgroundType: "gradient", backgroundUrl: "", gradientFrom: "#D97706", gradientTo: "#92400E", ctaLabel: "Find a Home", ctaUrl: "#homes", ctaStyle: "solid", secondaryCtaLabel: "Learn More", secondaryCtaUrl: "#about", alignment: "center", overlayOpacity: 0.5 } },
          { id: id(), type: "about_section", content: { heading: "Living Your Way", body: "Our Supported Independent Living homes are designed to help NDIS participants live as independently as possible, with the right level of support tailored to each individual.", imageUrl: "", imagePosition: "right", showStats: false, stats: [] } },
          { id: id(), type: "lead_capture_form", content: { widgetId: null, heading: "Enquire About Vacancies", description: "For participants, families, and support coordinators.", fields: { name: true, email: true, phone: true, message: true, serviceType: false }, serviceOptions: [], submitLabel: "Submit Enquiry", successMessage: "Thank you. Our SIL team will be in touch." } },
          { id: id(), type: "site_footer", content: { companyName: "SIL Provider", description: "Registered NDIS Supported Independent Living provider.", columns: [], socialLinks: { facebook: "", instagram: "", linkedin: "", twitter: "", youtube: "" }, showCopyright: true, copyrightText: "" } },
        ] as SiteBlock[],
      },
    ],
  },
];
