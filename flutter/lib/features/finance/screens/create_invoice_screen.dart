import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/invoice_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:drift/drift.dart' show Value;
import 'package:uuid/uuid.dart';

class _LineItem {
  String id;
  String description;
  double quantity;
  double unitPrice;

  _LineItem({
    String? id,
    this.description = '',
    this.quantity = 1,
    this.unitPrice = 0,
  }) : id = id ?? const Uuid().v4();

  double get total => (quantity * unitPrice * 100).roundToDouble() / 100;

  Map<String, dynamic> toJson() => {
    'description': description,
    'quantity': quantity,
    'unit_price': unitPrice,
  };
}

class CreateInvoiceScreen extends ConsumerStatefulWidget {
  final String? jobId;
  final String? clientId;
  final String? clientName;

  const CreateInvoiceScreen({
    super.key,
    this.jobId,
    this.clientId,
    this.clientName,
  });

  @override
  ConsumerState<CreateInvoiceScreen> createState() => _CreateInvoiceScreenState();
}

class _CreateInvoiceScreenState extends ConsumerState<CreateInvoiceScreen> {
  final List<_LineItem> _items = [];
  String? _selectedClientId;
  String _clientName = '';
  String _notes = '';
  double _taxRate = 10.0;
  String _terms = 'net_7';
  bool _submitting = false;
  bool _previewing = false;

  @override
  void initState() {
    super.initState();
    if (widget.clientId != null) _selectedClientId = widget.clientId;
    if (widget.clientName != null) _clientName = widget.clientName!;
  }

  double get _subtotal =>
      _items.fold(0.0, (sum, item) => sum + item.total);

  double get _tax => (_subtotal * _taxRate / 100 * 100).roundToDouble() / 100;

  double get _total => ((_subtotal + _tax) * 100).roundToDouble() / 100;

  Future<void> _submit({required bool send}) async {
    if (_items.isEmpty || _submitting) return;
    setState(() => _submitting = true);
    HapticFeedback.heavyImpact();

    final orgId = ref.read(organizationIdProvider).valueOrNull;
    if (orgId == null) {
      setState(() => _submitting = false);
      _showError('No organization found');
      return;
    }

    try {
      final user = SupabaseService.client.auth.currentUser;
      final now = DateTime.now();
      final daysMap = {'due_receipt': 0, 'net_7': 7, 'net_14': 14, 'net_30': 30};
      final dueDays = daysMap[_terms] ?? 7;
      final dueDate = now.add(Duration(days: dueDays));

      final seqResult = await SupabaseService.client
          .rpc('nextval', params: {'seq_name': 'invoice_display_seq'});
      final displayId = 'INV-$seqResult';

      final invoiceRow = await SupabaseService.client.from('invoices').insert({
        'organization_id': orgId,
        'display_id': displayId,
        'client_id': _selectedClientId,
        'client_name': _clientName.isEmpty ? null : _clientName,
        'job_id': widget.jobId,
        'status': send ? 'sent' : 'draft',
        'issue_date': now.toIso8601String().split('T')[0],
        'due_date': dueDate.toIso8601String().split('T')[0],
        'subtotal': _subtotal,
        'tax_rate': _taxRate,
        'tax': _tax,
        'total': _total,
        'notes': _notes.isEmpty ? null : _notes,
        'created_by': user?.id,
      }).select().single();

      final invoiceId = invoiceRow['id'] as String;

      final lineItemRows = _items.asMap().entries.map((entry) => {
        return {
          'invoice_id': invoiceId,
          'description': entry.value.description,
          'quantity': entry.value.quantity,
          'unit_price': entry.value.unitPrice,
          'sort_order': entry.key,
        };
      }).toList();

      await SupabaseService.client.from('invoice_line_items').insert(lineItemRows);

      await SupabaseService.client.from('invoice_events').insert({
        'invoice_id': invoiceId,
        'type': 'created',
        'text': 'Invoice created from mobile app',
      });

      if (send) {
        await SupabaseService.client.from('invoice_events').insert({
          'invoice_id': invoiceId,
          'type': 'sent',
          'text': 'Invoice sent to client',
        });
      }

      ref.invalidate(invoicesStreamProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(send ? 'Invoice sent' : 'Invoice saved as draft'),
          backgroundColor: ObsidianTheme.emerald,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      _showError('Failed to create invoice: ${e.toString().split('\n').first}');
      // Queue for offline retry if network error
      try {
        final db = ref.read(appDatabaseProvider);
        await db.enqueueSync(SyncQueueCompanion(
          id: Value(const Uuid().v4()),
          tableName: const Value('invoices'),
          action: const Value('create'),
          payload: Value(jsonEncode({
            'items': _items.map((i) => i.toJson()).toList(),
            'client_id': _selectedClientId,
            'client_name': _clientName,
            'notes': _notes,
            'tax_rate': _taxRate,
            'terms': _terms,
            'job_id': widget.jobId,
          })),
          createdAt: Value(DateTime.now()),
        ));
      } catch (_) {}
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _preview() async {
    if (_items.isEmpty) return;
    setState(() => _previewing = true);
    // Future: Call Edge Function to generate PDF and display
    await Future.delayed(const Duration(seconds: 1));
    if (mounted) {
      setState(() => _previewing = false);
      _showError('PDF preview coming soon — save the invoice to view on web');
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: const Color(0xFFF43F5E),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
      duration: const Duration(seconds: 3),
    ));
  }

  void _addItem() {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddItemSheet(onAdd: (desc, qty, price) {
        setState(() {
          _items.add(_LineItem(description: desc, quantity: qty, unitPrice: price));
        });
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        backgroundColor: c.canvas,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(PhosphorIconsLight.arrowLeft, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'NEW INVOICE',
          style: GoogleFonts.jetBrainsMono(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: 2,
          ),
        ),
        centerTitle: true,
        actions: [
          if (_previewing)
            const Padding(
              padding: EdgeInsets.only(right: 16),
              child: SizedBox(
                width: 20, height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: ObsidianTheme.emerald),
              ),
            )
          else
            IconButton(
              icon: const Icon(PhosphorIconsLight.eye, size: 20),
              onPressed: _preview,
              tooltip: 'Preview PDF',
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
              children: [
                // Client
                _SectionHeader(label: 'CLIENT'),
                const SizedBox(height: 8),
                _clientName.isEmpty
                    ? GestureDetector(
                        onTap: () {
                          // Future: Client picker
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: c.border),
                            color: c.hoverBg,
                          ),
                          child: Row(
                            children: [
                              Icon(PhosphorIconsLight.userPlus, color: c.textTertiary, size: 18),
                              const SizedBox(width: 12),
                              Text(
                                'Select client',
                                style: GoogleFonts.inter(color: c.textTertiary, fontSize: 14),
                              ),
                            ],
                          ),
                        ),
                      )
                    : Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                          color: ObsidianTheme.emeraldDim,
                        ),
                        child: Row(
                          children: [
                            Icon(PhosphorIconsBold.user, color: ObsidianTheme.emerald, size: 18),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _clientName,
                                style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                              ),
                            ),
                            GestureDetector(
                              onTap: () => setState(() {
                                _selectedClientId = null;
                                _clientName = '';
                              }),
                              child: Icon(PhosphorIconsLight.x, color: c.textTertiary, size: 16),
                            ),
                          ],
                        ),
                      ),

                const SizedBox(height: 24),

                // Line Items
                _SectionHeader(label: 'LINE ITEMS'),
                const SizedBox(height: 8),
                ..._items.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final item = entry.value;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Dismissible(
                      key: Key(item.id),
                      direction: DismissDirection.endToStart,
                      background: Container(
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.only(right: 20),
                        decoration: BoxDecoration(
                          color: ObsidianTheme.rose.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(PhosphorIconsLight.trash, color: ObsidianTheme.rose, size: 20),
                      ),
                      onDismissed: (_) {
                        setState(() => _items.removeAt(idx));
                        HapticFeedback.lightImpact();
                      },
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          color: c.hoverBg,
                          border: Border.all(color: c.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.description.isEmpty ? 'Untitled item' : item.description,
                              style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Text(
                                  '${item.quantity} × \$${item.unitPrice.toStringAsFixed(2)}',
                                  style: GoogleFonts.jetBrainsMono(color: c.textTertiary, fontSize: 12),
                                ),
                                const Spacer(),
                                Text(
                                  '\$${item.total.toStringAsFixed(2)}',
                                  style: GoogleFonts.jetBrainsMono(
                                    color: ObsidianTheme.emerald,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      )
                          .animate()
                          .fadeIn(delay: Duration(milliseconds: 50 * idx), duration: 300.ms)
                          .moveX(begin: 12, delay: Duration(milliseconds: 50 * idx), duration: 300.ms),
                    ),
                  );
                }),

                // Add Item button
                GestureDetector(
                  onTap: _addItem,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: c.border, style: BorderStyle.solid),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(PhosphorIconsLight.plus, color: c.textTertiary, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          'Add Line Item',
                          style: GoogleFonts.inter(color: c.textSecondary, fontSize: 13, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // Notes
                _SectionHeader(label: 'NOTES'),
                const SizedBox(height: 8),
                TextField(
                  onChanged: (v) => _notes = v,
                  maxLines: 3,
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Payment instructions, warranty info…',
                    hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
                    filled: true,
                    fillColor: c.hoverBg,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // Totals
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: c.hoverBg,
                    border: Border.all(color: c.border),
                  ),
                  child: Column(
                    children: [
                      _TotalsRow(label: 'Subtotal', value: _subtotal, c: c),
                      const SizedBox(height: 6),
                      _TotalsRow(label: 'GST (${_taxRate.toStringAsFixed(0)}%)', value: _tax, c: c),
                      const SizedBox(height: 8),
                      Divider(height: 1, color: c.border),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Total',
                            style: GoogleFonts.inter(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                          ),
                          Text(
                            '\$${_total.toStringAsFixed(2)}',
                            style: GoogleFonts.jetBrainsMono(
                              color: ObsidianTheme.emerald,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(delay: 200.ms, duration: 400.ms),
              ],
            ),
          ),

          // Bottom Bar
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).padding.bottom + 12),
            decoration: BoxDecoration(
              color: c.surfaceSecondary,
              border: Border(top: BorderSide(color: c.border)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submitting || _items.isEmpty ? null : () => _submit(send: false),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: c.hoverBg,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: Text(
                      'SAVE DRAFT',
                      style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 1),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _submitting || _items.isEmpty ? null : () => _submit(send: true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ObsidianTheme.emerald,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(PhosphorIconsBold.paperPlaneTilt, size: 16),
                              const SizedBox(width: 8),
                              Text(
                                'SEND INVOICE',
                                style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 1),
                              ),
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

class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Text(
      label,
      style: GoogleFonts.jetBrainsMono(
        color: c.textTertiary,
        fontSize: 10,
        fontWeight: FontWeight.w600,
        letterSpacing: 2,
      ),
    );
  }
}

class _TotalsRow extends StatelessWidget {
  final String label;
  final double value;
  final IWorkrColors c;
  const _TotalsRow({required this.label, required this.value, required this.c});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13)),
        Text(
          '\$${value.toStringAsFixed(2)}',
          style: GoogleFonts.jetBrainsMono(color: c.textSecondary, fontSize: 13),
        ),
      ],
    );
  }
}

/// Bottom sheet for adding a single line item.
class _AddItemSheet extends StatefulWidget {
  final void Function(String description, double quantity, double unitPrice) onAdd;
  const _AddItemSheet({required this.onAdd});

  @override
  State<_AddItemSheet> createState() => _AddItemSheetState();
}

class _AddItemSheetState extends State<_AddItemSheet> {
  final _descController = TextEditingController();
  final _qtyController = TextEditingController(text: '1');
  final _priceController = TextEditingController();

  @override
  void dispose() {
    _descController.dispose();
    _qtyController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _save() {
    final desc = _descController.text.trim();
    if (desc.isEmpty) return;
    final qty = double.tryParse(_qtyController.text) ?? 1;
    final price = double.tryParse(_priceController.text) ?? 0;
    widget.onAdd(desc, qty, price);
    HapticFeedback.lightImpact();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final mq = MediaQuery.of(context);

    return Container(
      padding: EdgeInsets.fromLTRB(20, 16, 20, mq.viewInsets.bottom + mq.padding.bottom + 16),
      decoration: BoxDecoration(
        color: const Color(0xF5080808),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: c.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36, height: 4,
            decoration: BoxDecoration(
              color: c.borderHover,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'ADD LINE ITEM',
            style: GoogleFonts.jetBrainsMono(
              color: c.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _descController,
            autofocus: true,
            style: GoogleFonts.inter(color: Colors.white, fontSize: 15),
            decoration: InputDecoration(
              hintText: 'Description',
              hintStyle: GoogleFonts.inter(color: c.textTertiary),
              filled: true,
              fillColor: c.hoverBg,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: c.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: c.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _qtyController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: GoogleFonts.jetBrainsMono(color: Colors.white, fontSize: 15),
                  decoration: InputDecoration(
                    labelText: 'Qty',
                    labelStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
                    filled: true,
                    fillColor: c.hoverBg,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _priceController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: GoogleFonts.jetBrainsMono(color: Colors.white, fontSize: 15),
                  decoration: InputDecoration(
                    labelText: 'Unit Price (\$)',
                    labelStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
                    filled: true,
                    fillColor: c.hoverBg,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: ObsidianTheme.emerald,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: Text(
                'ADD ITEM',
                style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 1),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
