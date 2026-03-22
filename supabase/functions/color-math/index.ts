/**
 * @module color-math
 * @status COMPLETE
 * @auth UNSECURED — Public utility endpoint, no auth required
 * @description Calculates WCAG-compliant contrast colors, YIQ/relative luminance, and derived opacity variants for a given hex code
 * @dependencies None (pure computation)
 * @lastAudit 2026-03-22
 */
/**
 * Supabase Edge Function: color-math
 *
 * Calculates WCAG-compliant contrast color for a given hex code.
 * Uses the YIQ luminance formula to determine whether text on a
 * colored surface should be black (#000000) or white (#FFFFFF).
 *
 * Also generates derived opacity variants for UI use.
 *
 * POST body: { hex: "#4C1D95" }
 * Response: {
 *   primary: "#4C1D95",
 *   text_on_primary: "#FFFFFF",
 *   primary_10: "rgba(76,29,149,0.1)",
 *   primary_20: "rgba(76,29,149,0.2)",
 *   primary_hover: "#3B1578",
 *   luminance: 0.04,
 *   is_dark: true
 * }
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((c) =>
        Math.max(0, Math.min(255, Math.round(c)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

/**
 * YIQ luminance formula — fast & reliable for contrast decisions.
 * Returns a value 0–255 where >= 128 is "light" (needs dark text).
 */
function getYIQLuminance(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * WCAG 2.1 relative luminance for more precise contrast ratio calculation.
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const srgb = c / 255;
    return srgb <= 0.03928
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Generate a slightly darker hover variant by reducing brightness by ~15%.
 */
function darkenHex(r: number, g: number, b: number, amount = 0.15): string {
  return rgbToHex(
    Math.round(r * (1 - amount)),
    Math.round(g * (1 - amount)),
    Math.round(b * (1 - amount))
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hex } = await req.json();

    if (!hex || typeof hex !== "string") {
      return new Response(
        JSON.stringify({ error: "hex field is required (e.g. '#10B981')" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const rgb = hexToRgb(hex);
    if (!rgb) {
      // Invalid hex — fall back to iWorkr Emerald
      return new Response(
        JSON.stringify({
          primary: "#10B981",
          text_on_primary: "#FFFFFF",
          primary_10: "rgba(16,185,129,0.1)",
          primary_20: "rgba(16,185,129,0.2)",
          primary_hover: "#0D9668",
          luminance: 0.2,
          is_dark: true,
          fallback: true,
          error: `Invalid hex code: ${hex}. Defaulted to iWorkr Emerald.`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { r, g, b } = rgb;
    const yiq = getYIQLuminance(r, g, b);
    const relativeLuminance = getRelativeLuminance(r, g, b);
    const isDark = yiq < 128;
    const textColor = isDark ? "#FFFFFF" : "#000000";

    const normalizedHex = rgbToHex(r, g, b).toUpperCase();

    return new Response(
      JSON.stringify({
        primary: normalizedHex,
        text_on_primary: textColor,
        primary_10: `rgba(${r},${g},${b},0.1)`,
        primary_20: `rgba(${r},${g},${b},0.2)`,
        primary_hover: darkenHex(r, g, b),
        luminance: Math.round(relativeLuminance * 1000) / 1000,
        is_dark: isDark,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
