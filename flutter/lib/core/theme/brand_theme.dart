import 'package:flutter/material.dart';

/// Project Chameleon — ThemeExtension for white-label branding.
///
/// All branded UI components MUST reference this extension:
///   Theme.of(context).extension<BrandTheme>()!.primary
///
/// This ensures zero hardcoded brand colors across the codebase.
@immutable
class BrandTheme extends ThemeExtension<BrandTheme> {
  const BrandTheme({
    required this.primary,
    required this.onPrimary,
    required this.accent,
    required this.primaryDim,
    required this.primaryGlow,
    required this.appName,
    this.logoLightUrl,
    this.logoDarkUrl,
    this.appIconUrl,
  });

  final Color primary;
  final Color onPrimary;
  final Color accent;
  final Color primaryDim;
  final Color primaryGlow;
  final String appName;
  final String? logoLightUrl;
  final String? logoDarkUrl;
  final String? appIconUrl;

  /// Default iWorkr brand (Emerald)
  static const defaultBrand = BrandTheme(
    primary: Color(0xFF10B981),
    onPrimary: Colors.white,
    accent: Color(0xFF3B82F6),
    primaryDim: Color(0x1A10B981),
    primaryGlow: Color(0x4D10B981),
    appName: 'iWorkr',
  );

  /// WCAG-compliant foreground color calculation.
  /// Uses the standard luminance formula: L = 0.2126R + 0.7152G + 0.0722B
  /// Threshold at 0.179 per WCAG 2.1 AA guidelines.
  static Color contrastColorFor(Color bg) {
    final r = bg.r;
    final g = bg.g;
    final b = bg.b;
    // sRGB linearization
    double linearize(double c) =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055).clamp(0, 1);
    // Note: bg.r/g/b return 0.0-1.0 in Flutter's Color
    final luminance = 0.2126 * linearize(r) +
        0.7152 * linearize(g) +
        0.0722 * linearize(b);
    return luminance > 0.179 ? Colors.black : Colors.white;
  }

  /// Create BrandTheme from hex strings (from Supabase workspace_branding)
  factory BrandTheme.fromHex({
    required String primaryHex,
    String? accentHex,
    String? textOnPrimaryHex,
    String? appName,
    String? logoLightUrl,
    String? logoDarkUrl,
    String? appIconUrl,
  }) {
    final primary = _hexToColor(primaryHex);
    final accent = accentHex != null ? _hexToColor(accentHex) : const Color(0xFF3B82F6);
    final onPrimary = textOnPrimaryHex != null
        ? _hexToColor(textOnPrimaryHex)
        : contrastColorFor(primary);

    return BrandTheme(
      primary: primary,
      onPrimary: onPrimary,
      accent: accent,
      primaryDim: primary.withValues(alpha: 0.1),
      primaryGlow: primary.withValues(alpha: 0.3),
      appName: appName ?? 'iWorkr',
      logoLightUrl: logoLightUrl,
      logoDarkUrl: logoDarkUrl,
      appIconUrl: appIconUrl,
    );
  }

  static Color _hexToColor(String hex) {
    hex = hex.replaceFirst('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }

  @override
  BrandTheme copyWith({
    Color? primary,
    Color? onPrimary,
    Color? accent,
    Color? primaryDim,
    Color? primaryGlow,
    String? appName,
    String? logoLightUrl,
    String? logoDarkUrl,
    String? appIconUrl,
  }) {
    return BrandTheme(
      primary: primary ?? this.primary,
      onPrimary: onPrimary ?? this.onPrimary,
      accent: accent ?? this.accent,
      primaryDim: primaryDim ?? this.primaryDim,
      primaryGlow: primaryGlow ?? this.primaryGlow,
      appName: appName ?? this.appName,
      logoLightUrl: logoLightUrl ?? this.logoLightUrl,
      logoDarkUrl: logoDarkUrl ?? this.logoDarkUrl,
      appIconUrl: appIconUrl ?? this.appIconUrl,
    );
  }

  @override
  BrandTheme lerp(BrandTheme? other, double t) {
    if (other is! BrandTheme) return this;
    return BrandTheme(
      primary: Color.lerp(primary, other.primary, t)!,
      onPrimary: Color.lerp(onPrimary, other.onPrimary, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      primaryDim: Color.lerp(primaryDim, other.primaryDim, t)!,
      primaryGlow: Color.lerp(primaryGlow, other.primaryGlow, t)!,
      appName: t < 0.5 ? appName : other.appName,
      logoLightUrl: t < 0.5 ? logoLightUrl : other.logoLightUrl,
      logoDarkUrl: t < 0.5 ? logoDarkUrl : other.logoDarkUrl,
      appIconUrl: t < 0.5 ? appIconUrl : other.appIconUrl,
    );
  }
}

/// Convenience extension for quick access:
///   context.brand.primary
extension BrandThemeContext on BuildContext {
  BrandTheme get brand =>
      Theme.of(this).extension<BrandTheme>() ?? BrandTheme.defaultBrand;
}
