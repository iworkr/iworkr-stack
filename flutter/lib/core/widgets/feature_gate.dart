import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:iworkr_mobile/core/services/billing_provider.dart';

// ═══════════════════════════════════════════════════════════
// ── Feature Gate — The Obsidian Tollbooth ─────────────────
// ═══════════════════════════════════════════════════════════
//
// Wraps premium features. If the workspace plan_tier doesn't
// meet the required tier, the children are rendered with a
// blur and a polished upgrade sheet is shown.
//
// On mobile, the CTA opens the web billing page (App Store
// compliance — no in-app purchases for B2B SaaS).

const _tierOrder = ['free', 'starter', 'pro', 'business'];

bool _meetsTier(String current, String required) {
  final currentIdx = _tierOrder.indexOf(current);
  final requiredIdx = _tierOrder.indexOf(required);
  return currentIdx >= requiredIdx;
}

class FeatureGate extends ConsumerWidget {
  final String requiredTier;
  final Widget child;
  final String? featureTitle;
  final String? featureDescription;

  const FeatureGate({
    super.key,
    required this.requiredTier,
    required this.child,
    this.featureTitle,
    this.featureDescription,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tierAsync = ref.watch(planTierProvider);
    final currentTier = tierAsync.valueOrNull ?? 'free';

    if (_meetsTier(currentTier, requiredTier)) {
      return child;
    }

    return Stack(
      children: [
        IgnorePointer(
          child: ImageFiltered(
            imageFilter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
            child: Opacity(opacity: 0.3, child: child),
          ),
        ),
        Positioned.fill(
          child: GestureDetector(
            onTap: () => _showUpgradeSheet(context),
            child: Container(
              color: const Color(0xFF09090B).withValues(alpha: 0.8),
              child: Center(
                child: _GatePlaceholder(
                  title: featureTitle ?? _tierDisplayName(requiredTier),
                  description: featureDescription ??
                      'Upgrade to ${_tierDisplayName(requiredTier)} to unlock this feature.',
                  onUpgrade: () => _showUpgradeSheet(context),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _showUpgradeSheet(BuildContext context) {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _UpgradeSheet(
        requiredTier: requiredTier,
        featureTitle: featureTitle,
        featureDescription: featureDescription,
      ),
    );
  }
}

// ── Inline lock placeholder ──────────────────────────────

class _GatePlaceholder extends StatelessWidget {
  final String title;
  final String description;
  final VoidCallback onUpgrade;

  const _GatePlaceholder({
    required this.title,
    required this.description,
    required this.onUpgrade,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              color: Colors.white.withValues(alpha: 0.05),
            ),
            child: const Icon(CupertinoIcons.lock_fill, size: 20, color: Color(0xFF71717A)),
          ),
          const SizedBox(height: 16),
          Text(
            '$title Feature',
            style: GoogleFonts.inter(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: Colors.white,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF71717A), height: 1.5),
          ),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: onUpgrade,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                'Manage Plan on Web',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.black,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Full upgrade bottom sheet ────────────────────────────

class _UpgradeSheet extends StatelessWidget {
  final String requiredTier;
  final String? featureTitle;
  final String? featureDescription;

  const _UpgradeSheet({
    required this.requiredTier,
    this.featureTitle,
    this.featureDescription,
  });

  @override
  Widget build(BuildContext context) {
    final tierName = _tierDisplayName(requiredTier);
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF09090B),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(
          top: BorderSide(color: Color(0x0DFFFFFF)),
          left: BorderSide(color: Color(0x0DFFFFFF)),
          right: BorderSide(color: Color(0x0DFFFFFF)),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 20, 24, bottomPad + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 24),
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                  color: Colors.white.withValues(alpha: 0.05),
                ),
                child: const Icon(CupertinoIcons.lock_fill, size: 24, color: Color(0xFF71717A)),
              ),
              const SizedBox(height: 20),
              Text(
                featureTitle ?? 'Unlock $tierName',
                style: GoogleFonts.inter(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                featureDescription ??
                    'This feature requires the $tierName plan. Manage your subscription on the web to continue.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 14, color: const Color(0xFF71717A), height: 1.5),
              ),
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                child: GestureDetector(
                  onTap: () => _openBillingWeb(context),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        'Manage Plan on Web',
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Colors.black,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'Not now',
                    style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF71717A)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openBillingWeb(BuildContext context) async {
    HapticFeedback.lightImpact();
    final uri = Uri.parse('https://app.iworkr.com/settings/billing');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    if (context.mounted) Navigator.of(context).pop();
  }
}

// ── Soft Gate badge (inline) ─────────────────────────────

class SoftGateBadge extends ConsumerWidget {
  final String requiredTier;
  final Widget child;

  const SoftGateBadge({
    super.key,
    required this.requiredTier,
    required this.child,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tierAsync = ref.watch(planTierProvider);
    final currentTier = tierAsync.valueOrNull ?? 'free';

    if (_meetsTier(currentTier, requiredTier)) {
      return child;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Opacity(opacity: 0.5, child: IgnorePointer(child: child)),
        const SizedBox(width: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
          ),
          child: Text(
            _tierDisplayName(requiredTier).toUpperCase(),
            style: GoogleFonts.jetBrainsMono(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              color: const Color(0xFFF59E0B),
              letterSpacing: 0.5,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Helpers ──────────────────────────────────────────────

String _tierDisplayName(String tier) {
  switch (tier) {
    case 'starter': return 'Starter';
    case 'pro': return 'Standard';
    case 'business': return 'Enterprise';
    default: return 'Pro';
  }
}
