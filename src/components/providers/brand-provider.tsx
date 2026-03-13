"use client";

import { useEffect, useMemo } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { useBrandingStore } from "@/lib/stores/branding-store";

/**
 * BrandProvider — Project Chameleon
 *
 * Fetches workspace branding from Supabase and injects CSS custom properties
 * into the <html> element's style attribute. Every component consuming
 * `var(--brand-primary)` or Tailwind's `bg-brand` will reactively update.
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

  // Compute derived CSS values
  const cssVars = useMemo(() => {
    if (!branding?.primary_color_hex) return null;

    const hex = branding.primary_color_hex;
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
      "--brand-primary": hex,
      "--brand-primary-text": textColor,
      "--brand-primary-hover": hoverHex,
      "--brand-primary-10": `rgba(${r},${g},${b},0.1)`,
      "--brand-primary-20": `rgba(${r},${g},${b},0.2)`,
      "--brand-primary-glow": `0 0 12px rgba(${r},${g},${b},0.08)`,
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
