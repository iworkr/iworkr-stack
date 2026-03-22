/**
 * @component BrandProvider
 * @status COMPLETE
 * @description Fetches workspace branding and injects CSS custom properties for theming
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useMemo } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { useBrandingStore } from "@/lib/stores/branding-store";

/**
 * BrandProvider — Project Chameleon
 *
 * Fetches workspace branding from Supabase and injects CSS custom properties
 * into the <html> element's style attribute. Overrides the ACTUAL variables
 * used throughout the app: --brand, --brand-hover, --brand-glow, etc.
 *
 * Also handles favicon override when a custom logo is available.
 */
export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { orgId } = useOrg();
  const branding = useBrandingStore((s) => s.branding);
  const loadFromServer = useBrandingStore((s) => s.loadFromServer);

  // Load branding data on mount / org change
  useEffect(() => {
    if (!orgId) return;
    loadFromServer(orgId);
  }, [orgId, loadFromServer]);

  // Compute derived CSS values — override the REAL vars used by the app
  const cssVars = useMemo(() => {
    if (!branding?.primary_color_hex) return null;

    const hex = branding.primary_color_hex;
    // If default emerald, skip injection (CSS already has it)
    if (hex.toUpperCase() === "#10B981") return null;

    const textColor = branding.text_on_primary_hex || "#FFFFFF";

    // Parse RGB for opacity variants
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);

    // Darken for hover state (~15% darker)
    const hoverR = Math.round(r * 0.85);
    const hoverG = Math.round(g * 0.85);
    const hoverB = Math.round(b * 0.85);
    const hoverHex = `#${[hoverR, hoverG, hoverB].map(c => c.toString(16).padStart(2, "0")).join("")}`;

    return {
      // ── Override the ACTUAL app-wide variables ──
      "--brand": hex,
      "--brand-hover": hoverHex,
      "--brand-glow": `0 0 12px rgba(${r},${g},${b},0.08)`,
      "--brand-glow-subtle": `0 0 8px -5px rgba(${r},${g},${b},0.05)`,
      "--selection-bg": `rgba(${r},${g},${b},0.15)`,
      "--search-spine": hex,
      // Ghost-emerald tokens (used for brand-colored badges/tags)
      "--ghost-emerald": `rgba(${r},${g},${b},0.05)`,
      "--ghost-emerald-text": hex,
      "--ghost-emerald-strong": `rgba(${r},${g},${b},0.10)`,
      // ── Also set the Chameleon-specific vars for new components ──
      "--brand-primary": hex,
      "--brand-primary-text": textColor,
      "--brand-primary-hover": hoverHex,
      "--brand-primary-10": `rgba(${r},${g},${b},0.1)`,
      "--brand-primary-20": `rgba(${r},${g},${b},0.2)`,
      "--brand-primary-glow": `0 0 12px rgba(${r},${g},${b},0.08)`,
      // ── Tailwind @theme inline tokens ──
      "--color-brand": hex,
      "--color-brand-dark": hoverHex,
      "--color-brand-glow": `rgba(${r},${g},${b},0.2)`,
    };
  }, [branding]);

  // Inject CSS variables into <html> element
  useEffect(() => {
    if (!cssVars) return;

    const html = document.documentElement;
    const entries = Object.entries(cssVars);

    for (const [key, value] of entries) {
      html.style.setProperty(key, value);
    }

    return () => {
      for (const [key] of entries) {
        html.style.removeProperty(key);
      }
    };
  }, [cssVars]);

  // Dynamic favicon override
  useEffect(() => {
    if (!branding?.logo_light_url) return;

    const existingFavicon = document.querySelector('link[rel="icon"][sizes="32x32"]') as HTMLLinkElement;
    const originalHref = existingFavicon?.href;

    if (existingFavicon) {
      existingFavicon.href = branding.logo_light_url;
    } else {
      const link = document.createElement("link");
      link.rel = "icon";
      link.sizes = "32x32";
      link.type = "image/png";
      link.href = branding.logo_light_url;
      document.head.appendChild(link);
    }

    // Also update apple-touch-icon
    const appleFavicon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
    if (appleFavicon) {
      appleFavicon.href = branding.logo_light_url;
    }

    return () => {
      if (existingFavicon && originalHref) {
        existingFavicon.href = originalHref;
      }
    };
  }, [branding?.logo_light_url]);

  return <>{children}</>;
}
