import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:intl/intl.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/models/invoice.dart';
import 'package:iworkr_mobile/features/payments/widgets/payment_method_sheet.dart';

/// Opens the Invoice Detail as a full-screen route
void showInvoiceDetail(BuildContext context, Invoice invoice) {
  HapticFeedback.lightImpact();
  Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder(
      pageBuilder: (_, __, ___) => InvoiceDetailScreen(invoice: invoice),
      transitionsBuilder: (_, animation, __, child) {
        final tween = Tween(begin: const Offset(0, 0.05), end: Offset.zero)
            .chain(CurveTween(curve: Curves.easeOutQuart));
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(position: animation.drive(tween), child: child),
        );
      },
      transitionDuration: const Duration(milliseconds: 300),
    ),
  );
}

class InvoiceDetailScreen extends ConsumerStatefulWidget {
  final Invoice invoice;
  const InvoiceDetailScreen({super.key, required this.invoice});

  @override
  ConsumerState<InvoiceDetailScreen> createState() => _InvoiceDetailScreenState();
}

class _InvoiceDetailScreenState extends ConsumerState<InvoiceDetailScreen> {
  late Invoice _invoice;

  @override
  void initState() {
    super.initState();
    _invoice = widget.invoice;
  }

  Color get _statusColor {
    switch (_invoice.status) {
      case 'paid': return ObsidianTheme.emerald;
      case 'overdue': return ObsidianTheme.rose;
      case 'sent': return ObsidianTheme.blue;
      case 'draft': return ObsidianTheme.textTertiary;
      default: return ObsidianTheme.textTertiary;
    }
  }

  String get _statusLabel => _invoice.status.toUpperCase();

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            Column(
              children: [
                // ── Header ────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () { HapticFeedback.lightImpact(); Navigator.pop(context); },
                        child: Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: ObsidianTheme.hoverBg,
                            border: Border.all(color: ObsidianTheme.border),
                          ),
                          child: const Center(child: Icon(PhosphorIconsLight.arrowLeft, size: 16, color: ObsidianTheme.textSecondary)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _invoice.displayId ?? 'Invoice',
                              style: GoogleFonts.jetBrainsMono(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white),
                            ),
                            Text(
                              _invoice.clientName ?? 'No Client',
                              style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.textTertiary),
                            ),
                          ],
                        ),
                      ),
                      // Status badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          borderRadius: ObsidianTheme.radiusFull,
                          color: _statusColor.withValues(alpha: 0.1),
                          border: Border.all(color: _statusColor.withValues(alpha: 0.25)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(width: 5, height: 5, decoration: BoxDecoration(shape: BoxShape.circle, color: _statusColor)),
                            const SizedBox(width: 6),
                            Text(
                              _statusLabel,
                              style: GoogleFonts.jetBrainsMono(fontSize: 9, fontWeight: FontWeight.w600, color: _statusColor, letterSpacing: 1),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(duration: 300.ms),

                // ── Body ──────────────────────────────
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 120),
                    children: [
                      // Amount hero
                      Center(
                        child: Column(
                          children: [
                            Text(
                              _formatCurrency(_invoice.total),
                              style: GoogleFonts.inter(fontSize: 48, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -2),
                            ),
                            if (_invoice.isPaid)
                              Container(
                                margin: const EdgeInsets.only(top: 8),
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  borderRadius: ObsidianTheme.radiusFull,
                                  color: ObsidianTheme.emeraldDim,
                                  border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(PhosphorIconsBold.check, size: 10, color: ObsidianTheme.emerald),
                                    const SizedBox(width: 4),
                                    Text('PAID', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.emerald, fontWeight: FontWeight.w600, letterSpacing: 1)),
                                  ],
                                ),
                              ).animate().fadeIn(duration: 400.ms).scaleXY(begin: 0.9, end: 1.0),
                          ],
                        ),
                      ).animate().fadeIn(duration: 500.ms).moveY(begin: 10, end: 0),

                      const SizedBox(height: 32),

                      // ── Detail Grid ─────────────────
                      GlassCard(
                        padding: const EdgeInsets.all(16),
                        borderRadius: ObsidianTheme.radiusMd,
                        child: Column(
                          children: [
                            _DetailRow(label: 'Client', value: _invoice.clientName ?? '-'),
                            if (_invoice.clientEmail != null) _DetailRow(label: 'Email', value: _invoice.clientEmail!),
                            _DetailRow(label: 'Issued', value: _formatDate(_invoice.issueDate)),
                            _DetailRow(label: 'Due', value: _formatDate(_invoice.dueDate)),
                            if (_invoice.paidDate != null) _DetailRow(label: 'Paid', value: _formatDate(_invoice.paidDate)),
                          ],
                        ),
                      ).animate().fadeIn(delay: 200.ms, duration: 400.ms).moveY(begin: 8, end: 0),

                      const SizedBox(height: 16),

                      // ── Breakdown ───────────────────
                      GlassCard(
                        padding: const EdgeInsets.all(16),
                        borderRadius: ObsidianTheme.radiusMd,
                        child: Column(
                          children: [
                            _DetailRow(label: 'Subtotal', value: _formatCurrency(_invoice.subtotal)),
                            _DetailRow(label: 'Tax (${_invoice.taxRate.toStringAsFixed(0)}%)', value: _formatCurrency(_invoice.tax)),
                            const Divider(color: ObsidianTheme.border, height: 20),
                            _DetailRow(label: 'Total', value: _formatCurrency(_invoice.total), bold: true),
                          ],
                        ),
                      ).animate().fadeIn(delay: 300.ms, duration: 400.ms).moveY(begin: 8, end: 0),

                      if (_invoice.notes != null && _invoice.notes!.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        GlassCard(
                          padding: const EdgeInsets.all(16),
                          borderRadius: ObsidianTheme.radiusMd,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('NOTES', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                              const SizedBox(height: 8),
                              Text(
                                _invoice.notes!,
                                style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textSecondary, height: 1.5),
                              ),
                            ],
                          ),
                        ).animate().fadeIn(delay: 400.ms, duration: 400.ms),
                      ],
                    ],
                  ),
                ),
              ],
            ),

            // ── Floating "Collect Payment" Button ─────
            if (_invoice.canCollect)
              Positioned(
                left: 20, right: 20, bottom: bottomPad + 16,
                child: GestureDetector(
                  onTap: () => showPaymentMethodSheet(context, _invoice),
                  child: Container(
                    height: 52,
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusMd,
                      color: Colors.white,
                      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 8))],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(PhosphorIconsBold.lightning, size: 16, color: Colors.black),
                        const SizedBox(width: 8),
                        Text('Collect Payment', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.black)),
                      ],
                    ),
                  ),
                ).animate().fadeIn(delay: 500.ms, duration: 400.ms).moveY(begin: 20, end: 0, curve: Curves.easeOutBack),
              ),
          ],
        ),
      ),
    );
  }

  String _formatCurrency(double amount) {
    final whole = amount.toInt();
    final cents = ((amount - whole) * 100).toInt();
    return '\$${whole.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}.${'$cents'.padLeft(2, '0')}';
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '-';
    return DateFormat('d MMM yyyy').format(date);
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  const _DetailRow({required this.label, required this.value, this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.textTertiary)),
          Text(
            value,
            style: bold
                ? GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)
                : GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textPrimary),
          ),
        ],
      ),
    );
  }
}
