import 'package:flutter/material.dart';
import 'package:iworkr_mobile/core/theme/alabaster_theme.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Semantic color extension — bridges the gap between Obsidian and Alabaster.
///
/// Use `Theme.of(context).extension<IWorkrColors>()!` to access any of these
/// colors. They automatically resolve to the correct value based on the active
/// theme (light or dark).
class IWorkrColors extends ThemeExtension<IWorkrColors> {
  final Color canvas;
  final Color surface;
  final Color surfaceSecondary;
  final Color surfaceGlass;
  final Color border;
  final Color borderMedium;
  final Color borderActive;
  final Color borderHover;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textTertiary;
  final Color textDisabled;
  final Color hoverBg;
  final Color activeBg;
  final Color shimmerBase;
  final Color shimmerHighlight;
  final Color inputIdleBg;
  final Color inputFocusBg;
  final Color dockBg;

  const IWorkrColors({
    required this.canvas,
    required this.surface,
    required this.surfaceSecondary,
    required this.surfaceGlass,
    required this.border,
    required this.borderMedium,
    required this.borderActive,
    required this.borderHover,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textTertiary,
    required this.textDisabled,
    required this.hoverBg,
    required this.activeBg,
    required this.shimmerBase,
    required this.shimmerHighlight,
    required this.inputIdleBg,
    required this.inputFocusBg,
    required this.dockBg,
  });

  static const dark = IWorkrColors(
    canvas: ObsidianTheme.void_,
    surface: ObsidianTheme.surface1,
    surfaceSecondary: ObsidianTheme.surface2,
    surfaceGlass: ObsidianTheme.surfaceGlass,
    border: ObsidianTheme.border,
    borderMedium: ObsidianTheme.borderMedium,
    borderActive: ObsidianTheme.borderActive,
    borderHover: ObsidianTheme.borderHover,
    textPrimary: ObsidianTheme.textPrimary,
    textSecondary: ObsidianTheme.textSecondary,
    textMuted: ObsidianTheme.textMuted,
    textTertiary: ObsidianTheme.textTertiary,
    textDisabled: ObsidianTheme.textDisabled,
    hoverBg: ObsidianTheme.hoverBg,
    activeBg: ObsidianTheme.activeBg,
    shimmerBase: ObsidianTheme.shimmerBase,
    shimmerHighlight: ObsidianTheme.shimmerHighlight,
    inputIdleBg: Colors.transparent,
    inputFocusBg: Colors.transparent,
    dockBg: Color(0xCC000000), // black/80
  );

  static const light = IWorkrColors(
    canvas: AlabasterTheme.canvas,
    surface: AlabasterTheme.surface1,
    surfaceSecondary: AlabasterTheme.surface2,
    surfaceGlass: AlabasterTheme.surfaceGlass,
    border: AlabasterTheme.border,
    borderMedium: AlabasterTheme.borderMedium,
    borderActive: AlabasterTheme.borderActive,
    borderHover: AlabasterTheme.borderHover,
    textPrimary: AlabasterTheme.textPrimary,
    textSecondary: AlabasterTheme.textSecondary,
    textMuted: AlabasterTheme.textMuted,
    textTertiary: AlabasterTheme.textTertiary,
    textDisabled: AlabasterTheme.textDisabled,
    hoverBg: AlabasterTheme.hoverBg,
    activeBg: AlabasterTheme.activeBg,
    shimmerBase: AlabasterTheme.shimmerBase,
    shimmerHighlight: AlabasterTheme.shimmerHighlight,
    inputIdleBg: Color(0xFFF4F4F5), // Zinc-100
    inputFocusBg: Color(0xFFFFFFFF),
    dockBg: Color(0xCCFFFFFF), // white/80
  );

  @override
  IWorkrColors copyWith({
    Color? canvas,
    Color? surface,
    Color? surfaceSecondary,
    Color? surfaceGlass,
    Color? border,
    Color? borderMedium,
    Color? borderActive,
    Color? borderHover,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? textTertiary,
    Color? textDisabled,
    Color? hoverBg,
    Color? activeBg,
    Color? shimmerBase,
    Color? shimmerHighlight,
    Color? inputIdleBg,
    Color? inputFocusBg,
    Color? dockBg,
  }) {
    return IWorkrColors(
      canvas: canvas ?? this.canvas,
      surface: surface ?? this.surface,
      surfaceSecondary: surfaceSecondary ?? this.surfaceSecondary,
      surfaceGlass: surfaceGlass ?? this.surfaceGlass,
      border: border ?? this.border,
      borderMedium: borderMedium ?? this.borderMedium,
      borderActive: borderActive ?? this.borderActive,
      borderHover: borderHover ?? this.borderHover,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      textTertiary: textTertiary ?? this.textTertiary,
      textDisabled: textDisabled ?? this.textDisabled,
      hoverBg: hoverBg ?? this.hoverBg,
      activeBg: activeBg ?? this.activeBg,
      shimmerBase: shimmerBase ?? this.shimmerBase,
      shimmerHighlight: shimmerHighlight ?? this.shimmerHighlight,
      inputIdleBg: inputIdleBg ?? this.inputIdleBg,
      inputFocusBg: inputFocusBg ?? this.inputFocusBg,
      dockBg: dockBg ?? this.dockBg,
    );
  }

  @override
  IWorkrColors lerp(IWorkrColors? other, double t) {
    if (other is! IWorkrColors) return this;
    return IWorkrColors(
      canvas: Color.lerp(canvas, other.canvas, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceSecondary: Color.lerp(surfaceSecondary, other.surfaceSecondary, t)!,
      surfaceGlass: Color.lerp(surfaceGlass, other.surfaceGlass, t)!,
      border: Color.lerp(border, other.border, t)!,
      borderMedium: Color.lerp(borderMedium, other.borderMedium, t)!,
      borderActive: Color.lerp(borderActive, other.borderActive, t)!,
      borderHover: Color.lerp(borderHover, other.borderHover, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      textTertiary: Color.lerp(textTertiary, other.textTertiary, t)!,
      textDisabled: Color.lerp(textDisabled, other.textDisabled, t)!,
      hoverBg: Color.lerp(hoverBg, other.hoverBg, t)!,
      activeBg: Color.lerp(activeBg, other.activeBg, t)!,
      shimmerBase: Color.lerp(shimmerBase, other.shimmerBase, t)!,
      shimmerHighlight: Color.lerp(shimmerHighlight, other.shimmerHighlight, t)!,
      inputIdleBg: Color.lerp(inputIdleBg, other.inputIdleBg, t)!,
      inputFocusBg: Color.lerp(inputFocusBg, other.inputFocusBg, t)!,
      dockBg: Color.lerp(dockBg, other.dockBg, t)!,
    );
  }
}

/// Convenience extension to access IWorkrColors from BuildContext.
extension IWorkrColorsX on BuildContext {
  IWorkrColors get iColors => Theme.of(this).extension<IWorkrColors>()!;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}
