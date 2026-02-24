import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Glassmorphism card — matches web widget-shell.tsx exactly.
///
/// Web spec:
/// - border-radius: rounded-xl (12px)
/// - border: border-white/[0.05]
/// - background: #0A0A0A
/// - hover border: border-white/[0.1]
/// - spotlight: radial-gradient(300px circle, rgba(255,255,255,0.03))
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
              color: const Color(0xFF09090B),
              borderRadius: widget.borderRadius ?? ObsidianTheme.radiusXl,
              border: Border.all(
                color: widget.borderColor ?? Colors.white.withValues(alpha: 0.05),
              ),
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
