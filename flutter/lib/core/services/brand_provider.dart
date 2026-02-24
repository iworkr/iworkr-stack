import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';

Color _hexToColor(String hex) {
  hex = hex.replaceFirst('#', '');
  if (hex.length == 6) hex = 'FF$hex';
  return Color(int.parse(hex, radix: 16));
}

/// Reactive brand color derived from the active workspace.
/// Falls back to Emerald (#10B981) if no workspace is active.
final brandColorProvider = Provider<Color>((ref) {
  final workspace = ref.watch(activeWorkspaceProvider).valueOrNull;
  if (workspace == null) return const Color(0xFF10B981);
  return _hexToColor(workspace.brandColorHex);
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
