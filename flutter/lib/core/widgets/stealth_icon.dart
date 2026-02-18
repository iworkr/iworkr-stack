import 'package:flutter/material.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// StealthIcon — enforces the "Precision" icon style across the app.
///
/// Uses Phosphor Icons (Regular/Light) at 1.5px stroke weight.
/// Color logic:
/// - Default: Zinc-500 (#71717A)
/// - Active:  Emerald-400 (#34D399)
/// - Destructive: Rose-500 (#F43F5E)
class StealthIcon extends StatelessWidget {
  final IconData icon;
  final double size;
  final bool isActive;
  final bool isDestructive;
  final Color? color;

  const StealthIcon(
    this.icon, {
    super.key,
    this.size = 20,
    this.isActive = false,
    this.isDestructive = false,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final resolvedColor = color ??
        (isDestructive
            ? ObsidianTheme.rose
            : isActive
                ? const Color(0xFF34D399)
                : ObsidianTheme.textMuted);

    return Icon(icon, size: size, color: resolvedColor);
  }
}
