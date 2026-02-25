import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

Color _hexToColor(String hex) {
  hex = hex.replaceFirst('#', '');
  if (hex.length == 6) hex = 'FF$hex';
  return Color(int.parse(hex, radix: 16));
}

/// Darkens a color by [amount] (0.0–1.0) for WCAG-safe use on light surfaces.
Color _darkenForLight(Color color, [double amount = 0.25]) {
  final hsl = HSLColor.fromColor(color);
  final darkened = hsl.withLightness(
    math.max(0.0, hsl.lightness - amount),
  );
  return darkened.toColor();
}

/// Reactive brand color derived from the active workspace.
/// Falls back to Emerald (#10B981) if no workspace is active.
final brandColorProvider = Provider<Color>((ref) {
  final workspace = ref.watch(activeWorkspaceProvider).valueOrNull;
  if (workspace == null) return const Color(0xFF10B981);
  return _hexToColor(workspace.brandColorHex);
});

/// Brand color tinted darker for text/icon use on light backgrounds.
/// If the raw brand color has luminance > 0.4, it's darkened ~2 shades.
final brandTextColorProvider = Provider.family<Color, Brightness>((ref, brightness) {
  final brand = ref.watch(brandColorProvider);
  if (brightness == Brightness.dark) return brand;
  if (brand.computeLuminance() > 0.4) return _darkenForLight(brand, 0.2);
  return brand;
});

/// Whether text on the brand color surface should be black (for light brand colors).
final brandOnColorProvider = Provider<Color>((ref) {
  final brand = ref.watch(brandColorProvider);
  return brand.computeLuminance() > 0.5 ? Colors.black : Colors.white;
});

/// Dim variant (10% opacity) for badges, pills, tag backgrounds.
final brandDimProvider = Provider<Color>((ref) {
  return ref.watch(brandColorProvider).withValues(alpha: 0.1);
});

/// Glow variant (30% opacity) for shadow/glow effects.
final brandGlowProvider = Provider<Color>((ref) {
  return ref.watch(brandColorProvider).withValues(alpha: 0.3);
});
