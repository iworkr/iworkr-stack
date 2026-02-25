import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── The Paywall — "Choose Your Power" ────────────────────
// ═══════════════════════════════════════════════════════════

class PaywallScreen extends ConsumerStatefulWidget {
  const PaywallScreen({super.key});

  @override
  ConsumerState<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends ConsumerState<PaywallScreen>
    with SingleTickerProviderStateMixin {
  bool _isYearly = true;
  late AnimationController _glowCtrl;

  @override
  void initState() {
    super.initState();
    _glowCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _glowCtrl.dispose();
    super.dispose();
  }

  void _continueFree() {
    HapticFeedback.lightImpact();
    context.go('/');
  }

  Future<void> _activatePro() async {
    HapticFeedback.heavyImpact();

    final orgId = await ref.read(organizationIdProvider.future);
    final user = ref.read(currentUserProvider);
    if (orgId == null || user == null) return;

    // Polar.sh checkout URL with org metadata
    final checkoutUrl = Uri.parse(
      'https://buy.polar.sh/iworkr/pro'
      '?metadata[organization_id]=$orgId'
      '&metadata[user_id]=${user.id}'
      '&customer_email=${Uri.encodeComponent(user.email ?? '')}'
      '&success_url=${Uri.encodeComponent('com.iworkr.mobile://payment_success')}'
    );

    try {
      await launchUrl(checkoutUrl, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not open checkout',
              style: GoogleFonts.inter(color: Colors.white)),
          backgroundColor: ObsidianTheme.rose,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final c = context.iColors;

    return Scaffold(
      backgroundColor: c.canvas,
      body: Stack(
        children: [
          // Background glow
          Positioned(
            top: mq.size.height * 0.1,
            left: mq.size.width * 0.5 - 150,
            child: AnimatedBuilder(
              animation: _glowCtrl,
              builder: (_, __) => Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      ObsidianTheme.emerald
                          .withValues(alpha: 0.06 + _glowCtrl.value * 0.04),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                // ── Header ──
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: _continueFree,
                        child: Text(
                          'Skip',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            color: c.textTertiary,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        'Restore Purchases',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: c.textTertiary,
                        ),
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(duration: 300.ms),

                const SizedBox(height: 20),

                // ── Hero Section ──
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(
                      children: [
                        // Emerald shield icon
                        _EmeraldShield(animation: _glowCtrl)
                            .animate()
                            .fadeIn(duration: 600.ms)
                            .scaleXY(
                                begin: 0.7,
                                end: 1,
                                duration: 700.ms,
                                curve: Curves.easeOutBack),

                        const SizedBox(height: 24),

                        Text(
                          'Choose Your Power',
                          style: GoogleFonts.inter(
                            fontSize: 26,
                            fontWeight: FontWeight.w700,
                            color: c.textPrimary,
                            letterSpacing: -0.5,
                          ),
                        )
                            .animate()
                            .fadeIn(delay: 200.ms, duration: 500.ms),

                        const SizedBox(height: 8),

                        Text(
                          'Unlock the full potential of your field operations.',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            color: c.textMuted,
                          ),
                          textAlign: TextAlign.center,
                        )
                            .animate()
                            .fadeIn(delay: 300.ms, duration: 500.ms),

                        const SizedBox(height: 24),

                        // ── Billing Toggle ──
                        _BillingToggle(
                          isYearly: _isYearly,
                          onToggle: (v) =>
                              setState(() => _isYearly = v),
                        )
                            .animate()
                            .fadeIn(delay: 400.ms, duration: 400.ms),

                        const SizedBox(height: 24),

                        // ── Plan Cards ──
                        _PlanCard(
                          title: 'Starter',
                          price: 'Free',
                          priceSubtitle: 'Forever',
                          features: const [
                            'Up to 3 Jobs / month',
                            'Basic Invoicing',
                            '1 User',
                            'Standard Support',
                          ],
                          accentColor: c.textTertiary,
                          isFeatured: false,
                          ctaLabel: 'Continue with Free',
                          onTap: _continueFree,
                        )
                            .animate()
                            .fadeIn(delay: 500.ms, duration: 500.ms)
                            .moveY(begin: 20, delay: 500.ms, duration: 500.ms),

                        const SizedBox(height: 14),

                        _PlanCard(
                          title: 'Pro',
                          price: _isYearly ? '\$23' : '\$29',
                          priceSubtitle:
                              _isYearly ? '/mo (billed yearly)' : '/month',
                          features: const [
                            'Unlimited Jobs',
                            'The Index (Market Pricing)',
                            'AI Scout',
                            'Fleet Map & Dispatch',
                            'Advanced Routes',
                            'IoT Telemetry',
                            'Priority Support',
                          ],
                          accentColor: ObsidianTheme.emerald,
                          isFeatured: true,
                          ctaLabel: 'Activate Pro Power',
                          onTap: _activatePro,
                          glowAnimation: _glowCtrl,
                          savings: _isYearly ? 'Save 20%' : null,
                        )
                            .animate()
                            .fadeIn(delay: 600.ms, duration: 500.ms)
                            .moveY(begin: 20, delay: 600.ms, duration: 500.ms),

                        const SizedBox(height: 120),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

        ],
      ),
    );
  }

}

// ═══════════════════════════════════════════════════════════
// ── Emerald Shield Hero ──────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _EmeraldShield extends StatelessWidget {
  final AnimationController animation;
  const _EmeraldShield({required this.animation});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (_, child) {
        return Container(
          width: 88,
          height: 88,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                ObsidianTheme.emerald
                    .withValues(alpha: 0.15 + animation.value * 0.1),
                ObsidianTheme.emerald.withValues(alpha: 0.03),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: ObsidianTheme.emerald
                    .withValues(alpha: 0.15 + animation.value * 0.1),
                blurRadius: 30 + animation.value * 20,
              ),
            ],
          ),
          child: child,
        );
      },
      child: Center(
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ObsidianTheme.emerald.withValues(alpha: 0.12),
            border: Border.all(
              color: ObsidianTheme.emerald.withValues(alpha: 0.3),
            ),
          ),
          child: const Center(
            child: Icon(
              PhosphorIconsBold.shieldCheck,
              size: 28,
              color: ObsidianTheme.emerald,
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Billing Toggle ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _BillingToggle extends StatelessWidget {
  final bool isYearly;
  final ValueChanged<bool> onToggle;
  const _BillingToggle({required this.isYearly, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      height: 40,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: c.surface,
        border: Border.all(color: c.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _TogglePill(
            label: 'Monthly',
            isActive: !isYearly,
            onTap: () {
              HapticFeedback.lightImpact();
              onToggle(false);
            },
          ),
          _TogglePill(
            label: 'Yearly (-20%)',
            isActive: isYearly,
            isEmerald: true,
            onTap: () {
              HapticFeedback.lightImpact();
              onToggle(true);
            },
          ),
        ],
      ),
    );
  }
}

class _TogglePill extends StatelessWidget {
  final String label;
  final bool isActive;
  final bool isEmerald;
  final VoidCallback onTap;

  const _TogglePill({
    required this.label,
    required this.isActive,
    this.isEmerald = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: isActive
              ? (isEmerald
                  ? ObsidianTheme.emerald.withValues(alpha: 0.15)
                  : c.surfaceSecondary)
              : Colors.transparent,
          border: Border.all(
            color: isActive
                ? (isEmerald
                    ? ObsidianTheme.emerald.withValues(alpha: 0.3)
                    : c.borderMedium)
                : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
            color: isActive
                ? (isEmerald
                    ? ObsidianTheme.emerald
                    : c.textPrimary)
                : c.textMuted,
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Plan Card ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _PlanCard extends StatefulWidget {
  final String title;
  final String price;
  final String priceSubtitle;
  final List<String> features;
  final Color accentColor;
  final bool isFeatured;
  final String ctaLabel;
  final VoidCallback onTap;
  final AnimationController? glowAnimation;
  final String? savings;

  const _PlanCard({
    required this.title,
    required this.price,
    required this.priceSubtitle,
    required this.features,
    required this.accentColor,
    required this.isFeatured,
    required this.ctaLabel,
    required this.onTap,
    this.glowAnimation,
    this.savings,
  });

  @override
  State<_PlanCard> createState() => _PlanCardState();
}

class _PlanCardState extends State<_PlanCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    Widget card = GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        transform: _pressed
            ? Matrix4.diagonal3Values(0.97, 0.97, 1)
            : Matrix4.identity(),
        transformAlignment: Alignment.center,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: widget.isFeatured
              ? ObsidianTheme.emerald.withValues(alpha: 0.04)
              : c.surface,
          border: Border.all(
            color: widget.isFeatured
                ? ObsidianTheme.emerald.withValues(alpha: 0.4)
                : c.border,
            width: widget.isFeatured ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Text(
                  widget.title,
                  style: GoogleFonts.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: c.textPrimary,
                  ),
                ),
                const Spacer(),
                if (widget.isFeatured)
                  _PulsingBadge(label: 'BEST VALUE'),
                if (widget.savings != null && !widget.isFeatured)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(5),
                      color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                    ),
                    child: Text(
                      widget.savings!,
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        color: ObsidianTheme.emerald,
                      ),
                    ),
                  ),
              ],
            ),

            const SizedBox(height: 12),

            // Price
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  widget.price,
                  style: GoogleFonts.inter(
                    fontSize: 36,
                    fontWeight: FontWeight.w700,
                    color: widget.isFeatured
                        ? ObsidianTheme.emerald
                        : c.textPrimary,
                    letterSpacing: -1,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 6, left: 4),
                  child: Text(
                    widget.priceSubtitle,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: c.textMuted,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 18),

            // Features
            ...widget.features.map((f) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      Icon(
                        PhosphorIconsBold.check,
                        size: 14,
                        color: !widget.isFeatured
                            ? c.textMuted
                            : ObsidianTheme.emerald,
                      ),
                      const SizedBox(width: 10),
                      Text(
                        f,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: c.textSecondary,
                        ),
                      ),
                    ],
                  ),
                )),

            const SizedBox(height: 16),

            // CTA
            Container(
              width: double.infinity,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: widget.isFeatured
                    ? ObsidianTheme.emerald
                    : Colors.transparent,
                border: Border.all(
                  color: widget.isFeatured
                      ? ObsidianTheme.emerald
                      : c.borderMedium,
                ),
              ),
              child: Center(
                child: Text(
                  widget.ctaLabel,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: widget.isFeatured
                        ? Colors.black
                        : c.textSecondary,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );

    // Glow effect for featured card
    if (widget.isFeatured && widget.glowAnimation != null) {
      card = AnimatedBuilder(
        animation: widget.glowAnimation!,
        builder: (_, child) => Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: ObsidianTheme.emerald.withValues(
                    alpha: 0.08 + widget.glowAnimation!.value * 0.06),
                blurRadius: 20 + widget.glowAnimation!.value * 10,
              ),
            ],
          ),
          child: child,
        ),
        child: card,
      );
    }

    return card;
  }
}

// ═══════════════════════════════════════════════════════════
// ── Pulsing "Best Value" Badge ───────────────────────────
// ═══════════════════════════════════════════════════════════

class _PulsingBadge extends StatelessWidget {
  final String label;
  const _PulsingBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        color: ObsidianTheme.emerald.withValues(alpha: 0.12),
        border: Border.all(
          color: ObsidianTheme.emerald.withValues(alpha: 0.3),
        ),
      ),
      child: Text(
        label,
        style: GoogleFonts.jetBrainsMono(
          fontSize: 9,
          fontWeight: FontWeight.w700,
          color: ObsidianTheme.emerald,
          letterSpacing: 1,
        ),
      ),
    )
        .animate(onPlay: (c) => c.repeat(reverse: true))
        .scaleXY(
          begin: 1.0,
          end: 1.05,
          duration: 1200.ms,
          curve: Curves.easeInOut,
        );
  }
}

