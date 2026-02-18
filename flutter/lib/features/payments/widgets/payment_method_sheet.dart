import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/payment_terminal_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/invoice.dart';
import 'package:iworkr_mobile/features/payments/screens/terminal_screen.dart';

/// Show the "Collect Payment" method selection sheet
void showPaymentMethodSheet(BuildContext context, Invoice invoice) {
  HapticFeedback.mediumImpact();
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (_) => _PaymentMethodSheet(invoice: invoice),
  );
}

class _PaymentMethodSheet extends ConsumerWidget {
  final Invoice invoice;
  const _PaymentMethodSheet({required this.invoice});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final networkAsync = ref.watch(networkAvailableProvider);
    final isOnline = networkAsync.valueOrNull ?? false;

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            color: ObsidianTheme.void_.withValues(alpha: 0.95),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            border: const Border(top: BorderSide(color: ObsidianTheme.borderMedium)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              const SizedBox(height: 12),
              Container(width: 36, height: 4, decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: ObsidianTheme.textTertiary)),
              const SizedBox(height: 20),

              // Header
              Text('Collect Payment', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white)),
              const SizedBox(height: 4),
              Text(
                _formatAmount(invoice.total),
                style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.emerald, fontWeight: FontWeight.w500),
              ),
              if (invoice.clientName != null) ...[
                const SizedBox(height: 2),
                Text(invoice.clientName!, style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.textTertiary)),
              ],

              const SizedBox(height: 24),

              // Payment options
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  children: [
                    // Tap to Pay (primary)
                    _PaymentOption(
                      icon: PhosphorIconsLight.contactlessPayment,
                      label: 'Tap to Pay',
                      subtitle: isOnline ? 'Card, Apple Pay, Google Pay' : 'Network required',
                      isPrimary: true,
                      enabled: isOnline,
                      onTap: () {
                        Navigator.pop(context);
                        showTerminalScreen(context, invoice);
                      },
                    ).animate().fadeIn(delay: 100.ms, duration: 400.ms).moveY(begin: 8, end: 0),

                    const SizedBox(height: 10),

                    // Payment Link
                    _PaymentOption(
                      icon: PhosphorIconsLight.link,
                      label: 'Send Payment Link',
                      subtitle: 'Email invoice with pay button',
                      onTap: () {
                        HapticFeedback.lightImpact();
                        Navigator.pop(context);
                        // In production: send payment link via email
                      },
                    ).animate().fadeIn(delay: 160.ms, duration: 400.ms).moveY(begin: 8, end: 0),

                    const SizedBox(height: 10),

                    // Manual Entry
                    _PaymentOption(
                      icon: PhosphorIconsLight.creditCard,
                      label: 'Manual Card Entry',
                      subtitle: 'Type card number',
                      onTap: () {
                        HapticFeedback.lightImpact();
                        Navigator.pop(context);
                        // In production: show card entry form
                      },
                    ).animate().fadeIn(delay: 220.ms, duration: 400.ms).moveY(begin: 8, end: 0),

                    const SizedBox(height: 10),

                    // Mark as Paid
                    _PaymentOption(
                      icon: PhosphorIconsLight.checkCircle,
                      label: 'Mark as Paid (Cash/Other)',
                      subtitle: 'Record payment without processing',
                      isGhost: true,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        Navigator.pop(context);
                        // In production: mark paid via other method
                      },
                    ).animate().fadeIn(delay: 280.ms, duration: 400.ms).moveY(begin: 8, end: 0),
                  ],
                ),
              ),

              SizedBox(height: MediaQuery.of(context).padding.bottom + 24),
            ],
          ),
        ),
      ),
    );
  }

  String _formatAmount(double amount) {
    final whole = amount.toInt();
    final cents = ((amount - whole) * 100).toInt();
    return '\$${whole.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}.${'$cents'.padLeft(2, '0')}';
  }
}

class _PaymentOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final bool isPrimary;
  final bool isGhost;
  final bool enabled;
  final VoidCallback onTap;

  const _PaymentOption({
    required this.icon,
    required this.label,
    required this.subtitle,
    this.isPrimary = false,
    this.isGhost = false,
    this.enabled = true,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedContainer(
        duration: ObsidianTheme.fast,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          color: isPrimary ? ObsidianTheme.surface1 : Colors.transparent,
          border: Border.all(
            color: isPrimary
                ? (enabled ? ObsidianTheme.emerald.withValues(alpha: 0.3) : ObsidianTheme.border)
                : isGhost ? ObsidianTheme.border : ObsidianTheme.borderMedium,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: isPrimary
                    ? (enabled ? ObsidianTheme.emeraldDim : ObsidianTheme.shimmerBase)
                    : ObsidianTheme.shimmerBase,
              ),
              child: Center(child: Icon(
                icon, size: 18,
                color: isPrimary
                    ? (enabled ? ObsidianTheme.emerald : ObsidianTheme.textTertiary)
                    : ObsidianTheme.textSecondary,
              )),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: GoogleFonts.inter(
                      fontSize: 14, fontWeight: FontWeight.w500,
                      color: enabled ? Colors.white : ObsidianTheme.textTertiary,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: !enabled ? ObsidianTheme.amber : ObsidianTheme.textTertiary,
                    ),
                  ),
                ],
              ),
            ),
            if (!enabled)
              Icon(PhosphorIconsLight.wifiSlash, size: 14, color: ObsidianTheme.amber)
            else
              Icon(PhosphorIconsLight.caretRight, size: 14, color: ObsidianTheme.textTertiary),
          ],
        ),
      ),
    );
  }
}
