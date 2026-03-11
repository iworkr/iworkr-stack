import 'package:flutter/material.dart';

/// The Alabaster Interface — the crisp light-mode counterpart to Obsidian.
///
/// Designed for direct sunlight. Off-white backgrounds avoid halation,
/// and depth is created through iOS-style micro-shadows rather than borders.
class AlabasterTheme {
  AlabasterTheme._();

  // ── Backgrounds (matched to globals.css .light) ─────
  static const Color canvas = Color(0xFFF9FAFB); // --background: #f9fafb (Gray-50)
  static const Color surface1 = Color(0xFFF4F4F5); // --surface-1: #f4f4f5 (Zinc-100)
  static const Color surface2 = Color(0xFFE4E4E7); // --surface-2: #e4e4e7 (Zinc-200)
  static const Color surfaceBase = Color(0xFFFFFFFF); // --surface-0: #ffffff (Pure White)
  static const Color shimmerBase = Color(0xFFD4D4D8); // Zinc-300 (one step below surface-2)
  static const Color shimmerHighlight = Color(0xFFE4E4E7); // Zinc-200
  static const Color surfaceGlass = Color(0xE6FFFFFF); // 90% white

  // ── Borders (matched to globals.css .light) ─────────
  static const Color border = Color(0x14000000); // --border-base: rgba(0,0,0,0.08) ≈ alpha 0x14
  static const Color borderMedium = Color(0x1A000000); // black/10
  static const Color borderActive = Color(0x26000000); // --border-active: rgba(0,0,0,0.15) ≈ alpha 0x26
  static const Color borderHover = Color(0x33000000); // black/20
  static const Color borderFocus = Color(0x4D059669); // brand-light/30 (light brand = #059669)

  // ── Text (matched to globals.css .light) ────────────
  static const Color textPrimary = Color(0xFF18181B); // --text-primary: #18181b (Zinc-900)
  static const Color textSecondary = Color(0xFF52525B); // --text-body: #52525b (Zinc-600)
  static const Color textMuted = Color(0xFF71717A); // --text-muted: #71717a (Zinc-500)
  static const Color textTertiary = Color(0xFFA1A1AA); // --text-dim: #a1a1aa (Zinc-400)
  static const Color textDisabled = Color(0xFFD4D4D8); // Zinc-300

  // ── Overlays (matched to globals.css .light) ────────
  static const Color hoverBg = Color(0x08000000); // --subtle-bg: rgba(0,0,0,0.03) ≈ alpha 0x08
  static const Color activeBg = Color(0x0D000000); // --subtle-bg-hover: rgba(0,0,0,0.05) ≈ alpha 0x0D

  // ── Shadows ─────────────────────────────────────────
  static List<BoxShadow> get cardShadow => [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.03),
          blurRadius: 10,
          offset: const Offset(0, 4),
        ),
      ];

  static List<BoxShadow> get dropdownShadow => [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.08),
          blurRadius: 24,
          offset: const Offset(0, 8),
        ),
      ];
}
