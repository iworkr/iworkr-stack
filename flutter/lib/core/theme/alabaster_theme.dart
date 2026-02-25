import 'package:flutter/material.dart';

/// The Alabaster Interface — the crisp light-mode counterpart to Obsidian.
///
/// Designed for direct sunlight. Off-white backgrounds avoid halation,
/// and depth is created through iOS-style micro-shadows rather than borders.
class AlabasterTheme {
  AlabasterTheme._();

  // ── Backgrounds ─────────────────────────────────────
  static const Color canvas = Color(0xFFFAFAFA); // Zinc-50
  static const Color surface1 = Color(0xFFFFFFFF); // Pure White
  static const Color surface2 = Color(0xFFF4F4F5); // Zinc-100
  static const Color shimmerBase = Color(0xFFE4E4E7); // Zinc-200
  static const Color shimmerHighlight = Color(0xFFF4F4F5); // Zinc-100
  static const Color surfaceGlass = Color(0xE6FFFFFF); // 90% white

  // ── Borders ─────────────────────────────────────────
  static const Color border = Color(0x0D000000); // black/5
  static const Color borderMedium = Color(0x14000000); // black/8
  static const Color borderActive = Color(0x1F000000); // black/12
  static const Color borderHover = Color(0x33000000); // black/20
  static const Color borderFocus = Color(0x4D10B981); // emerald/30

  // ── Text ────────────────────────────────────────────
  static const Color textPrimary = Color(0xFF09090B); // Zinc-950
  static const Color textSecondary = Color(0xFF52525B); // Zinc-600
  static const Color textMuted = Color(0xFF71717A); // Zinc-500
  static const Color textTertiary = Color(0xFFA1A1AA); // Zinc-400
  static const Color textDisabled = Color(0xFFD4D4D8); // Zinc-300

  // ── Overlays ────────────────────────────────────────
  static const Color hoverBg = Color(0x08000000); // black/3
  static const Color activeBg = Color(0x0F000000); // black/6

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
