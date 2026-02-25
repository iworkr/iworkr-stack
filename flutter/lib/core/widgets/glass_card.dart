import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Glassmorphism card — matches web widget-shell.tsx exactly.
///
/// In Alabaster (light) mode uses subtle drop shadow instead of glow borders.
class GlassCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final double blur;
  final Color? borderColor;
  final BorderRadius? borderRadius;
  final bool enableHoverEffect;

  const GlassCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.blur = 20,
    this.borderColor,
    this.borderRadius,
    this.enableHoverEffect = false,
  });

  @override
  State<GlassCard> createState() => _GlassCardState();
}

class _GlassCardState extends State<GlassCard> with SingleTickerProviderStateMixin {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final isDark = context.isDark;

    final card = AnimatedContainer(
      duration: ObsidianTheme.medium,
      curve: Curves.easeOut,
      transform: _pressed ? Matrix4.diagonal3Values(0.98, 0.98, 1) : Matrix4.identity(),
      transformAlignment: Alignment.center,
      child: ClipRRect(
        borderRadius: widget.borderRadius ?? ObsidianTheme.radiusXl,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: widget.blur, sigmaY: widget.blur),
          child: Container(
            padding: widget.padding ?? const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: c.surface,
              borderRadius: widget.borderRadius ?? ObsidianTheme.radiusXl,
              border: Border.all(
                color: widget.borderColor ?? c.border,
              ),
              boxShadow: isDark
                  ? null
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
            ),
            child: widget.child,
          ),
        ),
      ),
    );

    if (widget.onTap != null) {
      return GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: card,
      );
    }
    return card;
  }
}
