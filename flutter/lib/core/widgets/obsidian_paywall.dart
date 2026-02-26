import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:iworkr_mobile/core/services/revenuecat_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Obsidian Paywall — Native IAP Upgrade Sheet ──────────
// ═══════════════════════════════════════════════════════════
//
// Full-screen bottom sheet with:
//   - Animated lock icon
//   - Dynamic pricing from RevenueCat (App Store Connect)
//   - Feature hooks list
//   - Restore Purchases, Terms, Privacy (Apple compliance)

Future<bool> showObsidianPaywall(
  BuildContext context, {
  String? featureTitle,
  String? featureDescription,
}) async {
  HapticFeedback.mediumImpact();
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    isDismissible: true,
    builder: (_) => _ObsidianPaywallSheet(
      featureTitle: featureTitle,
      featureDescription: featureDescription,
    ),
  );
  return result ?? false;
}

class _ObsidianPaywallSheet extends ConsumerStatefulWidget {
  final String? featureTitle;
  final String? featureDescription;

  const _ObsidianPaywallSheet({this.featureTitle, this.featureDescription});

  @override
  ConsumerState<_ObsidianPaywallSheet> createState() =>
      _ObsidianPaywallSheetState();
}

class _ObsidianPaywallSheetState
    extends ConsumerState<_ObsidianPaywallSheet> {
  bool _purchasing = false;
  bool _restoring = false;
  String? _error;

  Future<void> _handlePurchase(Package package) async {
    setState(() {
      _purchasing = true;
      _error = null;
    });

    try {
      final success = await RevenueCatService.instance.purchase(package);
      if (mounted) {
        if (success) {
          HapticFeedback.heavyImpact();
          Navigator.of(context).pop(true);
        } else {
          setState(() => _purchasing = false);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _purchasing = false;
          _error = 'Purchase failed. Please try again.';
        });
      }
    }
  }

  Future<void> _handleRestore() async {
    setState(() {
      _restoring = true;
      _error = null;
    });

    try {
      final info = await RevenueCatService.instance.restorePurchases();
      if (mounted) {
        if (info.entitlements.active.isNotEmpty) {
          HapticFeedback.heavyImpact();
          Navigator.of(context).pop(true);
        } else {
          setState(() {
            _restoring = false;
            _error = 'No active purchases found for this account.';
          });
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _restoring = false;
          _error = 'Restore failed. Please try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final offeringAsync = ref.watch(rcOfferingProvider);
    final mq = MediaQuery.of(context);

    return PopScope(
      canPop: !_purchasing,
      child: Container(
        constraints: BoxConstraints(maxHeight: mq.size.height * 0.85),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(
            top: BorderSide(color: c.border),
            left: BorderSide(color: c.border),
            right: BorderSide(color: c.border),
          ),
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(24, 16, 24, mq.padding.bottom + 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: c.borderHover,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 28),

                _AnimatedGateIcon()
                    .animate()
                    .fadeIn(duration: 500.ms)
                    .scale(begin: const Offset(0.8, 0.8), end: const Offset(1, 1), duration: 500.ms, curve: Curves.easeOutBack),

                const SizedBox(height: 24),

                Text(
                  widget.featureTitle ?? 'Supercharge your operations.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: c.textPrimary,
                    letterSpacing: -0.5,
                    height: 1.2,
                  ),
                ).animate().fadeIn(delay: 100.ms, duration: 400.ms),

                const SizedBox(height: 10),

                Text(
                  widget.featureDescription ??
                      'Unlock advanced routing, offline sync queues, and AI dispatching.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: c.textMuted,
                    height: 1.5,
                  ),
                ).animate().fadeIn(delay: 200.ms, duration: 400.ms),

                const SizedBox(height: 28),

                ..._buildFeatureList(),

                const SizedBox(height: 28),

                offeringAsync.when(
                  data: (offering) {
                    final package = offering?.availablePackages.firstOrNull;
                    // Fallback price shown when RevenueCat offering data is unavailable
                    final priceStr = package?.storeProduct.priceString ?? '\$69.99';

                    return _buildCta(priceStr, package);
                  },
                  // Fallback price shown when RevenueCat offering data is unavailable
                  loading: () => _buildCta('\$69.99', null, loading: true),
                  // Fallback price shown when RevenueCat offering data is unavailable
                  error: (_, __) => _buildCta('\$69.99', null),
                ),

                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.rose),
                  ).animate().fadeIn(duration: 200.ms).shake(duration: 300.ms),
                ],

                const SizedBox(height: 16),

                Text(
                  'Cancel anytime. Subscription auto-renews monthly.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    color: c.textTertiary,
                  ),
                ),

                const SizedBox(height: 16),

                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _GhostLink(
                      label: 'Restore',
                      loading: _restoring,
                      onTap: _handleRestore,
                    ),
                    _dot(),
                    _GhostLink(
                      label: 'Terms',
                      onTap: () => _openUrl('https://iworkrapp.com/terms'),
                    ),
                    _dot(),
                    _GhostLink(
                      label: 'Privacy',
                      onTap: () => _openUrl('https://iworkrapp.com/privacy'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCta(String priceStr, Package? package, {bool loading = false}) {
    return SizedBox(
      width: double.infinity,
      child: GestureDetector(
        onTap: (_purchasing || loading || package == null)
            ? null
            : () => _handlePurchase(package),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: _purchasing ? Colors.white70 : Colors.white,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Center(
            child: _purchasing
                ? const CupertinoActivityIndicator(color: Colors.black)
                : Text(
                    'Upgrade — $priceStr / mo',
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.black,
                    ),
                  ),
          ),
        ),
      ),
    ).animate().fadeIn(delay: 400.ms, duration: 400.ms).moveY(begin: 12, duration: 400.ms, curve: Curves.easeOutCubic);
  }

  List<Widget> _buildFeatureList() {
    final c = context.iColors;
    const features = [
      ('God Mode Dispatch', 'Road-snapped routing with live tracking'),
      ('AI Workforce Hub', 'Synthetic receptionists & automated dispatchers'),
      ('Document Forge Pro', 'Signatures, photos, custom PDF exports'),
      ('Unlimited Team', 'No seat limits — scale without limits'),
    ];

    return features.asMap().entries.map((e) {
      final i = e.key;
      final (title, subtitle) = e.value;

      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 22,
              height: 22,
              margin: const EdgeInsets.only(top: 1),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(6),
                color: ObsidianTheme.emerald.withValues(alpha: 0.1),
              ),
              child: Icon(
                PhosphorIconsBold.check,
                size: 12,
                color: ObsidianTheme.emerald,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: c.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: c.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      )
          .animate()
          .fadeIn(delay: Duration(milliseconds: 250 + i * 60), duration: 400.ms)
          .moveX(begin: 12, duration: 400.ms, curve: Curves.easeOutCubic);
    }).toList();
  }

  Widget _dot() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Text('·', style: GoogleFonts.inter(fontSize: 14, color: context.iColors.textTertiary)),
      );

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

// ── Animated Gate Icon ───────────────────────────────────

class _AnimatedGateIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
        color: ObsidianTheme.emerald.withValues(alpha: 0.06),
        boxShadow: [
          BoxShadow(
            color: ObsidianTheme.emerald.withValues(alpha: 0.15),
            blurRadius: 40,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Icon(
        PhosphorIconsBold.crownSimple,
        size: 28,
        color: ObsidianTheme.emerald,
      ),
    );
  }
}

// ── Ghost Link (Restore / Terms / Privacy) ───────────────

class _GhostLink extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final bool loading;

  const _GhostLink({
    required this.label,
    required this.onTap,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: loading ? null : () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: loading
            ? const SizedBox(
                width: 14,
                height: 14,
                child: CupertinoActivityIndicator(radius: 7),
              )
            : Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: c.textMuted,
                  decoration: TextDecoration.underline,
                  decorationColor: c.textTertiary,
                ),
              ),
      ),
    );
  }
}
