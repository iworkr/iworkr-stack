import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/invoice_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/models/invoice.dart';
import 'package:iworkr_mobile/features/finance/screens/invoice_detail_screen.dart';

class FinanceScreen extends ConsumerWidget {
  const FinanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoicesAsync = ref.watch(invoicesProvider);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 20, 0),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      Navigator.of(context).pop();
                    },
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: ObsidianTheme.hoverBg,
                        border: Border.all(color: ObsidianTheme.border),
                      ),
                      child: const Center(
                        child: Icon(PhosphorIconsLight.arrowLeft, size: 16, color: ObsidianTheme.textSecondary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Finance',
                    style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w600, color: ObsidianTheme.textPrimary, letterSpacing: -0.5),
                  ),
                  const Spacer(),
                  // Create invoice button
                  GestureDetector(
                    onTap: () => HapticFeedback.lightImpact(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        border: Border.all(color: ObsidianTheme.borderMedium),
                        color: ObsidianTheme.hoverBg,
                      ),
                      child: Row(
                        children: [
                          const Icon(PhosphorIconsLight.plus, size: 14, color: ObsidianTheme.textSecondary),
                          const SizedBox(width: 6),
                          Text('Invoice', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms),

            const SizedBox(height: 16),

            // Content
            Expanded(
              child: invoicesAsync.when(
                data: (invoices) {
                  if (invoices.isEmpty) {
                    return const AnimatedEmptyState(
                      type: EmptyStateType.generic,
                      title: 'The ledger is empty',
                      subtitle: 'Create your first invoice to start tracking revenue.',
                    );
                  }

                  // Summary metrics
                  final totalRevenue = invoices.where((i) => i.isPaid).fold(0.0, (sum, i) => sum + i.total);
                  final outstanding = invoices.where((i) => !i.isPaid && !i.isDraft).fold(0.0, (sum, i) => sum + i.total);
                  final overdueCount = invoices.where((i) => i.isOverdue).length;

                  return ListView(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
                    children: [
                      // ── Hero Revenue Card ────────────
                      _buildRevenueCard(totalRevenue, outstanding, overdueCount),

                      const SizedBox(height: 24),

                      // ── Invoice List ─────────────────
                      Text(
                        'INVOICES',
                        style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5),
                      ),
                      const SizedBox(height: 10),

                      ...invoices.asMap().entries.map((entry) {
                        return _InvoiceRow(invoice: entry.value, index: entry.key);
                      }),
                    ],
                  );
                },
                loading: () => Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald))),
                error: (_, __) => const Center(child: Text('Error loading invoices', style: TextStyle(color: ObsidianTheme.textTertiary))),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRevenueCard(double revenue, double outstanding, int overdue) {
    return GlassCard(
      padding: const EdgeInsets.all(20),
      borderRadius: ObsidianTheme.radiusLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('REVENUE', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
          const SizedBox(height: 8),
          Text(
            _formatCurrency(revenue),
            style: GoogleFonts.inter(fontSize: 36, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -1.5),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _MetricChip(label: 'Outstanding', value: _formatCurrency(outstanding), color: ObsidianTheme.amber),
              const SizedBox(width: 8),
              _MetricChip(label: 'Overdue', value: '$overdue', color: overdue > 0 ? ObsidianTheme.rose : ObsidianTheme.textTertiary),
            ],
          ),
        ],
      ),
    ).animate().fadeIn(duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)).moveY(begin: 10, end: 0);
  }

  static String _formatCurrency(double amount) {
    final whole = amount.toInt();
    return '\$${whole.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }
}

class _MetricChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _MetricChip({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: color.withValues(alpha: 0.08),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 10, color: ObsidianTheme.textTertiary)),
          const SizedBox(width: 6),
          Text(value, style: GoogleFonts.jetBrainsMono(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _InvoiceRow extends StatelessWidget {
  final Invoice invoice;
  final int index;
  const _InvoiceRow({required this.invoice, required this.index});

  Color get _statusColor {
    switch (invoice.status) {
      case 'paid': return ObsidianTheme.emerald;
      case 'overdue': return ObsidianTheme.rose;
      case 'sent': return ObsidianTheme.blue;
      case 'draft': return ObsidianTheme.textTertiary;
      default: return ObsidianTheme.textTertiary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        showInvoiceDetail(context, invoice);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: ObsidianTheme.border)),
        ),
        child: Row(
          children: [
            // Status dot
            Container(
              width: 6, height: 6,
              decoration: BoxDecoration(shape: BoxShape.circle, color: _statusColor),
            ),
            const SizedBox(width: 12),

            // ID
            SizedBox(
              width: 64,
              child: Text(
                invoice.displayId ?? 'INV',
                style: GoogleFonts.jetBrainsMono(fontSize: 11, color: ObsidianTheme.textTertiary),
              ),
            ),

            // Client
            Expanded(
              child: Text(
                invoice.clientName ?? 'No Client',
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.white),
                maxLines: 1, overflow: TextOverflow.ellipsis,
              ),
            ),

            // Amount
            Text(
              _formatAmount(invoice.total),
              style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.white),
            ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 100 + index * 30), duration: 400.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 8, end: 0, delay: Duration(milliseconds: 100 + index * 30), duration: 400.ms);
  }

  String _formatAmount(double amount) {
    final whole = amount.toInt();
    final cents = ((amount - whole) * 100).toInt();
    return '\$${whole.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}.${'$cents'.padLeft(2, '0')}';
  }
}
