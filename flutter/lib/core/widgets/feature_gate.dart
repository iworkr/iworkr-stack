import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/subscription_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// FeatureGate — a glass blur overlay that locks Pro features for free users.
///
/// The feature content is rendered underneath but obscured by a frosted glass
/// layer with a golden lock icon. Tapping the overlay opens the paywall.
class FeatureGate extends ConsumerWidget {
  final Widget child;
  final String featureLabel;

  const FeatureGate({
    super.key,
    required this.child,
    this.featureLabel = 'Pro Feature',
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isPro = ref.watch(isProProvider).valueOrNull ?? false;

    if (isPro) return child;

    return Stack(
      children: [
        // Underlying content (visible but blurred)
        child,

        // Glass lock overlay
        Positioned.fill(
          child: GestureDetector(
            onTap: () {
              HapticFeedback.mediumImpact();
              _showPaywallSheet(context);
            },
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                child: Container(
                  color: Colors.black.withValues(alpha: 0.4),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Golden lock
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: ObsidianTheme.gold.withValues(alpha: 0.1),
                            border: Border.all(
                              color:
                                  ObsidianTheme.gold.withValues(alpha: 0.25),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color:
                                    ObsidianTheme.gold.withValues(alpha: 0.15),
                                blurRadius: 20,
                              ),
                            ],
                          ),
                          child: const Center(
                            child: Icon(
                              PhosphorIconsBold.lock,
                              size: 22,
                              color: ObsidianTheme.gold,
                            ),
                          ),
                        )
                            .animate(onPlay: (c) => c.repeat(reverse: true))
                            .scaleXY(
                              begin: 1.0,
                              end: 1.06,
                              duration: 2000.ms,
                              curve: Curves.easeInOut,
                            ),

                        const SizedBox(height: 12),

                        Text(
                          featureLabel,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: ObsidianTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Tap to unlock',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: ObsidianTheme.gold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _showPaywallSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black54,
      builder: (_) => const _UpgradeSheet(),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Upgrade Sheet (Mini Paywall) ─────────────────────────
// ═══════════════════════════════════════════════════════════

class _UpgradeSheet extends StatelessWidget {
  const _UpgradeSheet();

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
        child: Container(
          constraints: BoxConstraints(maxHeight: mq.size.height * 0.55),
          decoration: BoxDecoration(
            color: const Color(0xFF0A0A0A).withValues(alpha: 0.92),
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: ObsidianTheme.borderMedium),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 16),
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: ObsidianTheme.textTertiary,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Shield icon
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                  border: Border.all(
                    color: ObsidianTheme.emerald.withValues(alpha: 0.25),
                  ),
                ),
                child: const Center(
                  child: Icon(
                    PhosphorIconsBold.rocketLaunch,
                    size: 26,
                    color: ObsidianTheme.emerald,
                  ),
                ),
              )
                  .animate()
                  .scaleXY(
                      begin: 0.7,
                      end: 1,
                      duration: 500.ms,
                      curve: Curves.easeOutBack),

              const SizedBox(height: 16),

              Text(
                'Upgrade to Pro',
                style: GoogleFonts.inter(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: ObsidianTheme.textPrimary,
                  letterSpacing: -0.3,
                ),
              )
                  .animate()
                  .fadeIn(delay: 100.ms, duration: 400.ms),

              const SizedBox(height: 6),

              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  'Unlock unlimited jobs, AI tools, fleet management, and more.',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: ObsidianTheme.textMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
              )
                  .animate()
                  .fadeIn(delay: 200.ms, duration: 400.ms),

              const SizedBox(height: 24),

              // Quick features
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    _quickFeature(
                        PhosphorIconsLight.infinity, 'Unlimited Jobs & Invoices'),
                    _quickFeature(
                        PhosphorIconsLight.brain, 'AI Scout & Market Index'),
                    _quickFeature(
                        PhosphorIconsLight.mapTrifold, 'Fleet Map & Dispatch'),
                    _quickFeature(
                        PhosphorIconsLight.chartLineUp, 'Advanced Analytics'),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // CTA
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.heavyImpact();
                    Navigator.pop(context);
                    context.push('/paywall');
                  },
                  child: Container(
                    width: double.infinity,
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: ObsidianTheme.emerald,
                    ),
                    child: Center(
                      child: Text(
                        'View Plans',
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Colors.black,
                        ),
                      ),
                    ),
                  ),
                ),
              )
                  .animate()
                  .fadeIn(delay: 300.ms, duration: 400.ms),

              SizedBox(height: mq.padding.bottom + 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _quickFeature(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 16, color: ObsidianTheme.emerald),
          const SizedBox(width: 10),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: ObsidianTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

