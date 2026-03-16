import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Security Lock Screen — Project Aegis ─────────────────
// ═══════════════════════════════════════════════════════════
//
// Shown when a user attempts to navigate to a route their
// RBAC role does not permit. Dark Obsidian aesthetic with
// a shield icon, clear messaging, and a single "Go Back" CTA.

class SecurityLockScreen extends StatelessWidget {
  const SecurityLockScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final isDark = context.isDark;

    return Scaffold(
      backgroundColor: c.canvas,
      body: Stack(
        children: [
          // ── Subtle radial gradient accent ──
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0, -0.3),
                  radius: 0.8,
                  colors: [
                    ObsidianTheme.rose.withValues(alpha: isDark ? 0.06 : 0.04),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // ── Content ──
          SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 40),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // ── Shield Icon ──
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: ObsidianTheme.roseDim,
                        border: Border.all(
                          color: ObsidianTheme.rose.withValues(alpha: 0.2),
                          width: 1,
                        ),
                      ),
                      child: const Center(
                        child: Icon(
                          PhosphorIconsFill.shieldWarning,
                          size: 36,
                          color: ObsidianTheme.rose,
                        ),
                      ),
                    ),

                    const SizedBox(height: 28),

                    // ── Heading ──
                    Text(
                      'Access Restricted',
                      style: GoogleFonts.inter(
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                        color: c.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),

                    const SizedBox(height: 12),

                    // ── Body ──
                    Text(
                      'This area is restricted to administrators. '
                      'Contact your workspace admin if you need access.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        height: 1.5,
                        color: c.textSecondary,
                      ),
                    ),

                    const SizedBox(height: 8),

                    // ── Clearance badge ──
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        color: c.surfaceSecondary,
                        border: Border.all(color: c.border, width: 1),
                      ),
                      child: Text(
                        'AEGIS RBAC ENFORCEMENT',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 10,
                          letterSpacing: 1.2,
                          color: c.textMuted,
                        ),
                      ),
                    ),

                    const SizedBox(height: 36),

                    // ── Go Back button ──
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: TextButton(
                        onPressed: () {
                          if (context.canPop()) {
                            context.pop();
                          } else {
                            context.go('/');
                          }
                        },
                        style: TextButton.styleFrom(
                          backgroundColor: c.surface,
                          foregroundColor: c.textPrimary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: c.borderMedium, width: 1),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              PhosphorIconsLight.arrowLeft,
                              size: 18,
                              color: c.textSecondary,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Go Back',
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
