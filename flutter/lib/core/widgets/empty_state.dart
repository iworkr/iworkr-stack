import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Animated empty state — matches web empty-state patterns.
///
/// Web spec:
/// - zen-breathe animation: scale 1 -> 1.15, opacity 0.6 -> 1 (3s loop)
/// - signal-pulse: scale 1 -> 1.8, opacity 0.3 -> 0 (2s loop)
/// - Ghost/outline CTA button
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Animated icon with pulse ring
            SizedBox(
              width: 88,
              height: 88,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Outer pulse ring (signal-pulse: 2s)
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: ObsidianTheme.border, width: 1),
                    ),
                  )
                      .animate(onPlay: (c) => c.repeat())
                      .scaleXY(begin: 0.8, end: 1.8, duration: 2000.ms, curve: Curves.easeOut)
                      .fadeOut(duration: 2000.ms),

                  // Inner icon container (zen-breathe: 3s)
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: ObsidianTheme.border),
                      color: ObsidianTheme.surface1,
                    ),
                    child: Icon(icon, size: 26, color: ObsidianTheme.textTertiary),
                  )
                      .animate(onPlay: (c) => c.repeat(reverse: true))
                      .scaleXY(begin: 1, end: 1.08, duration: 3000.ms, curve: Curves.easeInOut),
                ],
              ),
            ),

            const SizedBox(height: 28),

            Text(
              title,
              style: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w500,
                color: ObsidianTheme.textSecondary,
                letterSpacing: -0.2,
              ),
              textAlign: TextAlign.center,
            )
                .animate()
                .fadeIn(delay: 200.ms, duration: 400.ms),

            const SizedBox(height: 8),

            Text(
              subtitle,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: ObsidianTheme.textTertiary,
              ),
              textAlign: TextAlign.center,
            )
                .animate()
                .fadeIn(delay: 300.ms, duration: 400.ms),

            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 24),
              GestureDetector(
                onTap: onAction,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    border: Border.all(color: ObsidianTheme.borderMedium),
                    color: Colors.transparent,
                  ),
                  child: Text(
                    actionLabel!,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: ObsidianTheme.textSecondary,
                    ),
                  ),
                ),
              )
                  .animate()
                  .fadeIn(delay: 400.ms, duration: 400.ms),
            ],
          ],
        ),
      ),
    );
  }
}
