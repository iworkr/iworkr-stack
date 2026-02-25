import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/quote_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/models/quote.dart';
import 'package:iworkr_mobile/features/quotes/screens/quote_present_screen.dart';
import 'package:iworkr_mobile/features/market/widgets/market_gauge_widget.dart';
import 'package:iworkr_mobile/core/widgets/stealth_text_field.dart';

/// Opens the quote builder for a specific job
void showQuoteCreator(BuildContext context, {
  required String jobId,
  String? clientId,
  String? clientName,
  String? clientEmail,
  String? clientAddress,
  String? jobTitle,
}) {
  HapticFeedback.mediumImpact();
  Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder(
      pageBuilder: (_, __, ___) => QuoteCreateScreen(
        jobId: jobId, clientId: clientId, clientName: clientName,
        clientEmail: clientEmail, clientAddress: clientAddress, jobTitle: jobTitle,
      ),
      transitionsBuilder: (_, a, __, child) {
        final tween = Tween(begin: const Offset(0, 0.05), end: Offset.zero)
            .chain(CurveTween(curve: Curves.easeOutQuart));
        return FadeTransition(opacity: a, child: SlideTransition(position: a.drive(tween), child: child));
      },
      transitionDuration: const Duration(milliseconds: 300),
    ),
  );
}

class QuoteCreateScreen extends ConsumerStatefulWidget {
  final String jobId;
  final String? clientId;
  final String? clientName;
  final String? clientEmail;
  final String? clientAddress;
  final String? jobTitle;

  const QuoteCreateScreen({
    super.key, required this.jobId, this.clientId, this.clientName,
    this.clientEmail, this.clientAddress, this.jobTitle,
  });

  @override
  ConsumerState<QuoteCreateScreen> createState() => _QuoteCreateScreenState();
}

class _QuoteCreateScreenState extends ConsumerState<QuoteCreateScreen> {
  final List<_EditableItem> _items = [];
  final _titleController = TextEditingController();
  final _notesController = TextEditingController();
  final double _taxRate = 10.0;
  bool _saving = false;

  double get _subtotal => _items.fold(0.0, (s, i) => s + i.total);
  double get _tax => _subtotal * (_taxRate / 100);
  double get _total => _subtotal + _tax;

  @override
  void initState() {
    super.initState();
    _titleController.text = widget.jobTitle ?? '';
  }

  @override
  void dispose() {
    _titleController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _addItem() {
    HapticFeedback.lightImpact();
    setState(() {
      _items.add(_EditableItem(description: '', quantity: 1, unitPrice: 0));
    });
  }

  void _removeItem(int index) {
    HapticFeedback.mediumImpact();
    setState(() => _items.removeAt(index));
  }

  Future<void> _saveAndPresent() async {
    if (_items.isEmpty) return;
    setState(() => _saving = true);
    HapticFeedback.mediumImpact();

    final orgId = await ref.read(organizationIdProvider.future);
    if (orgId == null) { setState(() => _saving = false); return; }

    final lineItems = _items.asMap().entries.map((e) => QuoteLineItem(
      description: e.value.description,
      quantity: e.value.quantity,
      unitPrice: e.value.unitPrice,
      sortOrder: e.key,
    )).toList();

    final quote = await createQuote(
      organizationId: orgId,
      jobId: widget.jobId,
      clientId: widget.clientId,
      clientName: widget.clientName,
      clientEmail: widget.clientEmail,
      clientAddress: widget.clientAddress,
      title: _titleController.text.trim().isEmpty ? null : _titleController.text.trim(),
      items: lineItems,
      taxRate: _taxRate,
      notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
    );

    if (mounted && quote != null) {
      setState(() => _saving = false);
      ref.invalidate(quotesProvider);
      ref.invalidate(jobQuotesProvider(widget.jobId));

      // Jump straight to presentation mode
      Navigator.of(context).pop();
      if (context.mounted) {
        showQuotePresentation(context, quote);
      }
    } else {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        bottom: false,
        child: StealthFieldScope(
          child: Stack(
            children: [
              Column(
                children: [
                  // Header
                  Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () { HapticFeedback.lightImpact(); Navigator.pop(context); },
                        child: Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle, color: c.hoverBg,
                            border: Border.all(color: c.border),
                          ),
                          child: Center(child: Icon(PhosphorIconsLight.x, size: 16, color: c.textSecondary)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text('New Quote', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: c.textPrimary)),
                      ),
                      if (widget.clientName != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            borderRadius: ObsidianTheme.radiusFull,
                            color: c.shimmerBase,
                            border: Border.all(color: c.border),
                          ),
                          child: Text(widget.clientName!, style: GoogleFonts.inter(fontSize: 10, color: c.textTertiary)),
                        ),
                    ],
                  ),
                ).animate().fadeIn(duration: 300.ms),

                // Body
                Expanded(
                  child: ListView(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 160),
                    children: [
                      // Title
                      TextField(
                        controller: _titleController,
                        style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: c.textPrimary),
                        cursorColor: ObsidianTheme.emerald,
                        decoration: InputDecoration(
                          hintText: 'Quote title (optional)',
                          hintStyle: GoogleFonts.inter(fontSize: 18, color: c.textDisabled),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ).animate().fadeIn(duration: 400.ms),

                      const SizedBox(height: 24),

                      // Section: Line Items
                      Text('LINE ITEMS', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5)),
                      const SizedBox(height: 10),

                      ..._items.asMap().entries.map((entry) {
                        return _LineItemEditor(
                          item: entry.value,
                          index: entry.key,
                          onChanged: () => setState(() {}),
                          onRemove: () => _removeItem(entry.key),
                        ).animate().fadeIn(duration: 300.ms).moveY(begin: 8, end: 0);
                      }),

                      // Add item button
                      GestureDetector(
                        onTap: _addItem,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            borderRadius: ObsidianTheme.radiusMd,
                            border: Border.all(color: c.borderMedium, style: BorderStyle.solid),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(PhosphorIconsLight.plus, size: 14, color: c.textTertiary),
                              const SizedBox(width: 6),
                              Text('Add Item', style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary, fontWeight: FontWeight.w500)),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Jagged receipt divider
                      CustomPaint(painter: _ReceiptDividerPainter(color: c.border), size: const Size(double.infinity, 8)),

                      const SizedBox(height: 16),

                      // Totals
                      _TotalRow(label: 'Subtotal', value: _subtotal),
                      const SizedBox(height: 4),
                      _TotalRow(label: 'Tax (${_taxRate.toStringAsFixed(0)}%)', value: _tax),
                      Divider(color: c.border, height: 20),
                      _TotalRow(label: 'Total', value: _total, bold: true),

                      // Market Intelligence Gauge
                      if (_total > 0 && _titleController.text.trim().isNotEmpty)
                        MarketGaugeWidget(
                          currentPrice: _total,
                          jobTitle: _titleController.text.trim(),
                        ),

                      const SizedBox(height: 24),

                      // Notes
                      Text('NOTES', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _notesController,
                        style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary),
                        maxLines: 3,
                        cursorColor: ObsidianTheme.emerald,
                        decoration: InputDecoration(
                          hintText: 'Additional notes...',
                          hintStyle: GoogleFonts.inter(fontSize: 13, color: c.textDisabled),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Bottom CTA
            Positioned(
              left: 20, right: 20, bottom: bottomPad + 16,
              child: GestureDetector(
                onTap: _items.isNotEmpty && !_saving ? _saveAndPresent : null,
                child: AnimatedContainer(
                  duration: ObsidianTheme.fast,
                  height: 52,
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    color: _items.isNotEmpty ? Colors.white : c.shimmerBase,
                  ),
                  child: Center(
                    child: _saving
                        ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald))
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(PhosphorIconsBold.presentation, size: 16, color: _items.isNotEmpty ? Colors.black : c.textTertiary),
                              const SizedBox(width: 8),
                              Text(
                                'Save & Present',
                                style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: _items.isNotEmpty ? Colors.black : c.textTertiary),
                              ),
                            ],
                          ),
                  ),
                ),
              ).animate().fadeIn(delay: 300.ms, duration: 400.ms).moveY(begin: 20, end: 0),
            ),
          ],
        ),
        ),
      ),
    );
  }
}

// ── Editable Item Model ──────────────────────────────

class _EditableItem {
  String description;
  double quantity;
  double unitPrice;
  _EditableItem({required this.description, required this.quantity, required this.unitPrice});
  double get total => quantity * unitPrice;
}

// ── Line Item Editor ─────────────────────────────────

class _LineItemEditor extends StatelessWidget {
  final _EditableItem item;
  final int index;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  const _LineItemEditor({required this.item, required this.index, required this.onChanged, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GlassCard(
      padding: const EdgeInsets.all(12),
      borderRadius: ObsidianTheme.radiusMd,
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  initialValue: item.description,
                  onChanged: (v) { item.description = v; onChanged(); },
                  style: GoogleFonts.inter(fontSize: 13, color: c.textPrimary),
                  cursorColor: ObsidianTheme.emerald,
                  decoration: InputDecoration(
                    hintText: 'Description',
                    hintStyle: GoogleFonts.inter(fontSize: 13, color: c.textDisabled),
                    border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              GestureDetector(
                onTap: onRemove,
                child: const Icon(PhosphorIconsLight.trash, size: 14, color: ObsidianTheme.rose),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              SizedBox(
                width: 50,
                child: TextFormField(
                  initialValue: item.quantity.toStringAsFixed(0),
                  onChanged: (v) { item.quantity = double.tryParse(v) ?? 1; onChanged(); },
                  keyboardType: TextInputType.number,
                  style: GoogleFonts.jetBrainsMono(fontSize: 12, color: c.textSecondary),
                  cursorColor: ObsidianTheme.emerald,
                  decoration: InputDecoration(
                    hintText: 'Qty',
                    hintStyle: GoogleFonts.jetBrainsMono(fontSize: 12, color: c.textDisabled),
                    border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              Text(' × ', style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary)),
              SizedBox(
                width: 80,
                child: TextFormField(
                  initialValue: item.unitPrice > 0 ? item.unitPrice.toStringAsFixed(2) : '',
                  onChanged: (v) { item.unitPrice = double.tryParse(v) ?? 0; onChanged(); },
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: GoogleFonts.jetBrainsMono(fontSize: 12, color: c.textSecondary),
                  cursorColor: ObsidianTheme.emerald,
                  decoration: InputDecoration(
                    hintText: '\$0.00',
                    hintStyle: GoogleFonts.jetBrainsMono(fontSize: 12, color: c.textDisabled),
                    border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                '\$${item.total.toStringAsFixed(2)}',
                style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w500, color: c.textPrimary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Total Row ────────────────────────────────────────

class _TotalRow extends StatelessWidget {
  final String label;
  final double value;
  final bool bold;
  const _TotalRow({required this.label, required this.value, this.bold = false});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary)),
          Text(
            '\$${value.toStringAsFixed(2)}',
            style: bold
                ? GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)
                : GoogleFonts.jetBrainsMono(fontSize: 13, color: c.textSecondary),
          ),
        ],
      ),
    );
  }
}

// ── Jagged Receipt Divider ───────────────────────────

class _ReceiptDividerPainter extends CustomPainter {
  final Color color;
  _ReceiptDividerPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color..style = PaintingStyle.fill;
    final path = Path()..moveTo(0, size.height / 2);
    const zigWidth = 8.0;
    for (double x = 0; x < size.width; x += zigWidth) {
      path.lineTo(x + zigWidth / 2, x.toInt().isEven ? 0 : size.height);
    }
    path.lineTo(size.width, size.height / 2);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
