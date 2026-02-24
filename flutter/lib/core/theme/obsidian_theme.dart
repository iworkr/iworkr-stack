import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// The Obsidian Interface — unified design system matching iWorkr Web 1:1.
///
/// All values sourced from src/app/globals.css CSS variables and component audits.
/// This is the single source of truth for the mobile app's visual identity.
class ObsidianTheme {
  ObsidianTheme._();

  // ── Backgrounds ─────────────────────────────────────
  /// #050505 — global canvas / --background / --surface-0
  static const Color void_ = Color(0xFF050505);

  /// #0A0A0A — --surface-1 (sidebar, table headers, elevated surfaces)
  static const Color surface1 = Color(0xFF0A0A0A);

  /// #141414 — --surface-2 (secondary surfaces, dropdowns)
  static const Color surface2 = Color(0xFF141414);

  /// #18181B — skeleton/shimmer base layer
  static const Color shimmerBase = Color(0xFF18181B);

  /// #27272A — skeleton/shimmer highlight
  static const Color shimmerHighlight = Color(0xFF27272A);

  /// Glass surface — 85% opacity #0C0C0C with backdrop blur
  static const Color surfaceGlass = Color(0xD90C0C0C);

  // Legacy aliases for backward compatibility
  static const Color surface = surface1;

  // ── Borders ─────────────────────────────────────────
  /// rgba(255,255,255,0.05) — hairline borders, dividers, separators
  static const Color border = Color(0x0DFFFFFF);

  /// rgba(255,255,255,0.08) — button borders, header borders
  static const Color borderMedium = Color(0x14FFFFFF);

  /// rgba(255,255,255,0.12) — active borders, --border-active
  static const Color borderActive = Color(0x1FFFFFFF);

  /// rgba(255,255,255,0.20) — hover states on buttons
  static const Color borderHover = Color(0x33FFFFFF);

  /// rgba(16,185,129,0.30) — focus rings, active selection
  static const Color borderFocus = Color(0x4D10B981);

  // Legacy alias
  static const Color borderLight = borderMedium;

  // ── Signals ─────────────────────────────────────────
  /// #10B981 — brand / success / online / completed
  static const Color emerald = Color(0xFF10B981);

  /// #059669 — brand hover / brand-dark
  static const Color emeraldHover = Color(0xFF059669);

  /// 10% opacity — badge/pill backgrounds
  static const Color emeraldDim = Color(0x1A10B981);

  /// 30% opacity — glow effects
  static const Color emeraldGlow = Color(0x4D10B981);

  /// #F43F5E — destructive / error / overdue / offline
  static const Color rose = Color(0xFFF43F5E);
  static const Color roseDim = Color(0x1AF43F5E);

  /// #F59E0B — warning / en-route / travel
  static const Color amber = Color(0xFFF59E0B);
  static const Color amberDim = Color(0x1AF59E0B);

  /// #3B82F6 — info / scheduled / links
  static const Color blue = Color(0xFF3B82F6);
  static const Color blueDim = Color(0x1A3B82F6);

  /// #6366F1 — AI / intelligence / cortex
  static const Color indigo = Color(0xFF6366F1);
  static const Color indigoDim = Color(0x1A6366F1);

  /// #EAB308 — gold / revenue / opportunity / scout
  static const Color gold = Color(0xFFEAB308);
  static const Color goldDim = Color(0x1AEAB308);

  /// #8B5CF6 — violet / premium / high-margin / market-index
  static const Color violet = Color(0xFF8B5CF6);
  static const Color violetDim = Color(0x1A8B5CF6);

  // ── Text ────────────────────────────────────────────
  /// #EDEDED — primary text (web: --text-primary)
  static const Color textPrimary = Color(0xFFEDEDED);

  /// #A1A1AA — zinc-400 body text
  static const Color textSecondary = Color(0xFFA1A1AA);

  /// #71717A — zinc-500 / --text-muted
  static const Color textMuted = Color(0xFF71717A);

  /// #52525B — zinc-600 timestamps, metadata
  static const Color textTertiary = Color(0xFF52525B);

  /// #3F3F46 — zinc-700 disabled / placeholder
  static const Color textDisabled = Color(0xFF3F3F46);

  // ── Overlays ────────────────────────────────────────
  /// rgba(255,255,255,0.02) — hover highlight (web: bg-white/[0.02])
  static const Color hoverBg = Color(0x05FFFFFF);

  /// rgba(255,255,255,0.04) — active/selected (web: bg-white/[0.04])
  static const Color activeBg = Color(0x0AFFFFFF);

  /// rgba(16,185,129,0.15) — selection background
  static const Color selectionBg = Color(0x2610B981);

  // ── Timing ──────────────────────────────────────────
  /// 120ms — fast transitions (web: duration: 0.12)
  static const Duration fast = Duration(milliseconds: 120);

  /// 200ms — standard transitions
  static const Duration standard = Duration(milliseconds: 200);

  /// 300ms — widget-shell transitions
  static const Duration medium = Duration(milliseconds: 300);

  /// 500ms — page entry (web: duration: 0.5)
  static const Duration slow = Duration(milliseconds: 500);

  /// 20ms — per-item stagger delay
  static const Duration stagger = Duration(milliseconds: 20);

  // ── Easing ──────────────────────────────────────────
  /// [0.16, 1, 0.3, 1] — expo ease used across all web components
  static const Cubic easeOutExpo = Cubic(0.16, 1, 0.3, 1);

  // ── Border Radius (matching Tailwind classes) ───────
  /// 6px — rounded-md (nav items, small buttons)
  static final BorderRadius radiusSm = BorderRadius.circular(6);

  /// 8px — rounded-lg (buttons, dropdowns, inputs)
  static final BorderRadius radiusMd = BorderRadius.circular(8);

  /// 12px — rounded-xl (cards, widget shells, glass cards)
  static final BorderRadius radiusLg = BorderRadius.circular(12);

  /// 16px — rounded-2xl (large cards, modals)
  static final BorderRadius radiusXl = BorderRadius.circular(16);

  /// Full pill shape
  static final BorderRadius radiusFull = BorderRadius.circular(9999);

  /// 30px — floating dock
  static final BorderRadius radiusDock = BorderRadius.circular(30);

  // ── Shadows ─────────────────────────────────────────
  /// Brand glow: 0 0 20px rgba(16, 185, 129, 0.3)
  static List<BoxShadow> get brandGlow => [
        const BoxShadow(color: emeraldGlow, blurRadius: 20),
      ];

  /// Subtle brand glow: 0 0 12px -5px rgba(16, 185, 129, 0.2)
  static List<BoxShadow> get brandGlowSubtle => [
        BoxShadow(color: emeraldGlow.withValues(alpha: 0.2), blurRadius: 12, offset: const Offset(0, -5)),
      ];

  /// Dropdown shadow: 0 16px 48px -8px rgba(0,0,0,0.6)
  static List<BoxShadow> get dropdownShadow => [
        BoxShadow(color: Colors.black.withValues(alpha: 0.6), blurRadius: 48, offset: const Offset(0, 16)),
      ];

  /// Card hover shadow
  static List<BoxShadow> get cardHoverShadow => [
        BoxShadow(color: Colors.black.withValues(alpha: 0.6), blurRadius: 40, offset: const Offset(0, 10)),
        const BoxShadow(color: borderMedium, blurRadius: 0, spreadRadius: 1),
      ];

  // ── ThemeData ───────────────────────────────────────
  static ThemeData get darkTheme {
    final inter = GoogleFonts.inter();
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: void_,
      primaryColor: emerald,
      cardColor: surface1,
      canvasColor: void_,
      dividerColor: border,
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      fontFamily: inter.fontFamily,
      textTheme: TextTheme(
        displayLarge: GoogleFonts.inter(
          fontWeight: FontWeight.w600,
          color: textPrimary,
          fontSize: 28,
          letterSpacing: -0.5,
        ),
        displayMedium: GoogleFonts.inter(
          fontWeight: FontWeight.w600,
          color: textPrimary,
          fontSize: 22,
          letterSpacing: -0.5,
        ),
        titleLarge: GoogleFonts.inter(
          fontWeight: FontWeight.w600,
          color: textPrimary,
          fontSize: 18,
          letterSpacing: -0.3,
        ),
        titleMedium: GoogleFonts.inter(
          fontWeight: FontWeight.w500,
          color: textPrimary,
          fontSize: 15,
        ),
        bodyLarge: GoogleFonts.inter(color: textSecondary, fontSize: 14),
        bodyMedium: GoogleFonts.inter(color: textSecondary, fontSize: 13),
        bodySmall: GoogleFonts.inter(color: textMuted, fontSize: 11),
        labelSmall: GoogleFonts.jetBrainsMono(
          color: textTertiary,
          fontSize: 10,
          letterSpacing: 0.5,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: void_,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          color: textPrimary,
          letterSpacing: -0.3,
        ),
        iconTheme: const IconThemeData(color: textSecondary, size: 20),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.transparent,
        selectedItemColor: emerald,
        unselectedItemColor: textTertiary,
        type: BottomNavigationBarType.fixed,
        showSelectedLabels: false,
        showUnselectedLabels: false,
      ),
      dividerTheme: const DividerThemeData(color: border, thickness: 1, space: 0),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.transparent,
        hintStyle: GoogleFonts.inter(color: textDisabled, fontSize: 14),
        contentPadding: const EdgeInsets.symmetric(horizontal: 0, vertical: 12),
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        errorBorder: InputBorder.none,
        focusedErrorBorder: InputBorder.none,
        disabledBorder: InputBorder.none,
      ),
      colorScheme: const ColorScheme.dark(
        primary: emerald,
        onPrimary: Colors.black,
        secondary: textSecondary,
        surface: surface1,
        error: rose,
      ),
    );
  }

  /// Generate a ThemeData with a custom brand color for white-labeling.
  static ThemeData darkThemeWith(Color brandColor) {
    final onBrand = brandColor.computeLuminance() > 0.5
        ? Colors.black
        : Colors.white;
    return darkTheme.copyWith(
      primaryColor: brandColor,
      colorScheme: darkTheme.colorScheme.copyWith(
        primary: brandColor,
        onPrimary: onBrand,
      ),
      bottomNavigationBarTheme: darkTheme.bottomNavigationBarTheme.copyWith(
        selectedItemColor: brandColor,
      ),
    );
  }
}
